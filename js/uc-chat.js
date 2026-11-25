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
    docks: new Set(), refreshing: false, queue: [],
    // groups
    groups: new Map(),         // conversation id -> {id,title,owner,members[],created,last}
    tab: 'direct', gid: null, gthread: [], gids: new Set(), gtoast: new Map(),
    seen: null, sheet: null, pick: null,
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
    S.refreshing = true; S.queue = [];            // SSE messages that land while we fetch are replayed below
    let items = [];
    try {
      const r = await UC.api('GET', '/api/collections/messages/records?perPage=200&sort=-created');
      items = r.items || [];
    } catch (e) { S.refreshing = false; return; }
    const map = new Map(), serverIds = new Set();
    for (const m of items) {                       // newest first
      const pid = peerOf(m); if (!pid) continue;
      serverIds.add(m.id);
      const c = map.get(pid) || { peerId: pid, last: m, unread: 0, seenIds: new Set() };
      c.seenIds.add(m.id);                         // already counted: a late duplicate must not count again
      if (m.recipient === me().id && !m.read) c.unread++;
      map.set(pid, c);
    }
    await loadUsers([...map.keys()]);
    S.convos = new Map([...map].map(([k, v]) => [k, Object.assign(v, { peer: S.users.get(k) || { id: k } })]));
    S.refreshing = false;
    const late = S.queue; S.queue = [];
    late.forEach((m) => { if (!serverIds.has(m.id)) addMessage(m); });   // arrived after the snapshot
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

  const unread = () => { let n = 0; S.convos.forEach((c) => { n += c.unread; }); S.groups.forEach((g) => { if (gUnread(g)) n++; }); return n; };

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
    const rows = dockRows();
    const total = unread();
    let body;
    if (rows.length) {
      body = '<div class="uc-dock-list">' + rows.map((r) => {
        if (r.g) {
          const g = r.g, lu = g.last && S.users.get(g.last.sender);
          return '<button type="button" class="uc-dock-peer" data-group="' + esc(g.id) + '">' + gAv(lu || { id: g.last && g.last.sender }, 64) +
            '<span><b>' + GLYPH + esc(g.title) + '</b><small>' + esc(g.last ? g.last.text : '') + '</small></span>' +
            '<span class="uc-node" aria-label="unread"></span></button>';
        }
        const c = r.c;
        return '<button type="button" class="uc-dock-peer" data-peer="' + esc(c.peerId) + '">' + avatar(c.peer) +
          '<span><b>' + esc(nameOf(c.peer)) + '</b><small>' + esc(c.last.text) + '</small></span>' +
          (c.unread ? '<span class="uc-node" aria-label="' + c.unread + ' unread"></span>' : '') + '</button>';
      }).join('') + '</div>';
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
      const gp = e.target.closest('[data-group]');
      if (gp) { openGroup(gp.dataset.group); return; }
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
    renderGroups();
  }

  // ---------------------------------------------------------------- panel
  function ensurePanel() {
    let d = document.getElementById('uc-chat');
    if (d) return d;
    d = document.createElement('div'); d.id = 'uc-chat';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Messages');
    d.innerHTML =
      '<div class="uc-chat-head"><b>Messages</b><button class="uc-x" aria-label="Close messages">✕</button></div>' +
      '<div class="uc-chat-tabs" role="tablist" aria-label="Conversation type">' +
      '<button type="button" role="tab" id="uc-tab-direct" data-tab="direct" aria-selected="true" aria-controls="uc-chat-cols" tabindex="0">Direct</button>' +
      '<button type="button" role="tab" id="uc-tab-groups" data-tab="groups" aria-selected="false" aria-controls="uc-chat-cols" tabindex="-1">Groups<span class="uc-node" id="uc-tab-dot" hidden aria-label="unread groups"></span></button></div>' +
      '<div class="uc-chat-cols" id="uc-chat-cols" role="tabpanel"><div class="uc-chat-peers" id="uc-peers"></div>' +
      '<div class="uc-chat-peers uc-glist" id="uc-groups" hidden></div>' +
      '<div class="uc-chat-thread"><div class="uc-thread-msgs" id="uc-msgs" aria-live="polite"><p class="uc-hint" style="padding:16px">Pick someone to start chatting.</p></div>' +
      '<form class="uc-thread-form" id="uc-msg-form" hidden><input id="uc-msg-input" placeholder="Write a message…" autocomplete="off" maxlength="2000" aria-label="Message">' +
      '<button class="uc-primary" type="submit">Send</button></form>' +
      '<div class="uc-gthread" id="uc-gthread" hidden>' +
      '<p class="uc-hint uc-gempty" id="uc-gempty">Pick a group, or start a new one.</p>' +
      '<div class="uc-gbody" id="uc-gbody" hidden>' +
      '<div class="uc-ghead"><b id="uc-gtitle-h"></b><button type="button" class="uc-gbtn" id="uc-gmembers-btn" aria-haspopup="dialog"></button></div>' +
      '<div class="uc-thread-msgs" id="uc-gmsgs" aria-live="polite"></div>' +
      '<form class="uc-thread-form" id="uc-gmsg-form"><input id="uc-gmsg-input" placeholder="Write to the group…" autocomplete="off" maxlength="2000" aria-label="Group message">' +
      '<button class="uc-primary" type="submit">Send</button></form></div></div>' +
      '</div></div>' +
      '<div class="uc-gsheet" id="uc-gsheet" role="dialog" aria-modal="true" aria-labelledby="uc-gsheet-t" hidden></div>';
    document.body.appendChild(d);
    d.querySelector('.uc-x').onclick = close;
    d.querySelector('#uc-msg-form').onsubmit = send;
    d.addEventListener('click', (e) => { const b = e.target.closest('.uc-peer:not(.uc-gitem):not(.uc-gnew)'); if (b) selectPeer(b.dataset.id); });
    wireGroups(d);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.open) close(); });
    return d;
  }

  async function open(peerId) {
    if (!me()) { UC.openAuth('signin'); return; }
    if (!UC.auth.requireBackend()) return;
    start();
    const d = ensurePanel();
    d.classList.add('open'); S.open = true;
    if (peerId) setTab('direct');
    await loadDirectory();
    renderPeers();
    if (peerId) await selectPeer(peerId);
    else if (S.tab === 'direct' && !S.peerId) d.querySelector('#uc-peers .uc-peer')?.focus?.();
    refreshConvos(); refreshGroups();
  }
  function close() {
    closeSheet();
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
    if (S.refreshing) S.queue.push(m);
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
          await UC.api('POST', '/api/realtime', { clientId: S.clientId, subscriptions: ['messages', 'conversation_messages'] });
          S.live = true; stopPoll();
        } catch (e) { S.live = false; startPoll(); }
      });
      es.addEventListener('messages', (ev) => {
        try { const d = JSON.parse(ev.data); if (d.action === 'create') addMessage(d.record); } catch (e) { /* ignore */ }
      });
      es.addEventListener('conversation_messages', (ev) => {
        try { const d = JSON.parse(ev.data); if (d.action === 'create') addGroupMessage(d.record); } catch (e) { /* ignore */ }
      });
      es.onerror = () => { S.live = false; startPoll(); };     // EventSource retries by itself
      return true;
    } catch (e) { return false; }
  }
  function startPoll() { if (!S.poll) S.poll = setInterval(() => {
    refreshConvos(); refreshGroups();
    if (S.open && S.tab === 'direct' && S.peerId) pollThread();
    if (S.open && S.tab === 'groups' && S.gid) pollGThread();
  }, 6000); }
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
    loadDirectory().then(() => { refreshConvos(); refreshGroups(); });
    if (!connectSSE()) startPoll();
  }
  function stop() {
    if (S.es) { S.es.close(); S.es = null; }
    stopPoll(); S.started = false; S.convos = new Map(); S.live = false;
    S.groups = new Map(); S.gid = null; S.gthread = []; S.sheet = null; S.pick = null; S.gtoast = new Map();
  }

  function mountDock(el) {
    if (!el) return;
    if (!me()) { el.hidden = true; return; }
    S.docks.forEach((d) => { if (!d.isConnected) S.docks.delete(d); });
    S.docks.add(el);
    if (!el.dataset.wired) { el.dataset.wired = '1'; wireDock(el); }
    renderDock(el);
    start();
    loadDirectory().then(() => renderDock(el));
  }

  // =================================================================== groups
  const GLYPH = '<svg class="uc-gglyph" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><circle cx="5.5" cy="5" r="2.3" fill="currentColor"/><circle cx="11" cy="6" r="1.8" fill="currentColor" opacity=".7"/><path d="M1 14c0-3 2-4.500 4.500-4.500S10 11 10 14z" fill="currentColor"/></svg> ';
  const SEEN_KEY = 'uc_group_seen';
  const gToast = (msg, kind) => UC.toast(esc(msg), kind);
  const gAv = (u, size) => '<img src="' + esc(UC.avatarUrl ? UC.avatarUrl(u || {}, size || 64) : '') + '" alt="" aria-hidden="true">';

  function seenMap() {
    if (S.seen) return S.seen;
    let o = {};
    try { o = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch (e) { o = {}; }
    S.seen = (o && typeof o === 'object') ? o : {};
    return S.seen;
  }
  function setSeen(id, ts) {
    if (!idOk(id) || !ts) return;
    const o = seenMap();
    if (o[id] && o[id] >= ts) return;
    o[id] = ts;
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(o)); } catch (e) { /* memory only */ }
  }
  function gUnread(g) {
    if (!g || !g.last || !me() || g.last.sender === me().id) return false;
    const seen = seenMap()[g.id] || g.created || '';
    return String(g.last.created) > String(seen);
  }
  const gRows = () => [...S.groups.values()].sort((a, b) => {
    const x = a.last ? a.last.created : (a.updated || ''), y = b.last ? b.last.created : (b.updated || '');
    return x < y ? 1 : -1;
  });
  function dockRows() {
    const d = convoRows().map((c) => ({ c, created: c.last.created }));
    const g = [...S.groups.values()].filter(gUnread).map((x) => ({ g: x, created: x.last.created }));
    return d.concat(g).sort((a, b) => (a.created < b.created ? 1 : -1)).slice(0, 3);
  }

  async function refreshGroups() {
    if (!me()) return;
    let convs, msgs = [];
    try {
      const r = await UC.api('GET', '/api/collections/conversations/records?perPage=50&sort=-updated&expand=members&filter=' +
        encodeURIComponent('(members~"' + me().id + '")'));
      convs = r.items || [];
    } catch (e) { return; }
    try {
      const r = await UC.api('GET', '/api/collections/conversation_messages/records?perPage=200&sort=-created');
      msgs = r.items || [];
    } catch (e) { msgs = []; }
    const lastBy = new Map();
    for (const m of msgs) { if (!lastBy.has(m.conversation)) lastBy.set(m.conversation, m); S.gids.add(m.id); }
    const map = new Map();
    for (const c of convs) {
      if (!idOk(c.id)) continue;
      ((c.expand && c.expand.members) || []).forEach(cache);
      const old = S.groups.get(c.id), a = lastBy.get(c.id), b = old && old.last;
      const last = a && b ? (a.created >= b.created ? a : b) : (a || b || null);
      map.set(c.id, { id: c.id, title: c.title || 'Group', owner: c.owner, members: (c.members || []).filter(idOk),
        created: c.created, updated: c.updated, last });
    }
    S.groups = map;
    if (S.gid && !map.has(S.gid)) { S.gid = null; S.gthread = []; closeSheet(); }
    const sid = [...map.values()].map((g) => (g.last ? g.last.sender : null)).filter(Boolean);
    await loadUsers(sid);
    if (S.gid) { markGroupSeen(S.gid, true); }
    renderAll(); renderGHead();
  }

  // ---- tabs
  function setTab(t) {
    S.tab = t === 'groups' ? 'groups' : 'direct';
    const d = document.getElementById('uc-chat'); if (!d) return;
    const g = S.tab === 'groups';
    d.classList.toggle('uc-mode-groups', g);
    d.querySelectorAll('[role=tab]').forEach((b) => {
      const on = b.dataset.tab === S.tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
    });
    d.querySelector('#uc-peers').hidden = g;
    d.querySelector('#uc-groups').hidden = !g;
    d.querySelector('#uc-gthread').hidden = !g;
    if (g) { refreshGroups(); renderGroups(); renderGHead(); renderGThread(); }
  }

  // ---- list
  function renderGroups() {
    const dot = document.getElementById('uc-tab-dot');
    if (dot) dot.hidden = ![...S.groups.values()].some(gUnread);
    const box = document.getElementById('uc-groups'); if (!box) return;
    const rows = gRows();
    box.innerHTML = '<button type="button" class="uc-peer uc-gnew" data-gnew>+ New group</button>' +
      (rows.map((g) => {
        const u = gUnread(g);
        const stack = g.members.slice(0, 3).map((id) => gAv(S.users.get(id) || { id }, 64)).join('');
        const lu = g.last && (S.users.get(g.last.sender) || { id: g.last.sender });
        const prev = g.last ? (g.last.sender === me().id ? 'You' : nameOf(lu).split(' ')[0]) + ': ' + g.last.text : 'No messages yet';
        return '<button type="button" class="uc-peer uc-gitem' + (g.id === S.gid ? ' active' : '') + '" data-gid="' + esc(g.id) + '">' +
          '<span class="uc-gstack">' + stack + '</span><span class="uc-gtxt"><b>' + esc(g.title) + '</b><small>' +
          esc(String(prev).slice(0, 40)) + '</small></span>' +
          (u ? '<span class="uc-node" aria-label="unread"></span>' : '') + '</button>';
      }).join('') || '<p class="uc-hint" style="padding:12px">No groups yet. Start one with people from your circle.</p>');
  }

  // ---- thread
  function renderGHead() {
    const g = S.groups.get(S.gid);
    const body = document.getElementById('uc-gbody'), empty = document.getElementById('uc-gempty');
    if (!body) return;
    body.hidden = !g; if (empty) empty.hidden = !!g;
    if (!g) return;
    document.getElementById('uc-gtitle-h').textContent = g.title;
    document.getElementById('uc-gmembers-btn').textContent = 'Members (' + g.members.length + ')';
  }
  function renderGThread() {
    const box = document.getElementById('uc-gmsgs'); if (!box) return;
    if (!S.gid) { box.innerHTML = ''; return; }
    const my = me().id;
    box.innerHTML = '<p class="uc-gnote">New members can read earlier messages.</p>' + (S.gthread.map((m) => {
      if (m.sender === my) return '<div class="uc-grow mine"><div class="uc-msg mine" data-id="' + esc(m.id) + '">' + esc(m.text) + '</div></div>';
      const u = S.users.get(m.sender) || { id: m.sender };
      return '<div class="uc-grow" data-id="' + esc(m.id) + '">' + gAv(u, 64) + '<div><small class="uc-gname">' + esc(nameOf(u)) +
        '</small><div class="uc-msg">' + esc(m.text) + '</div></div></div>';
    }).join('') || '<p class="uc-hint" style="padding:8px 0">Say hello to the group.</p>');
    box.scrollTop = box.scrollHeight;
  }
  async function fetchGMessages(id) {
    const q = '/api/collections/conversation_messages/records?perPage=100&sort=created&filter=' + encodeURIComponent('(conversation="' + id + '")');
    let r = await UC.api('GET', q);
    if (r.totalPages > 1) r = await UC.api('GET', q + '&page=' + r.totalPages);   // newest page
    return r.items || [];
  }
  async function selectGroup(id) {
    if (!idOk(id) || !S.groups.has(id)) return;
    S.gid = id; S.gthread = [];
    renderGHead(); renderGThread(); renderGroups();
    try { S.gthread = await fetchGMessages(id); } catch (e) { S.gthread = []; }
    if (S.gid !== id) return;
    await loadUsers([...new Set(S.gthread.map((m) => m.sender))]);
    if (S.gid !== id) return;
    renderGThread(); markGroupSeen(id);
    document.getElementById('uc-gmsg-input')?.focus();
  }
  async function openGroup(id) {
    if (!me()) { UC.openAuth('signin'); return; }
    if (!UC.auth.requireBackend()) return;
    start();
    const d = ensurePanel();
    d.classList.add('open'); S.open = true;
    setTab('groups');
    if (!S.groups.has(id)) await refreshGroups();
    selectGroup(id);
  }
  function markGroupSeen(id, quiet) {
    const g = S.groups.get(id); if (!g) return;
    const newest = S.gthread.length ? S.gthread[S.gthread.length - 1] : g.last;
    if (newest && S.open && S.tab === 'groups') setSeen(id, newest.created);
    if (!quiet) renderAll();
  }
  async function pollGThread() {
    const id = S.gid; if (!id) return;
    try {
      const items = await fetchGMessages(id);
      if (S.gid === id && items.length && (items.length !== S.gthread.length || items[items.length - 1].id !== S.gthread[S.gthread.length - 1]?.id)) {
        S.gthread = items;
        await loadUsers([...new Set(items.map((m) => m.sender))]);
        renderGThread(); markGroupSeen(id);
      }
    } catch (e) { /* keep */ }
  }
  async function sendGroup(e) {
    e.preventDefault();
    const inp = document.getElementById('uc-gmsg-input');
    const text = inp.value.trim(); if (!text || !S.gid) return;
    const gid = S.gid; inp.value = '';
    try {
      const rec = await UC.api('POST', '/api/collections/conversation_messages/records', { conversation: gid, sender: me().id, text });
      S.gids.add(rec.id);
      const g = S.groups.get(gid);
      if (g && (!g.last || g.last.created <= rec.created)) g.last = rec;
      setSeen(gid, rec.created);
      if (S.gid === gid && !S.gthread.some((x) => x.id === rec.id)) { S.gthread.push(rec); renderGThread(); }
      renderAll();
    } catch (err) { gToast(err.message || 'Could not send.', 'warn'); inp.value = text; }
  }
  function addGroupMessage(m) {
    if (!m || !me() || !idOk(m.conversation)) return;
    const g = S.groups.get(m.conversation);
    if (!g) { refreshGroups(); return; }                  // we were just added to a new group
    const fresh = !S.gids.has(m.id); S.gids.add(m.id);
    if (!g.last || g.last.created <= m.created) g.last = m;
    const mine = m.sender === me().id;
    const inThread = S.open && S.tab === 'groups' && S.gid === g.id;
    if (inThread && !S.gthread.some((x) => x.id === m.id)) {
      S.gthread.push(m); renderGThread();
      if (!S.users.has(m.sender)) loadUsers([m.sender]).then(renderGThread);
    }
    if (inThread || mine) setSeen(g.id, m.created);
    else if (fresh) {
      const now = Date.now();
      if (now - (S.gtoast.get(g.id) || 0) >= 5000) {      // one toast per group per 5 s
        S.gtoast.set(g.id, now);
        loadUsers([m.sender]).then(() => UC.toast('<b>' + esc(nameOf(S.users.get(m.sender) || { id: m.sender })) + '</b> in <b>' + esc(g.title) + '</b>'));
        pulseRail();
      }
    }
    renderAll();
  }

  // ---- sheets (new group / members)
  const contactHint = (u) => {
    const mode = u.contact_mode || 'open';
    if (mode === 'closed') return 'not accepting';
    if (mode === 'points') return 'needs ' + (Math.max(0, Math.min(10000, Number(u.min_points) || 0))) + ' points';
    if (mode === 'request') return 'may need a collaboration request first';
    return '';
  };
  function closeSheet() {
    const sh = document.getElementById('uc-gsheet');
    const had = S.sheet; S.sheet = null; S.pick = null;
    if (sh) { sh.hidden = true; sh.innerHTML = ''; }
    if (had && S.open) document.getElementById(S.gid ? 'uc-gmembers-btn' : 'uc-tab-groups')?.focus?.();
  }
  function openSheet(type) {
    S.sheet = { type, confirm: null };
    const members = type === 'members' ? (S.groups.get(S.gid) || { members: [] }).members : [];
    S.pick = { sel: new Map(), q: '', res: [], max: type === 'new' ? 11 : Math.max(0, 12 - members.length), exclude: new Set(members.concat(me().id)), timer: null };
    renderSheet();
    pickSearch('');
  }
  function pickHtml() {
    return '<div class="uc-pick"><label class="uc-glabel" for="uc-pick-q">' + (S.sheet.type === 'new' ? 'Add people (up to ' + S.pick.max + ')' : 'Add people') +
      '</label><input id="uc-pick-q" class="uc-ginput" type="search" maxlength="40" autocomplete="off" placeholder="Search by name">' +
      '<div class="uc-chips" id="uc-pick-chips"></div><div class="uc-pick-res" id="uc-pick-res"></div></div>';
  }
  function updatePick() {
    const p = S.pick; if (!p) return;
    const chips = document.getElementById('uc-pick-chips'), res = document.getElementById('uc-pick-res');
    if (chips) chips.innerHTML = [...p.sel.values()].map((u) => '<button type="button" class="uc-chip" data-chip="' + esc(u.id) + '" aria-label="Remove ' + esc(nameOf(u)) + '">' + esc(nameOf(u)) + ' ✕</button>').join('');
    if (res) {
      const full = p.sel.size >= p.max;
      res.innerHTML = p.res.filter((u) => idOk(u.id) && !p.exclude.has(u.id)).map((u) => {
        const on = p.sel.has(u.id), closed = (u.contact_mode || 'open') === 'closed';
        const hint = contactHint(u);
        const dis = closed || (!on && full);
        return '<button type="button" class="uc-pick-item' + (on ? ' on' : '') + '" data-uid="' + esc(u.id) + '"' + (dis ? ' disabled' : '') + ' aria-pressed="' + on + '">' +
          gAv(u, 64) + '<span><b>' + esc(nameOf(u)) + '</b><small>' + esc(hint) + '</small></span></button>';
      }).join('') || '<p class="uc-hint">No one found.</p>';
    }
    const add = document.querySelector('#uc-gsheet [data-gadd]'); if (add) add.disabled = p.sel.size === 0;
  }
  async function pickSearch(q) {
    const p = S.pick; if (!p) return;
    q = String(q || '').replace(/["\\\u0000-\u001f]/g, '').trim().slice(0, 40);
    p.q = q;
    if (!q) { await loadDirectory(); p.res = S.peers.slice(0, 20); updatePick(); return; }
    try {
      const r = await UC.api('GET', '/api/collections/users/records?perPage=20&filter=' + encodeURIComponent('(name~"' + q + '" && id!="' + me().id + '")'));
      if (!S.pick || S.pick.q !== q) return;
      p.res = (r.items || []).filter((u) => idOk(u.id)); p.res.forEach(cache);
    } catch (e) { p.res = []; }
    updatePick();
  }
  function confirmRow() {
    const c = S.sheet.confirm; if (!c) return '';
    const txt = { rm: 'Remove ' + nameOf(S.users.get(c.id) || {}) + ' from the group?', leave: 'Leave this group? You will stop receiving its messages.',
      del: 'Delete this group for everyone? This cannot be undone.' }[c.kind];
    return '<div class="uc-gconfirm" role="alert"><span>' + esc(txt) + '</span><button type="button" class="uc-gbtn uc-gbtn-danger" data-gyes>Yes</button><button type="button" class="uc-gbtn" data-gno>Cancel</button></div>';
  }
  function renderSheet() {
    const sh = document.getElementById('uc-gsheet'); if (!sh || !S.sheet) return;
    const head = (t) => '<div class="uc-gsheet-head"><b id="uc-gsheet-t">' + esc(t) + '</b><button type="button" class="uc-gx" data-sheet-close aria-label="Close">✕</button></div>';
    if (S.sheet.type === 'new') {
      sh.innerHTML = '<div class="uc-gsheet-in">' + head('New group') +
        '<form id="uc-gnew-form" class="uc-gsheet-body"><label class="uc-glabel" for="uc-gtitle">Group name</label>' +
        '<input id="uc-gtitle" class="uc-ginput" maxlength="80" required autocomplete="off" placeholder="e.g. Thesis circle">' +
        pickHtml() + '<p class="uc-hint">Up to 11 people plus you. Members who do not accept invites are greyed out; the server makes the final call.</p>' +
        '<div class="uc-gactions"><button type="button" class="uc-gbtn" data-sheet-close>Cancel</button><button type="submit" class="uc-gbtn uc-gbtn-primary">Create group</button></div></form></div>';
    } else {
      const g = S.groups.get(S.gid); if (!g) { closeSheet(); return; }
      const owner = g.owner === me().id;
      sh.innerHTML = '<div class="uc-gsheet-in">' + head('Members (' + g.members.length + '/12)') + '<div class="uc-gsheet-body">' +
        '<ul class="uc-gmem">' + g.members.map((id) => {
          const u = S.users.get(id) || { id };
          return '<li>' + gAv(u, 64) + '<span>' + esc(nameOf(u)) + (id === g.owner ? ' <em>Owner</em>' : '') + (id === me().id ? ' <em>You</em>' : '') + '</span>' +
            (owner && id !== me().id ? '<button type="button" class="uc-gbtn" data-grm="' + esc(id) + '" aria-label="Remove ' + esc(nameOf(u)) + '">Remove</button>' : '') + '</li>';
        }).join('') + '</ul>' +
        (owner ? (S.pick.max > 0 ? pickHtml() + '<div class="uc-gactions"><button type="button" class="uc-gbtn uc-gbtn-primary" data-gadd disabled>Add selected</button></div>' : '<p class="uc-hint">The group is full (12).</p>') : '') +
        confirmRow() +
        '<div class="uc-gactions">' + (owner
          ? '<button type="button" class="uc-gbtn uc-gbtn-danger" data-gdel>Delete group</button>'
          : '<button type="button" class="uc-gbtn uc-gbtn-danger" data-gleave>Leave group</button>') + '</div></div></div>';
    }
    sh.hidden = false;
    updatePick();
    sh.querySelector('#uc-gtitle, #uc-pick-q, [data-sheet-close]')?.focus();
    const miss = S.sheet.type === 'members' ? (S.groups.get(S.gid) || { members: [] }).members.filter((id) => !S.users.has(id)) : [];
    if (miss.length) loadUsers(miss).then(() => { if (S.sheet) renderSheet(); });
  }

  async function createGroup(form) {
    const title = form.querySelector('#uc-gtitle').value.trim().slice(0, 80);
    const ids = [...S.pick.sel.keys()].filter(idOk);
    if (!title) { gToast('Give the group a name.', 'warn'); return; }
    if (!ids.length) { gToast('Pick at least one person.', 'warn'); return; }
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const rec = await UC.api('POST', '/api/collections/conversations/records', { title, owner: me().id, members: [me().id].concat(ids) });
      closeSheet();
      await refreshGroups();
      if (rec && idOk(rec.id)) selectGroup(rec.id);
    } catch (err) { gToast(err.message || 'Could not create the group.', 'warn'); btn.disabled = false; }
  }
  async function patchMembers(next, okMsg) {
    const g = S.groups.get(S.gid); if (!g) return;
    try {
      const rec = await UC.api('PATCH', '/api/collections/conversations/records/' + g.id, { members: next });
      g.members = (rec.members || next).filter(idOk);
      if (okMsg) gToast(okMsg);
      if (S.sheet) { const t = S.sheet.type; S.sheet.confirm = null; openSheet(t); }
      renderGHead(); renderGroups();
    } catch (err) { gToast(err.message || 'The server refused this change.', 'warn'); if (S.sheet) { S.sheet.confirm = null; renderSheet(); } }
  }
  async function confirmYes() {
    const c = S.sheet && S.sheet.confirm, g = S.groups.get(S.gid); if (!c || !g) return;
    if (c.kind === 'rm') { if (idOk(c.id)) await patchMembers(g.members.filter((x) => x !== c.id), 'Member removed.'); return; }
    try {
      if (c.kind === 'leave') await UC.api('POST', '/api/uc/conversations/' + g.id + '/leave', {});
      else await UC.api('DELETE', '/api/collections/conversations/records/' + g.id);
      S.groups.delete(g.id); S.gid = null; S.gthread = [];
      closeSheet(); renderGHead(); renderGThread(); renderAll();
      gToast(c.kind === 'leave' ? 'You left the group.' : 'Group deleted.');
    } catch (err) { gToast(err.message || 'The server refused this.', 'warn'); S.sheet.confirm = null; renderSheet(); }
  }

  function wireGroups(d) {
    const tabs = d.querySelector('.uc-chat-tabs');
    tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
    tabs.addEventListener('keydown', (e) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']; if (!keys.includes(e.key)) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 'direct' : e.key === 'End' ? 'groups' : (S.tab === 'direct' ? 'groups' : 'direct');
      setTab(next); d.querySelector('#uc-tab-' + next).focus();
    });
    d.querySelector('#uc-groups').addEventListener('click', (e) => {
      if (e.target.closest('[data-gnew]')) { openSheet('new'); return; }
      const b = e.target.closest('[data-gid]'); if (b) selectGroup(b.dataset.gid);
    });
    d.querySelector('#uc-gmsg-form').onsubmit = sendGroup;
    d.querySelector('#uc-gmembers-btn').onclick = () => openSheet('members');
    const sh = d.querySelector('#uc-gsheet');
    sh.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('[data-sheet-close]')) { closeSheet(); return; }
      const it = t.closest('[data-uid]');
      if (it && S.pick) {
        const id = it.dataset.uid;
        if (S.pick.sel.has(id)) S.pick.sel.delete(id);
        else { const u = S.pick.res.find((x) => x.id === id); if (u && S.pick.sel.size < S.pick.max && (u.contact_mode || 'open') !== 'closed') S.pick.sel.set(id, u); }
        updatePick(); return;
      }
      const ch = t.closest('[data-chip]'); if (ch && S.pick) { S.pick.sel.delete(ch.dataset.chip); updatePick(); return; }
      if (t.closest('[data-gadd]') && S.pick) {
        const g = S.groups.get(S.gid); if (!g) return;
        patchMembers(g.members.concat([...S.pick.sel.keys()].filter(idOk)), 'Invites sent.'); return;
      }
      const rm = t.closest('[data-grm]'); if (rm && idOk(rm.dataset.grm)) { S.sheet.confirm = { kind: 'rm', id: rm.dataset.grm }; renderSheet(); return; }
      if (t.closest('[data-gleave]')) { S.sheet.confirm = { kind: 'leave' }; renderSheet(); return; }
      if (t.closest('[data-gdel]')) { S.sheet.confirm = { kind: 'del' }; renderSheet(); return; }
      if (t.closest('[data-gyes]')) { confirmYes(); return; }
      if (t.closest('[data-gno]')) { S.sheet.confirm = null; renderSheet(); }
    });
    sh.addEventListener('input', (e) => {
      if (e.target.id !== 'uc-pick-q' || !S.pick) return;
      clearTimeout(S.pick.timer); const v = e.target.value;
      S.pick.timer = setTimeout(() => pickSearch(v), 250);
    });
    sh.addEventListener('submit', (e) => { if (e.target.id === 'uc-gnew-form') { e.preventDefault(); createGroup(e.target); } });
    sh.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeSheet(); return; }
      if (e.key !== 'Tab') return;
      const f = [...sh.querySelectorAll('button:not([disabled]), input')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  // let the panel/chat keep working for pages that call UC.openChat(peerId)
  UC.openChat = open;
  document.addEventListener('uc:login', () => { stop(); start(); });
  window.UCChat = { open, close, mountDock, unread, start, stop, openGroup, _state: S };
})();
