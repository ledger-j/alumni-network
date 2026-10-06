/* ==========================================
   UniCircle — alumni network
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
    map: 'components/map.html',
    landing: 'components/landing.html'
  };
  // `#page?key=value` → page name + params (e.g. #network?q=finance&city=Berlin).
  // Page modules read the params from window.UCP.params().
  function parseHash() {
    const raw = window.location.hash.replace(/^#/, '');
    const i = raw.indexOf('?');
    return { page: i < 0 ? raw : raw.slice(0, i), params: new URLSearchParams(i < 0 ? '' : raw.slice(i + 1)) };
  }
  window.UCP = window.UCP || {};
  window.UCP.params = () => parseHash().params;
  const pageCache = {};
  async function fetchPage(name) {
    if (pageCache[name] != null) return pageCache[name];
    const res = await fetch(routes[name] + '?v=5');
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
      ['map', 'Map', '25'], ['mentoring', 'Mentoring', '45'],
      ['events', 'Events', '305'], ['pbl-hub', 'Case Hub', '145'],
      ['jobs', 'Jobs', '185']
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
    document.getElementById('uc-dash-signout')?.addEventListener('click', () => {
      try { localStorage.removeItem('uc_auth'); } catch (e) { /* ignore */ }
      window.location.hash = '';
      window.location.reload();
    });
    // Header search → the directory, carrying the query (#network?q=…).
    document.querySelector('[data-uc-search]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = (e.target.querySelector('input')?.value || '').trim();
      window.location.hash = '#network' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
    // Connect / Message / Accept-match → open the messages drawer.
    // (Page modules may handle these themselves; data-uc-peer targets a real member.)
    document.querySelectorAll('[data-uc-connect],[data-uc-message]').forEach((b) =>
      b.addEventListener('click', () => window.UC && window.UC.openChat(b.dataset.ucPeer || undefined)));
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
      const newPage = parseHash().page;
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
        const h = parseHash();
        let page = h.page;
        if (!routes[page] || page === 'landing') { page = 'feed'; window.location.hash = '#feed'; }
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
  let _lastPage = null;
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

    // Animate only real page changes in a visible tab; same-page re-renders
    // (e.g. #network?q=a → #network?q=b) and hidden tabs render directly — an
    // aborted transition there could skip the render.
    const animate = document.startViewTransition && !document.hidden && pageName !== _lastPage;
    _lastPage = pageName;
    if (animate) {
      // If the browser skips the transition without running the callback,
      // render anyway — never leave the "Recalling…" placeholder on screen.
      let done = false;
      const once = () => { if (!done) { done = true; render(); } };
      try { document.startViewTransition(once).finished.catch(() => {}); } catch (e) { once(); }
      setTimeout(once, 600);
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
    }
    // Page modules (js/pages/*.js) register window.UCPages[page](root) and wire
    // everything page-specific: cross-links, filters, dialogs, live data.
    const mod = window.UCPages && window.UCPages[pageName];
    if (typeof mod === 'function') {
      try { mod(appViewport); } catch (err) { console.error('[UCPages:' + pageName + ']', err); }
    }
    if (window.Iconify) window.Iconify.scan(appViewport);
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

  /* Pages other than landing/feed are wired by their modules in js/pages/*.js
     (the legacy inline handlers that used to live here were retired). */

  // Load router
  initRouter();
});
