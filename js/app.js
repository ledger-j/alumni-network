/* ==========================================
   UniCircle — UM Alumni Network
   SPA Router & Dynamic Fallback Controller (Jun 2026)
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Route → on-demand HTML partial. Each page is fetched lazily and cached, so
  // the initial JS payload stays small (templates no longer inlined in this file).
  const routes = {
    feed: 'components/feed.html',
    network: 'components/network.html',
    events: 'components/events.html',
    jobs: 'components/jobs.html',
    mentoring: 'components/mentoring.html',
    profile: 'components/profile.html',
    'pbl-hub': 'components/pbl-hub.html',
    landing: 'components/landing.html'
  };
  const pageCache = {};
  async function fetchPage(name) {
    if (pageCache[name] != null) return pageCache[name];
    const res = await fetch(routes[name] + '?v=3');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    pageCache[name] = html;
    return html;
  }

  // The one authenticated app shell: a dark-nuance side rail (Design System §5).
  // Every signed-in page is rendered inside it; only the main column swaps.
  function railHtml(active) {
    const items = [
      ['feed', 'Feed', '235'], ['network', 'Network', '275'],
      ['events', 'Events', '305'], ['jobs', 'Jobs', '185'],
      ['mentoring', 'Mentoring', '45']
    ];
    const links = items.map(function (it) {
      const on = active === it[0];
      return '<a href="#' + it[0] + '" class="uc-rail-link' + (on ? ' active' : '') + '"'
        + (on ? ' aria-current="page"' : '') + '>'
        + '<span class="uc-rail-dot" style="background:oklch(0.72 0.14 ' + it[2] + ');"></span>' + it[1] + '</a>';
    }).join('');
    return '<nav class="uc-rail" aria-label="Primary">'
      + '<div class="uc-rail-brand"><img src="unicircle-logo.png" alt="UniCircle"><span class="uc-serif">UniCircle</span></div>'
      + links
      + '<a href="#profile" class="uc-rail-link' + (active === 'profile' ? ' active' : '') + '"'
      + (active === 'profile' ? ' aria-current="page"' : '')
      + '><span class="uc-rail-dot" style="background:rgba(250,249,246,0.4);"></span>My profile</a>'
      + '<div style="flex:1"></div>'
      + '<button type="button" class="uc-rail-link" id="uc-dash-signout">← Sign out</button>'
      + '</nav>';
  }

  // Common wiring for every shell page: profile, sign-out, header search.
  function initShell() {
    document.querySelector('[data-uc-profile]')?.addEventListener('click', () => window.UC && window.UC.openProfile());
    document.getElementById('uc-dash-signout')?.addEventListener('click', () => {
      try { localStorage.removeItem('uc_auth'); } catch (e) { /* ignore */ }
      window.location.hash = '';
      window.location.reload();
    });
    document.querySelector('[data-uc-search]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      window.location.hash = '#network';
    });
    // Connect / Message / Accept-match → open the messages drawer.
    document.querySelectorAll('[data-uc-connect],[data-uc-message]').forEach((b) =>
      b.addEventListener('click', () => window.UC && window.UC.openChat()));
    // Edit-profile affordances → open the profile modal.
    document.querySelectorAll('[data-uc-profile]').forEach((b) =>
      b.addEventListener('click', () => window.UC && window.UC.openProfile()));
    // Personalise the profile screen from the signed-in user.
    const u = window.UC && window.UC.state && window.UC.state.user;
    if (u) {
      const nm = document.getElementById('uc-profile-name'); if (nm && u.name) nm.textContent = u.name;
      const hl = document.getElementById('uc-profile-headline'); if (hl && u.headline) hl.textContent = u.headline;
      const loc = document.getElementById('uc-profile-location'); if (loc && u.location) loc.textContent = u.location;
      const av = document.getElementById('uc-profile-initials');
      if (av && u.name) av.textContent = u.name.trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
    }
    if (window.Iconify) window.Iconify.scan(appViewport);
  }


  const appViewport = document.getElementById('app-viewport');
  const navItems = document.querySelectorAll('.nav-menu .nav-item[data-page]');

  // True once auth-ready and user is logged in — gates nav clicks
  let _navReady = false;

  // Initialize router
  function initRouter() {
    // Hash-change: only route when a user is authenticated
    window.addEventListener('hashchange', () => {
      if (!_navReady) return;
      const newPage = window.location.hash.replace('#', '');
      if (routes[newPage]) loadPage(newPage);
    });

    // Navigation click handlers
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        if (!_navReady) {
          // Guest clicks nav → open sign-up modal
          window.UC?.openAuth('signup');
          return;
        }
        const targetPage = item.getAttribute('data-page');
        window.location.hash = `#${targetPage}`;
      });

      // Accessibility key support (Enter / Space)
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
    });

    // unicircle.js dispatches 'uc:auth-ready' once bootSession() resolves
    document.addEventListener('uc:auth-ready', (e) => {
      if (e.detail && e.detail.user) {
        _navReady = true;
        let page = window.location.hash.replace('#', '');
        if (!routes[page] || page === 'landing') page = 'feed';
        window.location.hash = '#' + page;
        loadPage(page);
      } else {
        _navReady = false;
        loadPage('landing');
      }
    }, { once: true });

    // unicircle.js dispatches 'uc:login' after a successful sign-in
    document.addEventListener('uc:login', () => {
      _navReady = true;
      window.location.hash = '#feed';
      loadPage('feed');
    });
  }

  // Load page content from its on-demand HTML partial (fetched + cached).
  // Every authenticated page renders inside the side-rail shell; the guest
  // landing carries its own nav pill. The global top header is never shown.
  async function loadPage(pageName) {
    document.body.classList.add('uc-hide-header');

    let html;
    try {
      html = await fetchPage(pageName);
    } catch (e) {
      appViewport.innerHTML = '<div style="padding:80px 24px;text-align:center;color:var(--uc-ink-2);font-family:var(--uc-font-body);">'
        + '<p style="font-family:var(--uc-font-display);font-size:24px;">This page didn’t load.</p>'
        + '<p style="margin-top:8px;"><a href="#feed" onclick="location.reload()" style="color:var(--uc-ink);font-weight:600;">Reload</a></p></div>';
      return;
    }

    const render = () => {
      if (pageName === 'landing') {
        appViewport.innerHTML = html;
      } else {
        appViewport.innerHTML = '<div class="uc-dashboard-shell">' + railHtml(pageName)
          + '<div class="uc-main-col">' + html + '</div></div>';
      }
      initializePageInteractivity(pageName);
    };

    if (document.startViewTransition) {
      document.startViewTransition(render);
    } else {
      render();
    }
  }

  // Initialize specific interactive scripts per component page
  function initializePageInteractivity(pageName) {
    if (pageName !== 'landing') initShell();
    if (pageName === 'landing') {
      initLandingInteractivity();
    } else if (pageName === 'feed') {
      initFeedInteractivity();
    } else if (pageName === 'pbl-hub') {
      initPblInteractivity();
    }
    // network / events / jobs / mentoring are static screens fully wired by
    // initShell() (search, connect/message, profile, sign-out) — no extra init.
  }

  /* ==========================================
     0. LANDING PAGE INTERACTIVITY
     ========================================== */
  function initLandingInteractivity() {
    const openSignup = () => window.UC?.openAuth('signup');
    const openSignin = () => window.UC?.openAuth('signin');

    // Nav + footer + feature CTAs open the full modal (LinkedIn / CSV import live there).
    document.getElementById('lp-bottom-join')?.addEventListener('click', openSignup);
    document.getElementById('lp-signin-link')?.addEventListener('click', (e) => { e.preventDefault(); openSignin(); });
    document.getElementById('lp-foot-signin')?.addEventListener('click', (e) => { e.preventDefault(); openSignin(); });
    document.getElementById('lp-foot-join')?.addEventListener('click', (e) => { e.preventDefault(); openSignup(); });
    document.querySelectorAll('.uc-lp-cta').forEach(b => b.addEventListener('click', openSignup));

    // --- Tabbed inline sign-in card (Password / Email link / Create) ---
    const card = document.getElementById('lp-login');
    if (card) {
      const form = document.getElementById('lp-auth');
      const nameEl = form.name, emailEl = form.email, pwEl = form.password, codeEl = form.code;
      const hint = document.getElementById('lp-hint');
      const forgot = document.getElementById('lp-forgot');
      const errEl = form.querySelector('.uc-err');
      let mode = 'password';   // 'password' | 'magic' | 'create'
      let otpId = null;

      const setMode = (m) => {
        mode = m; otpId = null; errEl.hidden = true; hint.textContent = '';
        codeEl.hidden = true; codeEl.value = '';
        card.querySelectorAll('.uc-tab').forEach(b => b.classList.toggle('active', b.dataset.lpTab === m));
        nameEl.hidden = m !== 'create';
        pwEl.hidden = m === 'magic';
        forgot.style.visibility = m === 'password' ? 'visible' : 'hidden';
      };
      card.querySelectorAll('[data-lp-tab]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.lpTab)));

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!(window.UC && window.UC.auth.requireBackend())) return;
        errEl.hidden = true;
        const email = emailEl.value.trim();
        try {
          if (mode === 'password') {
            await window.UC.auth.password(email, pwEl.value);
          } else if (mode === 'create') {
            await window.UC.auth.signup(nameEl.value.trim(), email, pwEl.value);
          } else if (!otpId) {
            otpId = await window.UC.auth.otpRequest(email);
            codeEl.hidden = false; codeEl.focus();
            hint.textContent = 'Code sent — check your inbox.';
          } else {
            await window.UC.auth.otpVerify(otpId, codeEl.value.trim());
          }
          // success → completeAuth fires 'uc:login' and the app loads the dashboard
        } catch (err) {
          errEl.textContent = err && err.status === 400
            ? (mode === 'magic' && otpId ? 'That code is incorrect or expired.' :
               mode === 'create' ? 'Check your details — email may already be registered.' :
               'Email or password not recognised.')
            : (err && err.message) || 'Something went wrong.';
          errEl.hidden = false;
        }
      });

      forgot.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!(window.UC && window.UC.auth.requireBackend())) return;
        const email = emailEl.value.trim();
        if (!email) { errEl.textContent = 'Enter your email above first.'; errEl.hidden = false; return; }
        try { await window.UC.auth.resetRequest(email); hint.textContent = 'Reset link sent — check your inbox.'; }
        catch { errEl.textContent = 'Could not send a reset link.'; errEl.hidden = false; }
      });
    }

    // Constellation particle field behind the hero
    mountConstellation(document.getElementById('lp-constellation'), 340);
  }

  /* Lightweight constellation swarm (ported from the redesign hero canvas).
     Respects prefers-reduced-motion; cleans itself up on next page render. */
  let _ucRaf = null;
  function mountConstellation(canvas, count) {
    if (_ucRaf) { cancelAnimationFrame(_ucRaf); _ucRaf = null; }
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const palette = ['oklch(0.62 0.14 235)', 'oklch(0.62 0.14 275)', 'oklch(0.62 0.14 305)', 'oklch(0.62 0.14 185)'];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, particles = [];
    const resize = () => {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const mouse = { x: null, y: null };
    canvas.parentElement.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    function P() {
      this.x = Math.random() * W; this.y = Math.random() * H;
      this.vx = Math.random() - 0.5; this.vy = Math.random() - 0.5;
      this.size = Math.random() * 3 + 1.2;
      this.color = palette[Math.floor(Math.random() * palette.length)];
      this.alpha = Math.random() * 0.35 + 0.3; this.off = Math.random() * Math.PI * 2;
    }
    P.prototype.update = function (t) {
      const a = Math.sin(this.y * 0.004 + t * 0.0004 + this.off) + Math.cos(this.x * 0.003 - t * 0.0003);
      this.vx += Math.cos(a) * 0.03; this.vy += Math.sin(a) * 0.03;
      const cx = W / 2, cy = H * 0.55, dx = cx - this.x, dy = cy - this.y, d = Math.hypot(dx, dy) || 1;
      this.vx += (dx / d) * 0.007; this.vy += (dy / d) * 0.007;
      if (mouse.x !== null) {
        const mx = mouse.x - this.x, my = mouse.y - this.y, md = Math.hypot(mx, my);
        if (md < 180) { this.vx += (mx / md) * 0.05; this.vy += (my / md) * 0.05; }
      }
      this.vx *= 0.96; this.vy *= 0.96; this.x += this.vx; this.y += this.vy;
      if (this.x < -20) this.x = W + 20; if (this.x > W + 20) this.x = -20;
      if (this.y < -20) this.y = H + 20; if (this.y > H + 20) this.y = -20;
    };
    P.prototype.draw = function () {
      ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color; const s = this.size;
      ctx.beginPath(); ctx.roundRect(this.x - s, this.y - s, s * 2, s * 2, s * 0.7); ctx.fill();
    };
    for (let i = 0; i < count; i++) particles.push(new P());
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = (t) => {
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(250,249,246,0.28)'; ctx.fillRect(0, 0, W, H);
      for (const p of particles) { p.update(t); p.draw(); }
      ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(43,42,38,0.06)'; ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i += 3) {
        for (let j = i + 3; j < particles.length; j += 3) {
          const a = particles[i], b = particles[j], dx = a.x - b.x, dy = a.y - b.y;
          if (dx * dx + dy * dy < 4900) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
      }
      if (!reduced && canvas.isConnected) _ucRaf = requestAnimationFrame(step);
    };
    ctx.fillStyle = '#faf9f6'; ctx.fillRect(0, 0, W, H);
    _ucRaf = requestAnimationFrame(step);
  }

  /* ==========================================
     1. FEED COMPONENT INTERACTIVITY
     ========================================== */
  // Dashboard (authenticated home). Shell chrome (rail, sign-out, search) is
  // wired by initShell(); this only handles the dashboard-specific welcome line
  // and the quiet swarm ribbon.
  function initFeedInteractivity() {
    const nameEl = document.getElementById('uc-welcome-name');
    if (nameEl) {
      const u = window.UC && window.UC.state && window.UC.state.user;
      const first = u && u.name ? String(u.name).trim().split(/\s+/)[0] : '';
      nameEl.textContent = (first || 'there') + '.';
    }
    mountConstellation(document.getElementById('uc-ribbon-canvas'), 90);
    if (window.Iconify) window.Iconify.scan(appViewport);
  }

  /* ==========================================
     2. AI NETWORK INTERACTIVITY
     ========================================== */
  function initNetworkInteractivity() {
    const searchInput = document.querySelector('.ai-search-container .search-input');
    const searchSubmit = document.querySelector('.ai-search-container .search-submit');
    const suggestionTags = document.querySelectorAll('.ai-search-container .tag');
    
    const sectorFilter = document.getElementById('filter-sector');
    const courseFilter = document.getElementById('filter-course');
    const periodFilter = document.getElementById('filter-period');
    const tutorialFilter = document.getElementById('filter-tutorial');
    const yearFilter = document.getElementById('filter-year');
    const alumniCards = document.querySelectorAll('.alumni-grid .alumni-card');

    // Conversational search engine simulator
    function performAISearch(queryText) {
      const normalizedQuery = queryText.toLowerCase();
      
      // Auto-set selects based on keywords in search box
      if (normalizedQuery.includes('finance') || normalizedQuery.includes('investment')) {
        sectorFilter.value = 'Finance';
      } else if (normalizedQuery.includes('consulting') || normalizedQuery.includes('strategy')) {
        sectorFilter.value = 'Consulting';
      } else if (normalizedQuery.includes('technology') || normalizedQuery.includes('ai') || normalizedQuery.includes('startup')) {
        sectorFilter.value = 'Tech';
      }

      if (normalizedQuery.includes('international financial') || normalizedQuery.includes('ifm')) {
        courseFilter.value = 'International Financial Management';
      } else if (normalizedQuery.includes('problem based') || normalizedQuery.includes('pbl')) {
        courseFilter.value = 'Problem Based Learning in Finance';
      }

      if (normalizedQuery.includes('period 5')) {
        periodFilter.value = '5';
      } else if (normalizedQuery.includes('period 1')) {
        periodFilter.value = '1';
      }

      const yearMatch = normalizedQuery.match(/\b(202[0-9]|class of (\d{4}))\b/);
      if (yearMatch) yearFilter.value = yearMatch[2] || yearMatch[1];

      if (normalizedQuery.includes('tutorial 01') || normalizedQuery.includes('t01')) {
        tutorialFilter.value = '01';
      } else if (normalizedQuery.includes('tutorial 04') || normalizedQuery.includes('t04')) {
        tutorialFilter.value = '04';
      }

      applyFilters();
    }

    // Apply the granular standard filters
    function applyFilters() {
      const selectedSector = sectorFilter.value;
      const selectedCourse = courseFilter.value;
      const selectedPeriod = periodFilter.value;
      const selectedTutorial = tutorialFilter.value;
      const selectedYear = yearFilter ? yearFilter.value : '';
      let visibleCount = 0;

      alumniCards.forEach(card => {
        let match = true;
        if (selectedSector && card.getAttribute('data-sector') !== selectedSector) match = false;
        if (selectedCourse && card.getAttribute('data-course') !== selectedCourse) match = false;
        if (selectedPeriod && card.getAttribute('data-period') !== selectedPeriod) match = false;
        if (selectedTutorial && card.getAttribute('data-tutorial') !== selectedTutorial) match = false;
        if (selectedYear && card.getAttribute('data-year') !== selectedYear) match = false;

        if (match) {
          visibleCount++;
          card.style.display = 'flex';
          card.style.opacity = '0';
          card.style.transform = 'translateY(10px)';
          setTimeout(() => {
            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 50);
        } else {
          card.style.display = 'none';
        }
      });

      // Empty state
      let emptyEl = document.getElementById('alumni-empty-state');
      if (visibleCount === 0) {
        if (!emptyEl) {
          emptyEl = document.createElement('div');
          emptyEl.id = 'alumni-empty-state';
          emptyEl.style.cssText = 'grid-column:1/-1;text-align:center;padding:var(--space-8);color:var(--color-text-secondary);';
          emptyEl.innerHTML = `<span class="iconify" data-icon="ph:users-three-duotone" style="font-size:48px;opacity:.4;"></span><p style="margin-top:var(--space-3);font-family:var(--font-heading);font-weight:600;">No alumni match your filters.</p><p style="font-size:var(--text-xs);margin-top:var(--space-2);">Try broadening your search or <a href="#" onclick="document.querySelectorAll('.grid-filter-controls select').forEach(s=>s.value='');applyFilters&&applyFilters();return false;" style="color:var(--uc-azure);">clear all filters</a>.</p>`;
          document.querySelector('.alumni-grid').appendChild(emptyEl);
        }
        emptyEl.style.display = 'block';
      } else if (emptyEl) {
        emptyEl.style.display = 'none';
      }
    }

    // Event listeners for selects
    [sectorFilter, courseFilter, periodFilter, tutorialFilter, yearFilter].filter(Boolean).forEach(elem => {
      elem.addEventListener('change', applyFilters);
    });

    // Event listener for search action
    if (searchSubmit && searchInput) {
      searchSubmit.addEventListener('click', () => {
        performAISearch(searchInput.value);
      });
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          performAISearch(searchInput.value);
        }
      });
    }

    // Suggestion tags trigger search
    suggestionTags.forEach(tag => {
      tag.addEventListener('click', () => {
        const query = tag.textContent.trim().replace(/^"|"$/g, '');
        searchInput.value = query;
        performAISearch(query);
      });
    });

    // Invite to Solve Case Dialog
    const inviteModal = document.getElementById('invite-modal');
    if (inviteModal) {
      const pblBtns = document.querySelectorAll('.alumni-card .pbl-btn');
      pblBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const alumniName = btn.closest('.alumni-card').querySelector('.name').firstChild.textContent.trim();
          inviteModal.querySelector('.invitee-name').textContent = alumniName;
          inviteModal.showModal();
        });
      });

      inviteModal.querySelector('.close-btn').addEventListener('click', () => inviteModal.close());
      inviteModal.querySelector('.cancel-btn').addEventListener('click', () => inviteModal.close());

      inviteModal.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const successMessage = document.createElement('div');
        successMessage.style.position = 'fixed';
        successMessage.style.bottom = '20px';
        successMessage.style.right = '20px';
        successMessage.style.backgroundColor = '#5fcf80';
        successMessage.style.color = 'white';
        successMessage.style.padding = '12px 24px';
        successMessage.style.borderRadius = 'var(--radius-md)';
        successMessage.style.boxShadow = 'var(--shadow-lg)';
        successMessage.style.zIndex = '99999';
        successMessage.style.fontFamily = 'var(--font-heading)';
        successMessage.style.fontWeight = '700';
        successMessage.innerHTML = `<span class="iconify" data-icon="ph:check-circle-fill"></span> Invite sent to alumni!`;
        document.body.appendChild(successMessage);
        
        setTimeout(() => successMessage.remove(), 3000);
        inviteModal.close();
      });
    }

    // Connect button trigger simulator
    const connectBtns = document.querySelectorAll('.alumni-card .connect-btn');
    connectBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.closest('.alumni-card')?.querySelector('.name')?.firstChild?.textContent?.trim() || 'this alumnus';
        if (btn.classList.contains('connected')) {
          btn.classList.remove('connected');
          btn.textContent = 'Connect';
          btn.style.backgroundColor = '';
        } else {
          btn.classList.add('connected');
          btn.textContent = 'Pending';
          btn.style.backgroundColor = 'var(--color-text-muted)';
          if (window.UC) window.UC.openChat && showToast(`Connection request sent to ${name}! You can message them directly.`);
        }
      });
    });

    // City hub join buttons
    document.querySelectorAll('#city-hubs .connect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const city = btn.closest('.sbe-card')?.querySelector('h4')?.textContent?.replace(/^[^\w]+/, '') || 'this hub';
        if (btn.classList.contains('joined')) {
          btn.classList.remove('joined');
          btn.textContent = btn.textContent.replace('✓ Joined', 'Join ' + city.split(',')[0] + ' Hub');
          btn.style.backgroundColor = '';
        } else {
          btn.classList.add('joined');
          btn.textContent = '✓ Joined';
          btn.style.backgroundColor = 'var(--uc-azure)';
          btn.style.color = '#fff';
          btn.style.border = 'none';
          if (window.UC) showToast(`You joined the ${city.split(',')[0]} Hub! Members can now see you here.`);
        }
      });
    });

    // Mentorship "Find a Mentor" button
    const findMentorBtn = document.querySelector('#mentorship button[style*="background: white"]') ||
      document.querySelector('#mentorship .sbe-card:first-child button');
    if (findMentorBtn) {
      findMentorBtn.addEventListener('click', () => {
        document.querySelector('#mentorship .alumni-grid')?.scrollIntoView({ behavior: 'smooth' });
        showToast('Browse available mentors below — click "Request Mentorship" to connect.');
      });
    }

    // Mentorship "Become a Mentor" button
    document.querySelectorAll('#mentorship .connect-btn').forEach(btn => {
      if (btn.textContent.includes('Become a Mentor')) {
        btn.addEventListener('click', () => {
          if (window.UC && window.UC.state.user) {
            window.UC.openProfile();
            showToast('Toggle "Offer mentorship" in your profile to appear in the mentor list.');
          } else if (window.UC) {
            window.UC.openAuth('signup');
          }
        });
      }
    });

    // "Request Mentorship" button on mentor cards
    document.querySelectorAll('#mentorship .card-footer .connect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.closest('.alumni-card')?.querySelector('.name')?.textContent?.trim() || 'this mentor';
        if (window.UC && window.UC.state.user) {
          window.UC.openChat();
          showToast(`Opening chat — message ${name} directly to request mentorship.`);
        } else if (window.UC) {
          window.UC.openAuth('signup');
        }
      });
    });

    // Guest lecture "Volunteer to Speak" button
    document.querySelectorAll('#guest-lectures .connect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const course = btn.closest('article')?.querySelector('p')?.textContent?.match(/Course: (.+?) •/)?.[1] || 'this course';
        if (window.UC && window.UC.state.user) {
          showToast(`Interest registered for "${course}"! The course coordinator will contact you via your profile email.`);
          btn.textContent = '✓ Interest Registered';
          btn.style.backgroundColor = 'var(--uc-cobalt)';
          btn.style.color = '#fff';
          btn.style.border = 'none';
        } else if (window.UC) {
          window.UC.openAuth('signup');
        }
      });
    });
  }

  function showToast(msg) {
    if (window.UC && window.UC.state !== undefined) {
      // Use UniCircle toast
      const t = document.createElement('div');
      t.className = 'uc-toast uc-toast--ok in';
      t.innerHTML = msg;
      document.body.appendChild(t);
      setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 3500);
    }
  }

  /* ==========================================
     3. PBL PROBLEM SOLVING HUB INTERACTIVITY
     ========================================== */
  function initPblInteractivity() {
    // Upvoting logic
    const upvoteBtns = document.querySelectorAll('.pbl-case-card .upvote-widget');
    upvoteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('voted');
        const countSpan = btn.querySelector('.count');
        let currentCount = parseInt(countSpan.textContent);
        if (btn.classList.contains('voted')) {
          btn.innerHTML = `<span class="iconify" data-icon="ph:caret-up-fill"></span> <span class="count">${currentCount + 1}</span>`;
        } else {
          btn.innerHTML = `<span class="iconify" data-icon="ph:caret-up-bold"></span> <span class="count">${currentCount - 1}</span>`;
        }
        // Recursively re-bind click
        initPblInteractivity();
      });
    });

    // Create PBL Case Modal
    const createBtn = document.querySelector('.pbl-hub-header .pbl-create-btn');
    const modal = document.getElementById('pbl-create-modal');
    if (createBtn && modal) {
      createBtn.addEventListener('click', () => modal.showModal());
      modal.querySelector('.close-btn').addEventListener('click', () => modal.close());
      modal.querySelector('.cancel-btn').addEventListener('click', () => modal.close());

      modal.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = modal.querySelector('#case-title-input').value;
        const course = modal.querySelector('#case-course-input').value;
        const description = modal.querySelector('#case-desc-input').value;

        if (!title.trim() || !description.trim()) return;

        const boardList = document.querySelector('.pbl-cases-list');
        const newCaseCard = document.createElement('article');
        newCaseCard.className = 'sbe-card pbl-case-card';
        newCaseCard.innerHTML = `
          <div class="case-header">
            <span class="course-tag">${course}</span>
            <span class="difficulty-rating"><span class="iconify" data-icon="ph:star-fill"></span> Intermediate</span>
          </div>
          <h3 class="case-title">${title}</h3>
          <div class="case-author">
            <img src="Image_ressources/Mood_images/nikhil1256_A_man_walking_dressed_in_professional_business_attir_8fa44d19-f313-4ba2-aba1-72254228f5eb.png" alt="Author picture">
            <span>Posted by <span class="author-name">Jean Maurice H.</span> (Student)</span>
          </div>
          <p class="case-description">${description}</p>
          <div class="case-stats">
            <span class="active-solutions"><span class="iconify" data-icon="ph:chat-text-bold"></span> 0 solutions proposed</span>
            <span><span class="iconify" data-icon="ph:eye-bold"></span> 1 view</span>
          </div>
        `;

        boardList.prepend(newCaseCard);
        modal.reset();
        modal.close();
      });
    }
  }

  /* ==========================================
     4. EVENTS COMPONENT INTERACTIVITY
     ========================================== */
  function initEventsInteractivity() {
    // RSVP button toggling
    const attendBtns = document.querySelectorAll('.event-card .attend-btn');
    attendBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('attending');
        if (btn.classList.contains('attending')) {
          btn.innerHTML = `<span class="iconify" data-icon="ph:check-bold"></span> Going`;
          btn.style.backgroundColor = '#5fcf80';
        } else {
          btn.innerHTML = `RSVP`;
          btn.style.backgroundColor = 'var(--um-orange-red)';
        }
      });
    });

    // Event Details buttons
    document.querySelectorAll('.event-card .details-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.event-card');
        const title = card.querySelector('.event-title')?.textContent || 'Event';
        const location = card.querySelector('.event-location')?.textContent?.trim() || '';
        const desc = card.querySelector('.event-description')?.textContent?.trim() || '';
        const day = card.querySelector('.event-date-side .day')?.textContent || '';
        const month = card.querySelector('.event-date-side .month')?.textContent || '';
        const year = card.querySelector('.event-date-side .year')?.textContent || '';
        const dlg = document.createElement('dialog');
        dlg.className = 'sbe-modal';
        dlg.innerHTML = `
          <div class="modal-wrapper">
            <div class="modal-header">
              <h3>${title}</h3>
              <button class="close-btn" aria-label="Close">✕</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-3);">
              <p style="font-size:var(--text-sm);font-weight:700;color:var(--uc-azure);">${location}</p>
              <p style="font-size:var(--text-sm);font-weight:600;">${day} ${month} ${year}</p>
              <p style="font-size:var(--text-sm);line-height:1.6;">${desc}</p>
              <p style="font-size:var(--text-xs);color:var(--color-text-secondary);">RSVP via UniCircle to appear on the attendee list and let classmates know you're coming.</p>
            </div>
            <div class="modal-footer">
              <button class="cancel-btn">Close</button>
              <button class="submit-btn" style="background:var(--uc-azure);border:none;color:#fff;">RSVP Now</button>
            </div>
          </div>`;
        document.body.appendChild(dlg);
        dlg.showModal();
        dlg.querySelector('.close-btn').onclick = () => dlg.close();
        dlg.querySelector('.cancel-btn').onclick = () => dlg.close();
        dlg.querySelector('.submit-btn').onclick = () => {
          dlg.close();
          const rsvpBtn = card.querySelector('.attend-btn');
          if (rsvpBtn && !rsvpBtn.classList.contains('attending')) rsvpBtn.click();
        };
        dlg.addEventListener('close', () => dlg.remove());
      });
    });

    // Overlap pill classmates modal lookup
    const overlapPills = document.querySelectorAll('.event-card .tutorial-overlap-pill');
    const overlapModal = document.getElementById('overlap-modal');
    if (overlapPills && overlapModal) {
      overlapPills.forEach(pill => {
        pill.addEventListener('click', () => {
          const eventTitle = pill.closest('.event-details-side').querySelector('.event-title').textContent;
          overlapModal.querySelector('.modal-header h3').textContent = `Classmates overlap - ${eventTitle}`;
          overlapModal.showModal();
        });
      });

      overlapModal.querySelector('.close-btn').addEventListener('click', () => overlapModal.close());
      overlapModal.querySelector('.close-btn-footer').addEventListener('click', () => overlapModal.close());
    }
  }

  /* ==========================================
     5. JOBS & PREMIUM INTERACTIVITY
     ========================================== */
  function initJobsInteractivity() {
    // Job application buttons
    document.querySelectorAll('.jobs-list .apply-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.job-card');
        const title = card?.querySelector('.title')?.textContent || 'this position';
        const company = card?.querySelector('.company')?.textContent || '';
        const dlg = document.createElement('dialog');
        dlg.className = 'sbe-modal';
        dlg.innerHTML = `
          <div class="modal-wrapper">
            <div class="modal-header">
              <h3>Apply: ${title}</h3>
              <button class="close-btn" aria-label="Close">✕</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-3);">
              <p style="font-size:var(--text-sm);color:var(--color-text-secondary);">${company}</p>
              ${window.UC && window.UC.state.user
                ? `<p style="font-size:var(--text-sm);">Your UniCircle profile will be sent to the recruiter. Add a note below (optional).</p>
                   <textarea placeholder="Cover note — why are you a great fit for this role?" style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:10px;font-size:var(--text-sm);min-height:80px;font-family:var(--font-body);"></textarea>`
                : `<p style="font-size:var(--text-sm);">Please <a href="#" onclick="document.querySelector('dialog.sbe-modal').close();window.UC&&window.UC.openAuth('signup');return false;" style="color:var(--uc-azure);">create a UniCircle account</a> to apply — your profile is your CV.</p>`}
            </div>
            <div class="modal-footer">
              <button class="cancel-btn">Cancel</button>
              ${window.UC && window.UC.state.user
                ? `<button class="submit-btn" style="background:var(--uc-azure);border:none;color:#fff;">Submit Application</button>`
                : ''}
            </div>
          </div>`;
        document.body.appendChild(dlg);
        dlg.showModal();
        dlg.querySelector('.close-btn').onclick = () => dlg.close();
        dlg.querySelector('.cancel-btn').onclick = () => dlg.close();
        dlg.querySelector('.submit-btn')?.addEventListener('click', () => {
          dlg.close();
          showToast(`Application sent for "${title}"! The recruiter will reach you via your profile email.`);
          btn.textContent = '✓ Applied';
          btn.style.backgroundColor = 'var(--uc-cobalt)';
          btn.style.color = '#fff';
          btn.disabled = true;
        });
        dlg.addEventListener('close', () => dlg.remove());
      });
    });

    // Contribution amount button selection
    document.querySelectorAll('.premium-tiers-container .tier-card.premium button[style*="border"]').forEach(amountBtn => {
      amountBtn.addEventListener('click', () => {
        document.querySelectorAll('.premium-tiers-container .tier-card.premium button[style*="border"]').forEach(b => {
          b.style.background = 'white';
          b.style.color = 'var(--um-orange-red)';
        });
        amountBtn.style.background = 'var(--um-orange-red)';
        amountBtn.style.color = 'white';
      });
    });

    // Select Tier confirm simulator
    const selectTierBtns = document.querySelectorAll('.premium-tiers-container .select-tier-btn');
    selectTierBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tierName = btn.closest('.tier-card').querySelector('.tier-name').textContent;
        const confirmDialog = document.createElement('dialog');
        confirmDialog.className = 'sbe-modal';
        confirmDialog.style.display = 'block'; // Make dynamic visible wrapper
        confirmDialog.innerHTML = `
          <div class="modal-wrapper">
            <div class="modal-header">
              <h3>Membership Registration</h3>
            </div>
            <div class="modal-body" style="padding: var(--space-5); text-align: center;">
              <p>You have selected the <strong>${tierName} Membership</strong>. Would you like to confirm registration and sync this selection with your UniCircle profile?</p>
            </div>
            <div class="modal-footer">
              <button class="cancel-btn">Back</button>
              <button class="submit-btn" style="background-color: var(--um-orange-red); border: none; color: white;">Confirm & Sync</button>
            </div>
          </div>
        `;
        
        document.body.appendChild(confirmDialog);
        
        confirmDialog.querySelector('.cancel-btn').addEventListener('click', () => {
          confirmDialog.remove();
        });

        confirmDialog.querySelector('.submit-btn').addEventListener('click', () => {
          const welcomeMessage = document.createElement('div');
          welcomeMessage.style.position = 'fixed';
          welcomeMessage.style.bottom = '20px';
          welcomeMessage.style.right = '20px';
          welcomeMessage.style.backgroundColor = 'var(--um-dark-blue)';
          welcomeMessage.style.color = 'white';
          welcomeMessage.style.padding = '12px 24px';
          welcomeMessage.style.borderRadius = 'var(--radius-md)';
          welcomeMessage.style.boxShadow = 'var(--shadow-lg)';
          welcomeMessage.style.zIndex = '99999';
          welcomeMessage.style.fontFamily = 'var(--font-heading)';
          welcomeMessage.style.fontWeight = '700';
          welcomeMessage.innerHTML = `<span class="iconify" data-icon="ph:sparkle-fill" style="color: gold;"></span> Successfully synchronized! Enjoy ${tierName}.`;
          document.body.appendChild(welcomeMessage);
          
          setTimeout(() => welcomeMessage.remove(), 4000);
          confirmDialog.remove();
        });
      });
    });
  }

  // Load router
  initRouter();
});
