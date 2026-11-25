/* ==========================================================================
   UniCircle — hidden entrances (loaded BEFORE js/app.js).
   #enter/<key>  tester link: the key is stripped from the URL at once (kept in memory only),
                 the tester types a first name, POST /api/uc/tester/enter signs them in with the
                 same session path as every other sign-in (UC.completeAuth -> uc_auth + uc:login).
   #signin       members and team: opens the sign-in modal (public sign-up is closed).
   Tester banner: a slim notice while the signed-in member has tester = true.
   ========================================================================== */
(function () {
  'use strict';

  const FEEDBACK = 'hello@unicircle.eu';
  const NAME_OK = /^[A-Za-zÀ-ÖØ-öø-ɏ' -]{1,40}$/;
  const clean = () => history.replaceState(null, '', location.pathname + location.search);

  // Strip the key before anything else (router, analytics, screenshots) can see it.
  let key = null;
  const m = /^#enter\/([^?&#\s]+)/.exec(location.hash);
  if (m) { try { key = decodeURIComponent(m[1]); } catch (e) { key = m[1]; } clean(); }
  let wantSignin = location.hash === '#signin';
  if (wantSignin) clean();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function errorText(err) {
    const st = err && err.status;
    if (st === 403) return 'This test link is not valid.';
    if (st === 501) return 'Test access is closed right now.';
    if (st === 429) return 'Too many tries, wait 10 minutes.';
    if (st === 400 || st === 409) return (err && err.message) || 'Use 1 to 40 letters for your first name.';
    return 'Could not reach UniCircle. Check your connection and try again.';
  }

  function openEnter() {
    const UC = window.UC;
    if (!UC) return;
    document.querySelectorAll('.uc-modal-host').forEach((n) => n.remove());
    const host = document.createElement('div');
    host.className = 'uc-modal-host';
    host.innerHTML = `
      <div class="uc-modal-backdrop"></div>
      <div class="uc-modal" role="dialog" aria-modal="true" aria-labelledby="uc-enter-title">
        <div class="uc-modal-head"><h3 id="uc-enter-title"><img src="assets/img/logo-u-64.png" alt="">Welcome, <em>tester.</em></h3><button class="uc-x" aria-label="Close">✕</button></div>
        <div class="uc-modal-body">
          <form class="uc-form" id="uc-enter-form">
            <p class="uc-hint">Thanks for helping us test UniCircle. No password needed.</p>
            <label>Your first name <input name="name" required maxlength="40" autocomplete="given-name" placeholder="e.g. Anna"></label>
            <button class="uc-primary" type="submit">Enter UniCircle</button>
            <p class="uc-err" hidden></p>
          </form>
        </div>
      </div>`;
    document.body.appendChild(host);
    const opener = document.activeElement;
    const close = () => { host.remove(); document.removeEventListener('keydown', onEsc); if (opener && opener.focus) try { opener.focus(); } catch (e) { /* ignore */ } };
    const onEsc = (ev) => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);
    host.querySelector('.uc-x').onclick = close;
    host.querySelector('.uc-modal-backdrop').onclick = close;
    const form = host.querySelector('#uc-enter-form');
    const errEl = form.querySelector('.uc-err');
    const btn = form.querySelector('.uc-primary');
    form.name.focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      errEl.hidden = true;
      const name = form.name.value.trim().replace(/\s+/g, ' ');
      if (!NAME_OK.test(name)) { errEl.textContent = 'Use 1 to 40 letters for your first name (spaces, - and \' are fine).'; errEl.hidden = false; return; }
      btn.disabled = true;
      try {
        // One device secret per tester name on this browser: re-entering with the same name finds the
        // same account here, but someone else typing that name elsewhere gets their own account.
        const DK = 'uc_tester_dev_' + name.toLowerCase();
        let device = '';
        try { device = localStorage.getItem(DK) || ''; } catch (_) { /* private mode */ }
        const r = await UC.api('POST', '/api/uc/tester/enter', { key, name, device }, { auth: false });
        key = null;
        if (r && r.device) { try { localStorage.setItem(DK, r.device); } catch (_) { /* private mode */ } delete r.device; }
        UC.completeAuth(r, close);           // stores uc_auth, fires uc:login -> app.js routes to #feed
        if (location.hash !== '#feed') location.hash = '#feed';
      } catch (err) {
        errEl.textContent = errorText(err);
        errEl.hidden = false;
      } finally { btn.disabled = false; }
    };
  }

  // ---------------------------------------------------------------- tester banner
  function updateBanner() {
    const u = window.UC && window.UC.state && window.UC.state.user;
    let bar = document.getElementById('uc-tester-banner');
    if (!(u && u.tester)) { if (bar) bar.remove(); return; }
    if (bar) return;
    if (!document.getElementById('uc-tester-banner-css')) {
      const st = document.createElement('style');
      st.id = 'uc-tester-banner-css';
      st.textContent = '#uc-tester-banner{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;'
        + 'padding:8px 16px;background:var(--uc-panel,#3a3934);color:var(--uc-bg,#faf9f6);font:500 13px/1.4 var(--uc-font-body,system-ui,sans-serif);text-align:center;}'
        + '#uc-tester-banner a{color:inherit;font-weight:700;text-decoration:underline;text-underline-offset:2px;display:inline-flex;align-items:center;min-height:24px;padding:0 4px;}'
        + '#uc-tester-banner a:focus-visible{outline:2px solid var(--uc-bg,#faf9f6);outline-offset:2px;}';
      document.head.appendChild(st);
    }
    bar = document.createElement('div');
    bar.id = 'uc-tester-banner';
    bar.setAttribute('role', 'note');
    bar.innerHTML = '<span>Test environment — thanks for testing UniCircle, ' + esc(String(u.name || '').split(' ')[0]) + '.</span>'
      + '<a href="mailto:' + FEEDBACK + '?subject=' + encodeURIComponent('UniCircle test feedback') + '">Give feedback</a>';
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function onReady() {
    const UC = window.UC;
    if (key) {
      if (UC && UC.state && UC.state.user) { key = null; if (location.hash !== '#feed') location.hash = '#feed'; }
      else openEnter();
    } else if (wantSignin && UC && !(UC.state && UC.state.user)) {
      UC.openAuth('signin');
    }
    wantSignin = false;
    updateBanner();
  }

  document.addEventListener('uc:auth-ready', onReady);
  document.addEventListener('uc:login', updateBanner);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#signin') {
      clean();
      if (window.UC && !(window.UC.state && window.UC.state.user)) window.UC.openAuth('signin');
    }
    updateBanner();
  });
  // Sign-out has no event: re-check the banner after any sign-out button click.
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('[data-act="signout"],[data-act="logout"],#uc-signout,.uc-signout')) setTimeout(updateBanner, 50);
  });
})();
