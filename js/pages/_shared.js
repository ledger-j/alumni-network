/* ==========================================================================
   UniCircle — page-module contract (shared by js/pages/*.js)

   Every page module registers ONE init function:
       window.UCPages.<route> = function (root) { … }
   app.js calls it after the page partial renders (root = #app-viewport) and
   then runs Iconify.scan(root). Modules must be idempotent per render (the DOM
   is fresh each time) and must never throw (app.js catches + logs anyway).

   Helpers on window.UCP (app.js adds UCP.params()):
     UCP.esc(s)            HTML-escape
     UCP.toast(msg, kind)  toast via the living-network layer ('ok' | 'warn')
     UCP.go(page, params)  navigate: UCP.go('network', {q:'finance'}) → #network?q=finance
     UCP.user()            signed-in PocketBase user record or null
     UCP.api(method, path, body)   authed REST call to PocketBase (throws {status})
     UCP.online()          true when the backend answered /api/health
     UCP.dialog({title, body, actions:[{label, primary, onClick(close)}]}) → close()
     UCP.store(key, value?) per-viewer localStorage (try/catch; for toggles like RSVP)
   ========================================================================== */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};
  const UCP = (window.UCP = window.UCP || {});

  UCP.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  UCP.toast = (msg, kind) => {
    if (window.UC && window.UC.toast) return window.UC.toast(msg, kind || 'ok');
    console.log('[toast]', msg);
  };

  UCP.go = (page, params) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    window.location.hash = '#' + page + (qs ? '?' + qs : '');
  };

  UCP.user = () => (window.UC && window.UC.state && window.UC.state.user) || null;
  UCP.online = () => !!(window.UC && window.UC.state && window.UC.state.online);
  UCP.api = (method, path, body) => window.UC.api(method, path, body);

  UCP.store = (key, value) => {
    const k = 'uc_p_' + key;
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(k) || 'null');
      localStorage.setItem(k, JSON.stringify(value));
    } catch (e) { /* private mode: degrade to no persistence */ }
    return value;
  };

  // Accessible modal on the shared .uc-modal styles (focus-trapped by <dialog>).
  UCP.dialog = ({ title, body, actions }) => {
    const d = document.createElement('dialog');
    d.className = 'uc-dialog';
    d.innerHTML = '<div class="uc-dialog-head"><h3 class="uc-serif">' + UCP.esc(title) + '</h3>'
      + '<button type="button" class="uc-dialog-x" aria-label="Close">×</button></div>'
      + '<div class="uc-dialog-body">' + (body || '') + '</div>'
      + '<div class="uc-dialog-actions"></div>';
    const close = () => { d.close(); d.remove(); };
    d.querySelector('.uc-dialog-x').addEventListener('click', close);
    d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    d.addEventListener('click', (e) => { if (e.target === d) close(); });
    const bar = d.querySelector('.uc-dialog-actions');
    (actions || [{ label: 'Close' }]).forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = a.primary ? 'uc-btn-dark' : 'uc-btn-ghost';
      b.textContent = a.label;
      b.addEventListener('click', () => (a.onClick ? a.onClick(close, d) : close()));
      bar.appendChild(b);
    });
    document.body.appendChild(d);
    d.showModal();
    if (window.Iconify) window.Iconify.scan(d);
    return close;
  };
})();
