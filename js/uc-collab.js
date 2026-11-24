/* ==========================================================================
   UniCircle: collaboration requests (global script, window.UCCollab)
   - UCCollab.requestDialog(peerId, peerName)  "Ask <name> to collaborate"
   - UCCollab.mountInbox(el)                   Received / Sent lists
   - UCCollab.pendingCount()                   async number; fires 'uc:collab-count'
   - Delegated click: [data-uc-collab][data-uc-peer][data-name]
   The server enforces every rule; the UI explains it before the member types.
   ========================================================================== */
(function () {
  'use strict';
  const UC = window.UC;
  if (!UC) return;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const idOk = (id) => /^[a-z0-9]{1,32}$/i.test(String(id || ''));
  const me = () => (UC.state && UC.state.user) || null;
  const toast = (m, k) => { try { UC.toast(m, k || 'ok'); } catch (e) { /* no toast layer */ } };
  const KINDS = [
    ['internship', 'Internship'], ['mentoring', 'Mentoring'], ['project', 'Project'],
    ['event', 'Event'], ['other', 'Something else'],
  ];
  const KIND_LABEL = Object.fromEntries(KINDS);
  const STATUS_LABEL = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined' };
  const API = '/api/collections/collab_requests/records';
  const MAX = 500, MIN = 10;

  const nameOf = (u) => (u && (u.name || (u.email ? String(u.email).split('@')[0] : ''))) || 'Member';
  const kindOf = (k) => (KIND_LABEL[k] ? k : 'other');
  const statusOf = (s) => (STATUS_LABEL[s] ? s : 'pending');
  function avatar(u) {
    let src = '';
    try { src = UC.avatarUrl ? UC.avatarUrl(u, 64) : ''; } catch (e) { src = ''; }
    if (src) return '<img class="uc-cb-av" src="' + esc(src) + '" alt="" width="40" height="40" loading="lazy">';
    const ini = nameOf(u).trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
    return '<span class="uc-cb-av uc-cb-ini" aria-hidden="true">' + esc(ini) + '</span>';
  }
  function fmtDate(s) {
    const d = new Date(String(s || '').replace(' ', 'T'));
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const announce = (n) => { try { window.dispatchEvent(new CustomEvent('uc:collab-count', { detail: { count: n } })); } catch (e) { /* old browser */ } };

  // ----------------------------------------------------------- pending count
  async function pendingCount() {
    const u = me();
    if (!u || !idOk(u.id)) return 0;
    try {
      const flt = encodeURIComponent('to="' + u.id + '" && status="pending"');
      const r = await UC.api('GET', API + '?perPage=1&filter=' + flt);
      const n = Number(r && r.totalItems) || 0;
      announce(n);
      return n;
    } catch (e) { return 0; }
  }

  // ----------------------------------------------------------------- dialog
  function ruleFor(peer, name, mine) {
    const mode = peer.contact_mode || 'open';
    const n = '<strong>' + esc(name) + '</strong>';
    if (mode === 'points') {
      const need = Number(peer.min_points) || 0, have = Number(mine.points) || 0;
      if (have < need) return { block: true, html: n + ' asks for ' + need + ' status points first. You have ' + have + '. Earn points by closing mentorships, then try again.' };
      return { html: n + ' asks for ' + need + ' status points first. You have ' + have + ', so you can reach out.' };
    }
    if (mode === 'request') return { html: n + ' accepts collaboration requests. After they accept, you can message them.' };
    if (mode === 'closed') return { block: true, html: n + ' is not accepting new requests.' };
    return { html: 'Anyone can reach out to ' + n + '.' };
  }

  async function requestDialog(peerId, peerName) {
    const u = me();
    if (!u) { if (UC.openAuth) UC.openAuth('signin'); return; }
    if (!idOk(peerId)) return;
    if (peerId === u.id) { toast('You cannot send a request to yourself.', 'warn'); return; }
    const UCP = window.UCP;
    if (!UCP || !UCP.dialog) { toast('Please reload the page.', 'warn'); return; }

    let name = String(peerName || 'this member');
    const body = '<form class="uc-cb-form" novalidate>'
      + '<p class="uc-cb-rule" role="status" aria-live="polite">Checking how this member likes to be contacted…</p>'
      + '<p class="uc-cb-hint" hidden></p>'
      + '<label class="uc-cb-lbl" for="uc-cb-kind">What would you like to do together?</label>'
      + '<select id="uc-cb-kind" class="uc-cb-field">'
      + KINDS.map((k) => '<option value="' + k[0] + '">' + esc(k[1]) + '</option>').join('') + '</select>'
      + '<label class="uc-cb-lbl" for="uc-cb-msg">Message</label>'
      + '<textarea id="uc-cb-msg" class="uc-cb-field uc-cb-msg" maxlength="' + MAX + '" rows="5" '
      + 'placeholder="Say who you are and what you have in mind (at least ' + MIN + ' characters)."></textarea>'
      + '<div class="uc-cb-count" aria-hidden="true"><span id="uc-cb-n">0</span> / ' + MAX + '</div>'
      + '</form>';

    let sending = false, blocked = false, ready = false;
    const close = UCP.dialog({
      title: 'Ask ' + name + ' to collaborate', body,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Send request', primary: true,
          onClick: async (cl, d) => {
            if (sending || blocked) return;
            const msg = d.querySelector('#uc-cb-msg').value.trim();
            const kind = kindOf(d.querySelector('#uc-cb-kind').value);
            if (msg.length < MIN) { toast('Please write at least ' + MIN + ' characters.', 'warn'); d.querySelector('#uc-cb-msg').focus(); return; }
            sending = true; refresh();
            try {
              await UC.api('POST', API, { from: u.id, to: peerId, kind, message: msg.slice(0, MAX), status: 'pending' });
              cl();
              toast('Request sent to ' + name);
            } catch (err) {
              const m = String((err && err.message) || '');
              if (/unique|already|duplicate|pending/i.test(m) && !/not accepting|points/i.test(m)) toast('You already have a pending request to ' + name + '.', 'warn');
              else toast(m || 'Could not send the request.', 'warn');
              sending = false; refresh();
            }
          },
        },
      ],
    });
    const d = close && close.el;
    if (!d) return;
    const send = d.querySelector('.uc-dialog-actions button.uc-btn-dark');
    const ta = d.querySelector('#uc-cb-msg');
    function refresh() {
      const len = ta.value.length;
      d.querySelector('#uc-cb-n').textContent = String(len);
      if (send) send.disabled = sending || blocked || !ready || ta.value.trim().length < MIN;
    }
    ta.addEventListener('input', refresh);
    refresh();

    try {
      const peer = await UC.api('GET', '/api/collections/users/records/' + encodeURIComponent(peerId));
      if (!peerName) { name = nameOf(peer); const h = d.querySelector('.uc-dialog-head h3'); if (h) h.textContent = 'Ask ' + name + ' to collaborate'; }
      const rule = ruleFor(peer, name, u);
      blocked = !!rule.block;
      d.querySelector('.uc-cb-rule').innerHTML = rule.html;
      d.querySelector('.uc-cb-rule').classList.toggle('uc-cb-rule-stop', blocked);
      const acc = [];
      if (peer.accepts_internship) acc.push('internship');
      if (peer.accepts_mentoring) acc.push('mentoring');
      if (peer.accepts_collab) acc.push('project');
      if (acc.length) {
        d.querySelector('#uc-cb-kind').value = acc[0];
        const hint = d.querySelector('.uc-cb-hint');
        hint.textContent = name + ' is open to: ' + acc.map((k) => KIND_LABEL[k].toLowerCase()).join(', ') + '. This is a hint, you can pick anything.';
        hint.hidden = false;
      }
    } catch (err) {
      // rule unknown: let the server decide
      d.querySelector('.uc-cb-rule').textContent = 'Could not check the contact rule. The server will tell you if the request is not allowed.';
    }
    ready = true; refresh();
    ta.focus();
  }

  // ------------------------------------------------------------------ inbox
  function row(r, dir) {
    const other = (r.expand && (dir === 'in' ? r.expand.from : r.expand.to)) || { id: dir === 'in' ? r.from : r.to };
    const otherId = idOk(other.id) ? other.id : '';
    const st = statusOf(r.status), kind = kindOf(r.kind);
    let acts = '';
    if (dir === 'in' && st === 'pending') {
      acts = '<button type="button" class="uc-cb-btn uc-cb-yes" data-act="accept">Accept</button>'
        + '<button type="button" class="uc-cb-btn" data-act="decline">Decline</button>';
    } else if (dir === 'out' && st === 'pending') {
      acts = '<button type="button" class="uc-cb-btn" data-act="withdraw">Withdraw</button>';
    } else if (st === 'accepted' && otherId) {
      acts = '<button type="button" class="uc-cb-btn uc-cb-yes" data-act="message">Message</button>';
    }
    return '<li class="uc-cb-row" data-id="' + esc(r.id) + '" data-peer="' + esc(otherId) + '" data-dir="' + dir + '">'
      + avatar(other)
      + '<div class="uc-cb-main"><div class="uc-cb-top"><span class="uc-cb-name">' + esc(nameOf(other)) + '</span>'
      + '<span class="uc-cb-chip uc-cb-k-' + kind + '">' + esc(KIND_LABEL[kind]) + '</span>'
      + (dir === 'out' || st !== 'pending' ? '<span class="uc-cb-chip uc-cb-s-' + st + '">' + esc(STATUS_LABEL[st]) + '</span>' : '')
      + '<time class="uc-cb-date">' + esc(fmtDate(r.created)) + '</time></div>'
      + '<p class="uc-cb-text">' + esc(r.message) + '</p>'
      + (acts ? '<div class="uc-cb-acts">' + acts + '</div>' : '') + '</div></li>';
  }
  const empty = (t) => '<div class="uc-empty-orbit"><div class="uc-empty-nodes"><i></i><u></u><i></i></div><p>' + esc(t) + '</p></div>';

  async function mountInbox(el) {
    if (!el) return;
    const u = me();
    if (!u || !idOk(u.id)) { el.innerHTML = empty('Sign in to see your collaboration requests.'); return; }
    el.innerHTML = '<div class="uc-cb-inbox">'
      + '<h3 class="uc-cb-h uc-serif">Collaboration requests <span class="uc-cb-bubble" hidden></span></h3>'
      + '<div class="uc-cb-tabs" role="tablist" aria-label="Collaboration requests">'
      + '<button type="button" role="tab" class="uc-cb-tab" id="uc-cb-t-in" data-tab="in" aria-selected="true" aria-controls="uc-cb-p-in">Received</button>'
      + '<button type="button" role="tab" class="uc-cb-tab" id="uc-cb-t-out" data-tab="out" aria-selected="false" aria-controls="uc-cb-p-out" tabindex="-1">Sent</button></div>'
      + '<div class="uc-cb-panel" id="uc-cb-p-in" role="tabpanel" aria-labelledby="uc-cb-t-in"><p class="uc-cb-load">Loading…</p></div>'
      + '<div class="uc-cb-panel" id="uc-cb-p-out" role="tabpanel" aria-labelledby="uc-cb-t-out" hidden><p class="uc-cb-load">Loading…</p></div></div>';
    const bubble = el.querySelector('.uc-cb-bubble');
    const panels = { in: el.querySelector('#uc-cb-p-in'), out: el.querySelector('#uc-cb-p-out') };

    function setBubble(n) {
      bubble.textContent = String(n);
      bubble.hidden = !n;
      bubble.setAttribute('aria-label', n + ' pending');
    }
    async function recount() { setBubble(await pendingCount()); }
    function fill(dir, items) {
      panels[dir].innerHTML = items.length
        ? '<ul class="uc-cb-list uc-stagger">' + items.map((r) => row(r, dir)).join('') + '</ul>'
        : empty(dir === 'in' ? 'No requests yet. When someone asks to collaborate, it shows up here.' : 'You have not sent any requests yet.');
    }
    async function load(dir) {
      const f = dir === 'in' ? 'to="' + u.id + '"' : 'from="' + u.id + '"';
      try {
        const r = await UC.api('GET', API + '?perPage=50&sort=-created&expand=' + (dir === 'in' ? 'from' : 'to') + '&filter=' + encodeURIComponent(f));
        fill(dir, r.items || []);
      } catch (e) {
        panels[dir].innerHTML = '<p class="uc-cb-load">Could not load requests. ' + esc(e && e.message ? e.message : '') + '</p>';
      }
    }

    const tabs = el.querySelectorAll('.uc-cb-tab');
    function select(dir) {
      tabs.forEach((t) => {
        const on = t.dataset.tab === dir;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      panels.in.hidden = dir !== 'in'; panels.out.hidden = dir !== 'out';
    }
    tabs.forEach((t) => {
      t.addEventListener('click', () => select(t.dataset.tab));
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const to = t.dataset.tab === 'in' ? 'out' : 'in';
        select(to); el.querySelector('.uc-cb-tab[data-tab="' + to + '"]').focus();
      });
    });

    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b || !el.contains(b)) return;
      const li = b.closest('.uc-cb-row');
      const id = li && li.dataset.id, peer = li && li.dataset.peer, act = b.dataset.act;
      if (!idOk(id)) return;
      if (act === 'message') { if (idOk(peer) && UC.openChat) UC.openChat(peer); return; }
      if (act === 'withdraw') {
        if (!window.confirm('Withdraw this request?')) return;
        b.disabled = true;
        try {
          await UC.api('DELETE', API + '/' + id);
          li.remove();
          if (!panels.out.querySelector('.uc-cb-row')) fill('out', []);
          toast('Request withdrawn');
          recount();
        } catch (err) { b.disabled = false; toast((err && err.message) || 'Could not withdraw.', 'warn'); }
        return;
      }
      if (act === 'accept' || act === 'decline') {
        const status = act === 'accept' ? 'accepted' : 'declined';
        li.querySelectorAll('button').forEach((x) => { x.disabled = true; });
        try {
          const rec = await UC.api('PATCH', API + '/' + id, { status });
          const prev = li.querySelector('.uc-cb-av');
          const other = { id: peer, name: li.querySelector('.uc-cb-name').textContent };
          rec.expand = rec.expand || {};
          // keep the expanded sender we already rendered (PATCH returns it unexpanded)
          const tmp = document.createElement('div');
          tmp.innerHTML = row(Object.assign({}, rec, { expand: { from: other }, message: li.querySelector('.uc-cb-text').textContent, created: rec.created }), 'in');
          const fresh = tmp.firstElementChild;
          if (prev && fresh.querySelector('.uc-cb-av')) fresh.querySelector('.uc-cb-av').replaceWith(prev.cloneNode(true));
          li.replaceWith(fresh);
          toast(status === 'accepted' ? 'Request accepted' : 'Request declined');
          recount();
        } catch (err) {
          li.querySelectorAll('button').forEach((x) => { x.disabled = false; });
          toast((err && err.message) || 'Could not update the request.', 'warn');
        }
      }
    });

    await Promise.all([load('in'), load('out'), recount()]);
  }

  // ---------------------------------------------------- delegated open click
  function install() {
    if (document.documentElement.dataset.ucCollabBound) return;
    document.documentElement.dataset.ucCollabBound = '1';
    document.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('[data-uc-collab]');
      if (!t) return;
      e.preventDefault();
      if (!me()) { if (UC.openAuth) UC.openAuth('signin'); return; }
      requestDialog(t.getAttribute('data-uc-peer'), t.getAttribute('data-name') || '');
    });
  }
  install();

  window.UCCollab = Object.assign(window.UCCollab || {}, { requestDialog, mountInbox, pendingCount });
})();
