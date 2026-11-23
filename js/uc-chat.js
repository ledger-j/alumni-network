/* ==========================================================================
   UniCircle — live 1:1 chat (PocketBase realtime over SSE, polling fallback)
   - UCChat.open(peerId?)      open the chat panel (optionally on one person)
   - UCChat.mountDock(el)      conversations + "say hello" prompts inside the rail
   - UCChat.unread()           unread incoming messages
   Loads after js/unicircle.js and takes over window.UC.openChat.
   Talks to PocketBase with plain fetch + EventSource (no SDK), like the rest.
   ========================================================================== */
(function () {
  'use strict';
  const UC = window.UC;
  if (!UC) return;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const API = () => UC.API;
  const me = () => (UC.state && UC.state.user) || null;
  const idOk = (id) => /^[a-z0-9]{1,32}$/i.test(String(id || ''));   // PB ids are 15 alphanumerics; this keeps filters injection-safe

  // ---------------------------------------------------------------- state
  const S = {
    users: new Map(),          // id -> user record (cache)
    convos: new Map(),         // peerId -> {peer, last, unread}
    peers: [],                 // directory (for "say hello")
    open: false, peerId: null, thread: [],
    es: null, clientId: null, poll: null, started: false, live: false,
    docks: new Set(),
  };

  // ------------------------------------------------------------- helpers
  const hueOf = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const nameOf = (u) => (u && (u.name || (u.email ? u.email.split('@')[0] : ''))) || 'Member';
  const initials = (u) => nameOf(u).trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  function avatar(u, cls) {
    if (u && u.avatar && u.collectionId) {
      return '<img class="' + (cls || '') + '" src="' + esc(API() + '/api/files/' + u.collectionId + '/' + u.id + '/' + u.avatar) + '" alt="">';
    }
    return '<span class="uc-dock-ini ' + (cls || '') + '" style="--h:' + hueOf(u && u.id) + '" aria-hidden="true">' + esc(initials(u)) + '</span>';
  }
  const peerOf = (m) => (m.sender === me().id ? m.recipient : m.sender);
  const cache = (u) => { if (u && u.id) S.users.set(u.id, u); };

  async function loadUsers(ids) {
    const need = ids.filter((i) => idOk(i) && !S.users.has(i));
    if (!need.length) return;
    const flt = need.map((i) => 'id="' + i + '"').join(' || ');
    try {
      const r = await UC.api('GET', '/api/collections/users/records?perPage=50&filter=' + encodeURIComponent(flt));
      (r.items || []).forEach(cache);
    } catch (e) { /* peer shows as "Member" */ }
  }

  // ------------------------------------------------------ conversations
  async function refreshConvos() {
    if (!me()) return;
    let items = [];
    try {
      const r = await UC.api('GET', '/api/collections/messages/records?perPage=200&sort=-created');
      items = r.items || [];
    } catch (e) { return; }
    const map = new Map();
    for (const m of items) {                       // newest first
      const pid = peerOf(m); if (!pid) continue;
      const c = map.get(pid) || { peerId: pid, last: m, unread: 0 };
      if (m.recipient === me().id && !m.read) c.unread++;
      map.set(pid, c);
    }
    await loadUsers([...map.keys()]);
    S.convos = new Map([...map].map(([k, v]) => [k, Object.assign(v, { peer: S.users.get(k) || { id: k } })]));
    renderAll();
  }

  async function loadDirectory() {
    if (S.peers.length || !me()) return;
    try {
      const r = await UC.api('GET', '/api/collections/users/records?perPage=50&sort=-mentor&filter=' +
        encodeURIComponent('id != "' + me().id + '"'));
      S.peers = r.items || []; S.peers.forEach(cache);
    } catch (e) { S.peers = []; }
  }

  const unread = () => { let n = 0; S.convos.forEach((c) => { n += c.unread; }); return n; };

  // -------------------------------------------------------------- render
  function renderBadge() {
    const n = unread();
    const b = document.getElementById('uc-rail-badge');
    if (b) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = n === 0; }
    document.title = (n ? '(' + n + ') ' : '') + document.title.replace(/^\(\d+\)\s*/, '');
  }

  function convoRows() {
    return [...S.convos.values()].sort((a, b) => (a.last.created < b.last.created ? 1 : -1));
  }

  function renderDock(el) {
    if (!el || !el.isConnected) { S.docks.delete(el); return; }
    const rows = convoRows().slice(0, 3);
    const total = unread();
    let body;
    if (rows.length) {
      body = '<div class="uc-dock-list">' + rows.map((c) => (
        '<button type="button" class="uc-dock-peer" data-peer="' + esc(c.peerId) + '">' + avatar(c.peer) +
        '<span><b>' + esc(nameOf(c.peer)) + '</b><small>' + esc(c.last.text) + '</small></span>' +
        (c.unread ? '<span class="uc-node" aria-label="' + c.unread + ' unread"></span>' : '') + '</button>'
      )).join('') + '</div>';
    } else {
      const sug = S.peers.slice(0, 3);
      body = '<p class="uc-dock-hello">No conversations yet. The first hello is the hardest — say it to someone from your programme.</p>' +
        (sug.length ? '<div class="uc-dock-list">' + sug.map((u) => (
          '<button type="button" class="uc-dock-peer" data-peer="' + esc(u.id) + '">' + avatar(u) +
          '<span><b>' + esc(nameOf(u)) + '</b><small>' + esc(u.mentor ? 'Mentor · say hello' : (u.headline || 'Say hello')) + '</small></span></button>'
        )).join('') + '</div>' : '');
    }
    el.innerHTML = '<div class="uc-dock-head">Messages' + (total ? ' <span class="uc-node" aria-hidden="true"></span>' : '') +
      '<button type="button" class="uc-dock-open" data-open>Open</button></div>' + body +
      '<button type="button" class="uc-dock-cta" data-open>' + (rows.length ? 'All conversations' : 'Start a conversation') + '</button>';
  }

  function wireDock(el) {
    el.addEventListener('click', (e) => {
      const p = e.target.closest('[data-peer]');
      if (p) { open(p.dataset.peer); return; }
      if (e.target.closest('[data-open]')) open();
    });
  }

  function renderPeers() {
    const box = document.getElementById('uc-peers'); if (!box) return;
    const have = new Set(S.convos.keys());
    const convoHtml = convoRows().map((c) => peerBtn(c.peer, c.unread, c.peerId === S.peerId, c.last.text)).join('');
    const others = S.peers.filter((u) => !have.has(u.id));
    box.innerHTML = (convoHtml ? '<p class="uc-hint uc-peer-h">Conversations</p>' + convoHtml : '') +
      (others.length ? '<p class="uc-hint uc-peer-h">Say hello</p>' + others.map((u) => peerBtn(u, 0, u.id === S.peerId, u.mentor ? 'Mentor' : '')).join('') : '') ||
      '<p class="uc-hint" style="padding:12px">No other members yet — invite some!</p>';
  }
  function peerBtn(u, n, active, sub) {
    return '<button class="uc-peer' + (active ? ' active' : '') + '" data-id="' + esc(u.id) + '">' + avatar(u) +
      '<span>' + esc(nameOf(u)) + (sub ? '<br><small style="font-weight:400;color:var(--uc-muted)">' + esc(String(sub).slice(0, 28)) + '</small>' : '') + '</span>' +
      (n ? '<span class="uc-node" aria-label="' + n + ' unread"></span>' : '') + '</button>';
  }

  function renderThread() {
    const box = document.getElementById('uc-msgs'); if (!box) return;
    const my = me().id;
    box.innerHTML = S.thread.map((m) => '<div class="uc-msg ' + (m.sender === my ? 'mine' : '') + '" data-id="' + esc(m.id) + '">' + esc(m.text) + '</div>').join('') ||
      '<p class="uc-hint" style="padding:16px">Say hello.</p>';
    box.scrollTop = box.scrollHeight;
  }

  function renderAll() {
    renderBadge();
    S.docks.forEach(renderDock);
    renderPeers();
  }

  // ---------------------------------------------------------------- panel
  function ensurePanel() {
    let d = document.getElementById('uc-chat');
    if (d) return d;
    d = document.createElement('div'); d.id = 'uc-chat';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Messages');
    d.innerHTML =
      '<div class="uc-chat-head"><b>Messages</b><button class="uc-x" aria-label="Close messages">✕</button></div>' +
      '<div class="uc-chat-cols"><div class="uc-chat-peers" id="uc-peers"></div>' +
      '<div class="uc-chat-thread"><div class="uc-thread-msgs" id="uc-msgs" aria-live="polite"><p class="uc-hint" style="padding:16px">Pick someone to start chatting.</p></div>' +
      '<form class="uc-thread-form" id="uc-msg-form" hidden><input id="uc-msg-input" placeholder="Write a message…" autocomplete="off" maxlength="2000" aria-label="Message">' +
      '<button class="uc-primary" type="submit">Send</button></form></div></div>';
    document.body.appendChild(d);
    d.querySelector('.uc-x').onclick = close;
    d.querySelector('#uc-msg-form').onsubmit = send;
    d.addEventListener('click', (e) => { const b = e.target.closest('.uc-peer'); if (b) selectPeer(b.dataset.id); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.open) close(); });
    return d;
  }

  async function open(peerId) {
    if (!me()) { UC.openAuth('signin'); return; }
    if (!UC.auth.requireBackend()) return;
    start();
    const d = ensurePanel();
    d.classList.add('open'); S.open = true;
    await loadDirectory();
    renderPeers();
    if (peerId) await selectPeer(peerId);
    else if (!S.peerId) d.querySelector('#uc-peers .uc-peer')?.focus?.();
    refreshConvos();
  }
  function close() {
    document.getElementById('uc-chat')?.classList.remove('open');
    S.open = false;
  }

  async function selectPeer(id) {
    if (!idOk(id)) return;
    S.peerId = id;
    await loadUsers([id]);
    document.getElementById('uc-msg-form').hidden = false;
    document.querySelectorAll('#uc-peers .uc-peer').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
    const my = me().id;
    const flt = '(sender="' + my + '" && recipient="' + id + '") || (sender="' + id + '" && recipient="' + my + '")';
    try {
      const r = await UC.api('GET', '/api/collections/messages/records?perPage=100&sort=created&filter=' + encodeURIComponent(flt));
      S.thread = r.items || [];
    } catch (e) { S.thread = []; }
    renderThread();
    markRead(id);
    document.getElementById('uc-msg-input')?.focus();
  }

  async function markRead(peerId) {
    const mine = S.thread.filter((m) => m.recipient === me().id && !m.read);
    const c = S.convos.get(peerId);
    if (c) c.unread = 0;
    renderAll();
    await Promise.all(mine.map((m) => UC.api('PATCH', '/api/collections/messages/records/' + m.id, { read: true })
      .then(() => { m.read = true; }).catch(() => {})));
  }

  async function send(e) {
    e.preventDefault();
    const inp = document.getElementById('uc-msg-input');
    const text = inp.value.trim(); if (!text || !S.peerId) return;
    inp.value = '';
    try {
      const rec = await UC.api('POST', '/api/collections/messages/records',
        { sender: me().id, recipient: S.peerId, text, read: false });
      addMessage(rec);                       // optimistic-by-response; realtime echo is de-duplicated
    } catch (err) { UC.toast('Could not send.', 'warn'); inp.value = text; }
  }

  // --------------------------------------------- incoming (realtime/poll)
  function addMessage(m) {
    if (!m || !me()) return;
    const my = me().id;
    if (m.sender !== my && m.recipient !== my) return;
    const pid = peerOf(m);
    const inThread = S.open && S.peerId === pid;
    if (inThread && !S.thread.some((x) => x.id === m.id)) { S.thread.push(m); renderThread(); }
    const c = S.convos.get(pid) || { peerId: pid, last: m, unread: 0, peer: S.users.get(pid) || { id: pid } };
    const seen = c.seenIds || (c.seenIds = new Set());
    const fresh = !seen.has(m.id); seen.add(m.id);
    if (!c.last || c.last.created <= m.created) c.last = m;
    if (m.recipient === my && !m.read && fresh) {
      if (inThread) { markReadOne(m); }
      else {
        c.unread++;
        UC.toast('<b>' + esc(nameOf(c.peer)) + '</b>: ' + esc(String(m.text).slice(0, 60)));
        pulseRail();
      }
    }
    S.convos.set(pid, c);
    if (!S.users.has(pid)) loadUsers([pid]).then(() => { c.peer = S.users.get(pid) || c.peer; renderAll(); });
    renderAll();
  }
  function markReadOne(m) {
    UC.api('PATCH', '/api/collections/messages/records/' + m.id, { read: true }).then(() => { m.read = true; }).catch(() => {});
  }
  function pulseRail() {
    const a = document.getElementById('uc-rail-msgs'); if (!a) return;
    const fx = document.querySelector('.uc-rail-canvas');
    fx && fx.__ucConstellation && fx.__ucConstellation.pulse('feed', 'messages', 280);
  }

  // ----------------------------------------------------------- realtime
  function connectSSE() {
    if (S.es || !window.EventSource) return false;
    try {
      const es = new EventSource(API() + '/api/realtime');
      S.es = es;
      es.addEventListener('PB_CONNECT', async (ev) => {
        try { S.clientId = JSON.parse(ev.data).clientId || ev.lastEventId; } catch (e) { S.clientId = ev.lastEventId; }
        try {
          await UC.api('POST', '/api/realtime', { clientId: S.clientId, subscriptions: ['messages'] });
          S.live = true; stopPoll();
        } catch (e) { S.live = false; startPoll(); }
      });
      es.addEventListener('messages', (ev) => {
        try { const d = JSON.parse(ev.data); if (d.action === 'create') addMessage(d.record); } catch (e) { /* ignore */ }
      });
      es.onerror = () => { S.live = false; startPoll(); };     // EventSource retries by itself
      return true;
    } catch (e) { return false; }
  }
  function startPoll() { if (!S.poll) S.poll = setInterval(() => { refreshConvos(); if (S.open && S.peerId) pollThread(); }, 6000); }
  function stopPoll() { if (S.poll) { clearInterval(S.poll); S.poll = null; } }
  async function pollThread() {
    const id = S.peerId, my = me().id;
    const flt = '(sender="' + my + '" && recipient="' + id + '") || (sender="' + id + '" && recipient="' + my + '")';
    try {
      const r = await UC.api('GET', '/api/collections/messages/records?perPage=100&sort=created&filter=' + encodeURIComponent(flt));
      if ((r.items || []).length !== S.thread.length) { S.thread = r.items; renderThread(); markRead(id); }
    } catch (e) { /* keep */ }
  }

  function start() {
    if (S.started || !me() || !UC.state.online) return;
    S.started = true;
    loadDirectory().then(() => refreshConvos());
    if (!connectSSE()) startPoll();
  }
  function stop() {
    if (S.es) { S.es.close(); S.es = null; }
    stopPoll(); S.started = false; S.convos = new Map(); S.live = false;
  }

  function mountDock(el) {
    if (!el) return;
    if (!me()) { el.hidden = true; return; }
    S.docks.forEach((d) => { if (!d.isConnected) S.docks.delete(d); });
    S.docks.add(el);
    wireDock(el);
    renderDock(el);
    start();
    loadDirectory().then(() => renderDock(el));
  }

  // let the panel/chat keep working for pages that call UC.openChat(peerId)
  UC.openChat = open;
  document.addEventListener('uc:login', () => { stop(); start(); });
  window.UCChat = { open, close, mountDock, unread, start, stop, _state: S };
})();
