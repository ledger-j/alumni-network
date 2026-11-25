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
    const res = await fetch(routes[name] + '?v=13');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    pageCache[name] = html;
    return html;
  }

  // The one authenticated app shell: a dark-nuance side rail (Design System §5).
  // Every signed-in page is rendered inside it; only the main column swaps.
  // The menu is on the RIGHT (content left, navigation + messages right) and its
  // dots are real nodes of the constellation behind it (see js/uc-constellation.js).
  const RAIL_ITEMS = [
    ['feed', 'Feed', '235'], ['network', 'Network', '275'],
    ['map', 'Map', '25'], ['mentoring', 'Mentor & Tutor', '45'],
    ['events', 'Events', '305'], ['pbl-hub', 'Case Hub', '145'],
    ['jobs', 'Jobs', '185'], ['profile', 'My profile', '260']
  ];
  function railHtml(active) {
    const links = RAIL_ITEMS.map(function (it) {
      const on = active === it[0];
      return '<a href="#' + it[0] + '" class="uc-rail-link' + (on ? ' active' : '') + '" data-route="' + it[0] + '"'
        + ' style="--h:' + it[2] + '"' + (on ? ' aria-current="page"' : '') + '>'
        + '<span class="uc-rail-dot" aria-hidden="true"></span>' + it[1] + '</a>';
    }).join('');
    return '<nav class="uc-rail" aria-label="Primary">'
      + '<canvas class="uc-rail-canvas" aria-hidden="true"></canvas>'
      + '<div class="uc-rail-inner">'
      + '<a class="uc-rail-brand" href="#feed" aria-label="UniCircle home"><img src="assets/img/logo-u-badge-128.png" alt=""><span class="uc-serif">UniCircle</span></a>'
      + links
      + '<button type="button" class="uc-rail-link" id="uc-rail-msgs" data-route="messages" style="--h:25">'
      + '<span class="uc-rail-dot" aria-hidden="true"></span>Messages<span class="uc-rail-badge" id="uc-rail-badge" hidden>0</span></button>'
      + '<button type="button" class="uc-rail-link uc-jev-btn" id="uc-rail-jev" aria-pressed="false" aria-label="Talk to Jev, the assistant (shortcut V)" aria-keyshortcuts="v" style="--h:200"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>Jev</button>'
      + '<div class="uc-rail-spacer"></div>'
      + '<div class="uc-rail-dock" id="uc-dock" aria-label="Recent conversations"></div>'
      + '<button type="button" class="uc-rail-link" id="uc-dash-signout">← Sign out</button>'
      + '</div></nav>';
  }

  // Mount the rail constellation: anchors = the menu dots, hover draws a line to the
  // active dot, click sends a pulse along it. Anchor positions are re-measured on resize.
  let _railFx = null, _railRO = null;
  function mountRailFx(active) {
    if (_railFx) { _railFx.destroy(); _railFx = null; }
    if (_railRO) { _railRO.disconnect(); _railRO = null; }
    const rail = document.querySelector('.uc-rail');
    const canvas = rail && rail.querySelector('.uc-rail-canvas');
    if (!rail || !canvas || !window.UCConstellation) return;
    if (window.matchMedia('(max-width: 860px)').matches) return; // bottom bar: no canvas
    _railFx = window.UCConstellation.mount(canvas, {
      count: 46, wash: null, ink: '250,249,246', linkAlpha: 0.10, linkDist: 76, linkEvery: 2,
      pull: null, pointerRadius: 150, speed: 0.7, thread: true, anchorAlpha: 0.30,
      palette: (window.UCTheme && window.UCTheme.palette(0.74)) || ['oklch(0.74 0.14 235)', 'oklch(0.74 0.14 275)', 'oklch(0.74 0.14 305)', 'oklch(0.74 0.14 185)'],
      alpha: [0.35, 0.7]
    });
    if (!_railFx) return;
    const measure = () => {
      const box = canvas.getBoundingClientRect();
      const list = [];
      rail.querySelectorAll('.uc-rail-link[data-route]').forEach((a) => {
        const d = a.querySelector('.uc-rail-dot'); if (!d) return;
        const r = d.getBoundingClientRect();
        list.push({ id: a.dataset.route, hue: parseInt(a.style.getPropertyValue('--h'), 10) || 275,
          x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 });
      });
      _railFx.setAnchors(list);
    };
    measure();
    _railFx.setActive(active);
    if (window.ResizeObserver) { _railRO = new ResizeObserver(measure); _railRO.observe(rail); }
    rail.querySelector('.uc-rail-inner').addEventListener('scroll', measure, { passive: true });
    rail.querySelectorAll('.uc-rail-link[data-route]').forEach((a) => {
      a.addEventListener('pointerenter', () => _railFx && _railFx.hover(a.dataset.route));
      a.addEventListener('focus', () => _railFx && _railFx.hover(a.dataset.route));
      a.addEventListener('pointerleave', () => _railFx && _railFx.hover(null));
      a.addEventListener('blur', () => _railFx && _railFx.hover(null));
      a.addEventListener('click', () => { if (_railFx && a.dataset.route !== active) _railFx.pulse(active, a.dataset.route, 280); });
    });
  }

  // Common wiring for every shell page: profile, sign-out, header search.
  function initShell(pageName) {
    document.body.classList.add('uc-has-rail');
    mountRailFx(pageName);
    // "Messages" is not a route: it opens the chat panel.
    document.getElementById('uc-rail-msgs')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.UC) window.UC.openChat();
    });
    if (window.UCChat && window.UCChat.mountDock) window.UCChat.mountDock(document.getElementById('uc-dock'));
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
          // Guest clicks nav → the waitlist (public sign-up is closed)
          location.href = 'waitlist.html?ref=app-nav';
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

    // The member's own accent colour lives in their owner-only user_settings row; the device
    // copy (UCTheme) paints first, this makes it follow them to another device.
    function syncAccentFromServer() {
      const u = window.UC && window.UC.state && window.UC.state.user;
      if (!u || !window.UCTheme || !window.UC.state.online || !/^[a-z0-9]{1,32}$/i.test(u.id)) return;
      window.UC.api('GET', '/api/collections/user_settings/records?perPage=1&filter=' + encodeURIComponent('user="' + u.id + '"'))
        .then((r) => {
          const row = r && r.items && r.items[0];
          // Stored as 1..360 for a chosen hue (360 = hue 0); 0 or empty = the default brand look.
          const v = row ? Number(row.accent_hue) : NaN;
          if (row && !isNaN(v)) window.UCTheme.set(v === 0 ? null : v % 360);
        }).catch(() => { /* collection not live yet: keep the device colour */ });
    }

    // unicircle.js dispatches 'uc:auth-ready' once bootSession() resolves
    document.addEventListener('uc:auth-ready', (e) => {
      if (e.detail && e.detail.user) {
        _navReady = true;
        syncAccentFromServer();
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
      syncAccentFromServer();
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
        appViewport.innerHTML = '<div class="uc-dashboard-shell">'
          + '<div class="uc-main-col">' + html + '</div>' + railHtml(pageName) + '</div>';
      }
      document.body.classList.toggle('uc-has-rail', pageName !== 'landing');
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
      try {
        // A transition that is skipped (fast route changes, hidden tab, resize) rejects ready,
        // updateCallbackDone and finished; swallow all three so nothing surfaces as an
        // "Uncaught (in promise)" console error. The render still runs via `once`.
        const vt = document.startViewTransition(once);
        const quiet = () => {};
        vt.ready.catch(quiet); vt.updateCallbackDone.catch(quiet); vt.finished.catch(quiet);
      } catch (e) { once(); }
      setTimeout(once, 600);
    } else {
      render();
    }
  }

  // Initialize specific interactive scripts per component page
  function initializePageInteractivity(pageName) {
    if (pageName !== 'landing') initShell(pageName);
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
    const openSignup = () => { location.href = 'waitlist.html?ref=landing'; };   // sign-up closed
    const openSignin = () => window.UC?.openAuth('signin');

    // Nav + footer + feature CTAs open the full modal (LinkedIn / CSV import live there).
    document.getElementById('lp-bottom-join')?.addEventListener('click', openSignup);
    document.getElementById('lp-signin-link')?.addEventListener('click', (e) => { e.preventDefault(); openSignin(); });
    document.getElementById('lp-foot-signin')?.addEventListener('click', (e) => { e.preventDefault(); openSignin(); });

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

    // --- Waitlist is the hero action; sign-in is a quiet link for members ---
    window.UCWaitlist?.mount(document.getElementById('lp-wl'), document.getElementById('lp-wl-done'), { source: 'landing' });
    document.getElementById('lp-wl-signin')?.addEventListener('click', (e) => { e.preventDefault(); openSignin(); });
    const toWaitlist = (e) => {
      e.preventDefault();
      const card = document.getElementById('lp-waitlist');
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => card?.querySelector('input[name=email]')?.focus({ preventScroll: true }), 400);
    };
    document.getElementById('lp-nav-join')?.addEventListener('click', toWaitlist);
    document.querySelectorAll('a[href="#lp-waitlist"], .uc-lp-cta').forEach((a) => a.addEventListener('click', toWaitlist));

    // Constellation particle field behind the hero
    mountConstellation(document.getElementById('lp-constellation'), 340);
  }

  /* Paper-side constellation (landing hero, feed ribbon) = the shared engine with
     its defaults. Several can run at once; each cleans up when its canvas leaves the DOM. */
  let _ribbonFx = null;
  function mountConstellation(canvas, count, palette) {
    if (!canvas || !window.UCConstellation) return null;
    const opts = { count: count };
    if (palette) opts.palette = palette;
    return window.UCConstellation.mount(canvas, opts);
  }

  // A member picked (or cleared) an accent colour: recolour the live canvases in place.
  document.addEventListener('uc:theme', () => {
    const T = window.UCTheme;
    const rail = T && T.palette(0.74);
    if (_railFx) {
      if (rail) _railFx.setPalette(rail);
      else _railFx.setPalette(['oklch(0.74 0.14 235)', 'oklch(0.74 0.14 275)', 'oklch(0.74 0.14 305)', 'oklch(0.74 0.14 185)']);
    }
    if (_ribbonFx && _ribbonFx.setPalette) {
      const pp = T && T.palette(0.62);
      _ribbonFx.setPalette(pp || ['oklch(0.62 0.14 235)', 'oklch(0.62 0.14 275)', 'oklch(0.62 0.14 305)', 'oklch(0.62 0.14 185)']);
    }
  });

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
    _ribbonFx = mountConstellation(document.getElementById('uc-ribbon-canvas'), 90, window.UCTheme && window.UCTheme.palette(0.62));
    if (window.Iconify) window.Iconify.scan(appViewport);
  }

  /* Pages other than landing/feed are wired by their modules in js/pages/*.js
     (the legacy inline handlers that used to live here were retired). */

  // Load router
  initRouter();
});
