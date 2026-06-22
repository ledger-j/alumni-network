/* ==========================================================================
   UniCircle — living-network layer (accounts · posting · chat · LinkedIn)
   Talks to the PocketBase backend over plain REST (no external deps).
   Degrades gracefully when the API isn't reachable yet (pre-DNS), so the
   marketing/demo UI keeps working.
   ========================================================================== */
(function () {
  'use strict';

  // --- Config: ?api=... overrides and is remembered; else stored; else default
  const qApi = new URLSearchParams(location.search).get('api');
  if (qApi) localStorage.setItem('uc_api_base', qApi);
  const API = (localStorage.getItem('uc_api_base') || 'https://api.unicircle.eu').replace(/\/$/, '');

  const LS_AUTH = 'uc_auth';
  const state = { token: null, user: null, online: false, chatPeer: null, chatTimer: null };

  // ---------------------------------------------------------------- REST glue
  async function api(method, path, body, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token && opts.auth !== false) headers.Authorization = state.token;
    const res = await fetch(API + path, {
      method, headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || res.statusText), { status: res.status, data });
    return data;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fileUrl = (rec, field) => rec && rec[field]
    ? `${API}/api/files/${rec.collectionId}/${rec.id}/${rec[field]}` : null;
  const avatarOf = (u) => fileUrl(u, 'avatar')
    || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u?.name || u?.email || 'UC')}&backgroundType=gradientLinear&backgroundColor=1E6FC4,1C4C8A`;

  function saveAuth() {
    if (state.token) localStorage.setItem(LS_AUTH, JSON.stringify({ token: state.token, user: state.user }));
    else localStorage.removeItem(LS_AUTH);
  }

  function toast(msg, kind = 'ok') {
    const t = document.createElement('div');
    t.className = 'uc-toast uc-toast--' + kind;
    t.innerHTML = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 3200);
  }

  // ----------------------------------------------------------------- session
  async function bootSession() {
    try {
      const raw = localStorage.getItem(LS_AUTH);
      if (raw) { const a = JSON.parse(raw); state.token = a.token; state.user = a.user; }
      // ping health to learn if backend is reachable
      await api('GET', '/api/health', null, { auth: false });
      state.online = true;
      if (state.token) {
        try {
          const r = await api('POST', '/api/collections/users/auth-refresh');
          state.token = r.token; state.user = r.record; saveAuth();
        } catch { state.token = null; state.user = null; saveAuth(); }
      }
    } catch {
      state.online = false; // pre-DNS / offline — keep demo UI usable
    }
    renderHeaderAuth();
  }

  // -------------------------------------------------------------- header auth
  function renderHeaderAuth() {
    const pill = document.getElementById('profile-pill');
    if (!pill) return;
    pill.onclick = null;
    if (state.user) {
      pill.innerHTML =
        `<img src="${avatarOf(state.user)}" alt="${esc(state.user.name || 'Me')}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;border:1.5px solid var(--uc-sky);"> ${esc((state.user.name || 'Me').split(' ')[0])}`;
      pill.onclick = openUserMenu;
    } else {
      pill.innerHTML = `<span class="iconify" data-icon="ph:user-circle-plus-duotone" style="font-size:20px;"></span> Join / Sign in`;
      pill.onclick = () => openAuth('signup');
    }
  }

  function openUserMenu() {
    closePopovers();
    const m = document.createElement('div');
    m.className = 'uc-popover';
    m.innerHTML = `
      <button data-act="messages"><span class="iconify" data-icon="ph:chat-circle-dots-bold"></span> Messages</button>
      <button data-act="profile"><span class="iconify" data-icon="ph:identification-badge-bold"></span> My profile</button>
      <button data-act="signout"><span class="iconify" data-icon="ph:sign-out-bold"></span> Sign out</button>`;
    document.body.appendChild(m);
    const r = document.getElementById('profile-pill').getBoundingClientRect();
    m.style.top = (r.bottom + 8) + 'px';
    m.style.right = (window.innerWidth - r.right) + 'px';
    m.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (act === 'signout') { state.token = null; state.user = null; saveAuth(); renderHeaderAuth(); toast('Signed out.'); }
      if (act === 'messages') openChat();
      if (act === 'profile') openProfile();
      closePopovers();
    });
  }
  const closePopovers = () => document.querySelectorAll('.uc-popover').forEach((n) => n.remove());
  document.addEventListener('click', (e) => { if (!e.target.closest('.uc-popover,#profile-pill')) closePopovers(); });

  // ------------------------------------------------------------ modal helpers
  function modal(title, bodyHtml, footerHtml) {
    document.querySelectorAll('.uc-modal-host').forEach((n) => n.remove());
    const host = document.createElement('div');
    host.className = 'uc-modal-host';
    host.innerHTML = `
      <div class="uc-modal-backdrop"></div>
      <div class="uc-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="uc-modal-head"><h3>${title}</h3><button class="uc-x" aria-label="Close">✕</button></div>
        <div class="uc-modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="uc-modal-foot">${footerHtml}</div>` : ''}
      </div>`;
    document.body.appendChild(host);
    const close = () => host.remove();
    host.querySelector('.uc-x').onclick = close;
    host.querySelector('.uc-modal-backdrop').onclick = close;
    const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    return { host, close };
  }

  function requireBackend() {
    if (state.online) return true;
    toast('Could not reach <b>api.unicircle.eu</b> — check your internet connection.', 'warn');
    return false;
  }

  // --------------------------------------------------------------------- auth
  function openAuth(tab) {
    const body = `
      <div class="uc-tabs">
        <button class="uc-tab ${tab === 'signin' ? 'active' : ''}" data-tab="signin">Sign in</button>
        <button class="uc-tab ${tab === 'signup' ? 'active' : ''}" data-tab="signup">Create account</button>
      </div>
      <button class="uc-linkedin" data-act="linkedin">
        <span class="iconify" data-icon="ph:linkedin-logo-fill"></span> Import from LinkedIn — one click
      </button>
      <div class="uc-or"><span>or with email</span></div>
      <form id="uc-auth-form" class="uc-form">
        <label class="uc-su-only" style="${tab === 'signin' ? 'display:none' : ''}">Full name
          <input name="name" placeholder="Jean Maurice H." autocomplete="name">
        </label>
        <label>Email <input name="email" type="email" required placeholder="you@email.com" autocomplete="email"></label>
        <label>Password <input name="password" type="password" required minlength="8" placeholder="At least 8 characters" autocomplete="current-password"></label>
        <label class="uc-su-only" style="${tab === 'signin' ? 'display:none' : ''}">Confirm password
          <input name="passwordConfirm" type="password" required minlength="8" placeholder="Repeat password" autocomplete="new-password">
        </label>
        <button class="uc-primary" type="submit">${tab === 'signin' ? 'Sign in' : 'Create my account'}</button>
        <p class="uc-err" hidden></p>
      </form>`;
    const { host, close } = modal('Welcome to UniCircle', body);
    let mode = tab;
    const setMode = (m) => {
      mode = m;
      host.querySelectorAll('.uc-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === m));
      host.querySelectorAll('.uc-su-only').forEach((el) => el.style.display = m === 'signup' ? '' : 'none');
      host.querySelector('.uc-primary').textContent = m === 'signin' ? 'Sign in' : 'Create my account';
    };
    host.querySelectorAll('.uc-tab').forEach((b) => b.onclick = () => setMode(b.dataset.tab));
    host.querySelector('[data-act="linkedin"]').onclick = () => { close(); openLinkedIn(); };
    host.querySelector('#uc-auth-form').onsubmit = async (e) => {
      e.preventDefault();
      if (!requireBackend()) return;
      const f = e.target; const errEl = f.querySelector('.uc-err');
      errEl.hidden = true;
      const email = f.email.value.trim(), password = f.password.value, name = f.name?.value.trim();
      const confirmVal = f.passwordConfirm?.value;
      if (mode === 'signup' && confirmVal !== undefined && confirmVal !== password) {
        errEl.textContent = 'Passwords do not match.'; errEl.hidden = false; return;
      }
      try {
        if (mode === 'signup') {
          await api('POST', '/api/collections/users/records',
            { email, password, passwordConfirm: password, name: name || email.split('@')[0] }, { auth: false });
        }
        const r = await api('POST', '/api/collections/users/auth-with-password', { identity: email, password }, { auth: false });
        state.token = r.token; state.user = r.record; saveAuth();
        close(); renderHeaderAuth();
        toast(`Welcome${state.user.name ? ', ' + esc(state.user.name.split(' ')[0]) : ''}! 🎉`);
        refreshLiveFeed();
      } catch (err) {
        errEl.textContent = err.status === 400 ? 'Check your details — email may already be registered or password too short.' : (err.message || 'Something went wrong.');
        errEl.hidden = false;
      }
    };
  }

  // ---------------------------------------------------- LinkedIn import / OIDC
  function openLinkedIn() {
    const body = `
      <p class="uc-lead">Bring your professional profile across in one step.</p>
      <button class="uc-linkedin" id="uc-li-signin">
        <span class="iconify" data-icon="ph:linkedin-logo-fill"></span> Sign in with LinkedIn
      </button>
      <p class="uc-hint" id="uc-li-hint"></p>
      <div class="uc-or"><span>or import your LinkedIn data export</span></div>
      <p class="uc-hint">On LinkedIn: <b>Settings → Data privacy → Get a copy of your data</b>. Unzip it and drop
        <code>Profile.csv</code> (and optionally <code>Positions.csv</code>) below — parsed privately in your browser.</p>
      <label class="uc-drop">
        <input type="file" id="uc-li-file" accept=".csv" multiple hidden>
        <span class="iconify" data-icon="ph:upload-simple-bold"></span> Choose Profile.csv / Positions.csv
      </label>
      <form id="uc-li-form" class="uc-form" hidden>
        <label>Full name <input name="name" required></label>
        <label>Headline <input name="headline"></label>
        <label>Location <input name="location"></label>
        <label>LinkedIn URL <input name="linkedin_url" type="url" placeholder="https://www.linkedin.com/in/..."></label>
        <div class="uc-or"><span>finish creating your account</span></div>
        <label>Email <input name="email" type="email" required></label>
        <label>Password <input name="password" type="password" required minlength="8"></label>
        <button class="uc-primary" type="submit">Create account from LinkedIn</button>
        <p class="uc-err" hidden></p>
      </form>`;
    const { host, close } = modal('Import from LinkedIn', body);

    // OIDC sign-in via PocketBase OAuth2 (works once a LinkedIn provider is configured in PB admin)
    host.querySelector('#uc-li-signin').onclick = async () => {
      if (!requireBackend()) return;
      const hint = host.querySelector('#uc-li-hint');
      try {
        const methods = await api('GET', '/api/collections/users/auth-methods', null, { auth: false });
        const providers = (methods.oauth2 && methods.oauth2.providers) || methods.authProviders || [];
        const li = providers.find((p) => /linkedin|oidc/i.test(p.name));
        if (!li) { hint.textContent = 'LinkedIn sign-in isn\'t enabled yet — add a LinkedIn OAuth2 provider in the PocketBase admin (Settings → Auth providers), then this button goes live.'; return; }
        startOAuth(li, close);
      } catch (e) { hint.textContent = 'Could not reach the auth service.'; }
    };

    const form = host.querySelector('#uc-li-form');
    host.querySelector('#uc-li-file').onchange = async (e) => {
      const parsed = await parseLinkedInCsvs([...e.target.files]);
      form.hidden = false;
      form.name.value = parsed.name || '';
      form.headline.value = parsed.headline || '';
      form.location.value = parsed.location || '';
      form.linkedin_url.value = parsed.linkedin_url || '';
      toast('Parsed your LinkedIn export — review and finish.');
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!requireBackend()) return;
      const f = e.target, errEl = f.querySelector('.uc-err'); errEl.hidden = true;
      try {
        const payload = {
          email: f.email.value.trim(), password: f.password.value, passwordConfirm: f.password.value,
          name: f.name.value.trim(), headline: f.headline.value.trim(), location: f.location.value.trim(),
          linkedin_url: f.linkedin_url.value.trim(), linkedin_imported: true,
        };
        await api('POST', '/api/collections/users/records', payload, { auth: false });
        const r = await api('POST', '/api/collections/users/auth-with-password', { identity: payload.email, password: f.password.value }, { auth: false });
        state.token = r.token; state.user = r.record; saveAuth();
        close(); renderHeaderAuth(); toast('LinkedIn profile imported 🎉'); refreshLiveFeed();
      } catch (err) {
        errEl.textContent = err.message || 'Import failed.'; errEl.hidden = false;
      }
    };
  }

  function startOAuth(provider, close) {
    const redirect = location.origin + location.pathname;
    const w = window.open('', 'uc_oauth', 'width=600,height=720');
    const url = provider.authURL + encodeURIComponent(redirect);
    if (w) w.location.href = url; else location.href = url;
    // Completion handled on redirect back (see handleOAuthRedirect)
    sessionStorage.setItem('uc_oauth', JSON.stringify({ provider: provider.name, codeVerifier: provider.codeVerifier, state: provider.state, redirect }));
  }
  async function handleOAuthRedirect() {
    const p = new URLSearchParams(location.search);
    const code = p.get('code'); const st = p.get('state');
    const saved = sessionStorage.getItem('uc_oauth');
    if (!code || !saved) return;
    sessionStorage.removeItem('uc_oauth');
    const o = JSON.parse(saved);
    try {
      const r = await api('POST', '/api/collections/users/auth-with-oauth2', {
        provider: o.provider, code, codeVerifier: o.codeVerifier, redirectURL: o.redirect,
      }, { auth: false });
      state.token = r.token; state.user = r.record; saveAuth();
      history.replaceState({}, '', location.pathname);
      toast('Signed in with LinkedIn 🎉');
    } catch { /* ignore */ }
  }

  function parseCsv(text) {
    const rows = []; let row = [], val = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { val += '"'; i++; } else q = false; } else val += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(val); val = ''; }
      else if (c === '\n' || c === '\r') { if (val !== '' || row.length) { row.push(val); rows.push(row); row = []; val = ''; } if (c === '\r' && text[i + 1] === '\n') i++; }
      else val += c;
    }
    if (val !== '' || row.length) { row.push(val); rows.push(row); }
    return rows;
  }
  async function parseLinkedInCsvs(files) {
    const out = {};
    for (const file of files) {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) continue;
      const head = rows[0].map((h) => h.trim().toLowerCase());
      const rec = Object.fromEntries(head.map((h, i) => [h, (rows[1][i] || '').trim()]));
      if (/profile/i.test(file.name) || rec['first name']) {
        out.name = [rec['first name'], rec['last name']].filter(Boolean).join(' ') || out.name;
        out.headline = rec['headline'] || out.headline;
        out.location = rec['geo location'] || rec['location'] || out.location;
      }
      if (/position/i.test(file.name) || rec['title']) {
        if (!out.headline && rec['title']) out.headline = [rec['title'], rec['company name']].filter(Boolean).join(' at ');
      }
    }
    return out;
  }

  // -------------------------------------------------------------- live feed
  async function fetchLivePosts() {
    if (!state.online) return [];
    try {
      const r = await api('GET', '/api/collections/posts/records?perPage=20&sort=-created&expand=author', null, { auth: false });
      return r.items || [];
    } catch { return []; }
  }
  function postCardHtml(p) {
    const a = p.expand && p.expand.author;
    const name = a ? a.name || 'UniCircle member' : 'UniCircle member';
    const head = a ? (a.headline || (a.linkedin_imported ? 'Imported from LinkedIn' : 'UniCircle member')) : '';
    return `
      <article class="sbe-card feed-post uc-live-post">
        <div class="post-header"><div class="author-info">
          <img src="${avatarOf(a)}" alt="${esc(name)}" class="avatar">
          <div class="details">
            <span class="name">${esc(name)} <span class="uc-livechip">live</span></span>
            <span class="headline">${esc(head)}</span>
            <span class="time">just now • <span class="iconify" data-icon="ph:globe-hemisphere-east-bold"></span></span>
          </div></div></div>
        <div class="post-content"><p>${esc(p.text).replace(/\n/g, '<br>')}</p>
          ${p.image ? `<div class="post-image"><img src="${esc(p.image)}" alt=""></div>` : ''}</div>
        <div class="post-stats"><span class="likes-count"><span class="iconify" data-icon="ph:thumbs-up-fill"></span> ${p.likes || 0} likes</span><span>UniCircle live feed</span></div>
      </article>`;
  }
  async function refreshLiveFeed() {
    const list = document.querySelector('.feed-posts-list');
    if (!list) return;
    const posts = await fetchLivePosts();
    list.querySelectorAll('.uc-live-post').forEach((n) => n.remove());
    list.querySelectorAll('.uc-feed-empty').forEach((n) => n.remove());
    if (posts.length) {
      list.insertAdjacentHTML('afterbegin', posts.map(postCardHtml).join(''));
    } else if (state.online) {
      const empty = document.createElement('div');
      empty.className = 'uc-feed-empty sbe-card';
      empty.style.cssText = 'text-align:center;padding:var(--space-8);color:var(--color-text-secondary);';
      empty.innerHTML = `<span class="iconify" data-icon="ph:pencil-line-duotone" style="font-size:48px;opacity:.4;"></span><p style="margin-top:var(--space-3);font-family:var(--font-heading);font-weight:600;">The live feed is quiet — be the first to post!</p><p style="font-size:var(--text-xs);margin-top:var(--space-2);">Sign in and click "What's on your mind?" to share with the UM network.</p>`;
      list.insertAdjacentElement('afterbegin', empty);
    }
    if (window.Iconify) window.Iconify.scan(list);
  }

  // hook the existing "Start a post" box / modal submit (event delegation)
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!(form.closest && form.closest('#post-modal'))) return;
    // Let app.js render its optimistic card; also persist to backend when logged in.
    const ta = form.querySelector('textarea');
    const degree = form.querySelector('#post-degree')?.value || '';
    const text = ta && ta.value.trim();
    if (!text) return;
    if (state.user && state.online) {
      try { await api('POST', '/api/collections/posts/records', { author: state.user.id, text, degree, likes: 0 }); toast('Posted to the live feed.'); setTimeout(refreshLiveFeed, 300); }
      catch { toast('Saved locally — sign in / backend needed to publish.', 'warn'); }
    } else if (!state.user) {
      toast('Tip: <b>Join / Sign in</b> to publish to the live network.', 'warn');
    }
  }, true);

  // when the feed page renders, inject live posts
  const vp = document.getElementById('app-viewport');
  if (vp) new MutationObserver(() => { if (document.querySelector('.feed-posts-list') && !document.querySelector('.uc-live-post')) refreshLiveFeed(); })
    .observe(vp, { childList: true, subtree: true });

  // ------------------------------------------------------------------- chat
  let chatUsers = [];
  async function openChat(peerId) {
    if (!state.user) { openAuth('signin'); return; }
    if (!requireBackend()) return;
    let drawer = document.getElementById('uc-chat');
    if (!drawer) {
      drawer = document.createElement('div'); drawer.id = 'uc-chat';
      drawer.innerHTML = `
        <div class="uc-chat-head"><b>Messages</b><button class="uc-x" aria-label="Close">✕</button></div>
        <div class="uc-chat-cols">
          <div class="uc-chat-peers" id="uc-peers"></div>
          <div class="uc-chat-thread">
            <div class="uc-thread-msgs" id="uc-msgs"><p class="uc-hint" style="padding:16px">Pick someone to start chatting.</p></div>
            <form class="uc-thread-form" id="uc-msg-form" hidden>
              <input id="uc-msg-input" placeholder="Write a message…" autocomplete="off">
              <button class="uc-primary" type="submit">Send</button>
            </form>
          </div>
        </div>`;
      document.body.appendChild(drawer);
      drawer.querySelector('.uc-x').onclick = closeChat;
      drawer.querySelector('#uc-msg-form').onsubmit = sendMessage;
    }
    drawer.classList.add('open');
    try {
      const r = await api('GET', `/api/collections/users/records?perPage=50&filter=${encodeURIComponent('id != "' + state.user.id + '"')}`, null, { auth: false });
      chatUsers = r.items || [];
    } catch { chatUsers = []; }
    const peers = drawer.querySelector('#uc-peers');
    peers.innerHTML = chatUsers.map((u) => `
      <button class="uc-peer" data-id="${u.id}">
        <img src="${avatarOf(u)}" alt=""><span>${esc(u.name || u.email.split('@')[0])}</span></button>`).join('')
      || '<p class="uc-hint" style="padding:12px">No other members yet — invite some!</p>';
    peers.querySelectorAll('.uc-peer').forEach((b) => b.onclick = () => selectPeer(b.dataset.id));
    if (peerId) selectPeer(peerId);
  }
  function closeChat() {
    document.getElementById('uc-chat')?.classList.remove('open');
    if (state.chatTimer) { clearInterval(state.chatTimer); state.chatTimer = null; }
  }
  async function selectPeer(id) {
    state.chatPeer = chatUsers.find((u) => u.id === id) || { id };
    document.querySelectorAll('.uc-peer').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
    document.getElementById('uc-msg-form').hidden = false;
    await loadThread();
    if (state.chatTimer) clearInterval(state.chatTimer);
    state.chatTimer = setInterval(loadThread, 4000);
  }
  async function loadThread() {
    if (!state.chatPeer) return;
    const me = state.user.id, peer = state.chatPeer.id;
    const flt = `(sender="${me}" && recipient="${peer}") || (sender="${peer}" && recipient="${me}")`;
    let items = [];
    try { const r = await api('GET', `/api/collections/messages/records?perPage=100&sort=created&filter=${encodeURIComponent(flt)}`); items = r.items || []; }
    catch { return; }
    const box = document.getElementById('uc-msgs');
    box.innerHTML = items.map((m) => `<div class="uc-msg ${m.sender === me ? 'mine' : ''}">${esc(m.text)}</div>`).join('')
      || '<p class="uc-hint" style="padding:16px">Say hello 👋</p>';
    box.scrollTop = box.scrollHeight;
  }
  async function sendMessage(e) {
    e.preventDefault();
    const inp = document.getElementById('uc-msg-input');
    const text = inp.value.trim(); if (!text || !state.chatPeer) return;
    inp.value = '';
    try { await api('POST', '/api/collections/messages/records', { sender: state.user.id, recipient: state.chatPeer.id, text, read: false }); loadThread(); }
    catch { toast('Could not send.', 'warn'); }
  }

  // ------------------------------------------------------------- my profile
  function openProfile() {
    if (!state.user) { openAuth('signin'); return; }
    const u = state.user;
    const body = `
      <form id="uc-profile-form" class="uc-form">
        <label>Name <input name="name" value="${esc(u.name || '')}"></label>
        <label>Headline <input name="headline" value="${esc(u.headline || '')}"></label>
        <label>Location <input name="location" value="${esc(u.location || '')}"></label>
        <label>Degree <input name="degree" value="${esc(u.degree || '')}" placeholder="M.Sc. Financial Economics"></label>
        <label class="uc-check"><input type="checkbox" name="mentor" ${u.mentor ? 'checked' : ''}> Offer mentorship to current students</label>
        <label>What you offer <input name="mentor_offer" value="${esc(u.mentor_offer || '')}" placeholder="CV review, interview prep…"></label>
        <button class="uc-primary" type="submit">Save profile</button>
        <p class="uc-err" hidden></p>
      </form>`;
    const { host, close } = modal('My UniCircle profile', body);
    host.querySelector('#uc-profile-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const r = await api('PATCH', `/api/collections/users/records/${u.id}`, {
          name: f.name.value.trim(), headline: f.headline.value.trim(), location: f.location.value.trim(),
          degree: f.degree.value.trim(), mentor: f.mentor.checked, mentor_offer: f.mentor_offer.value.trim(),
        });
        state.user = r; saveAuth(); renderHeaderAuth(); close(); toast('Profile saved.');
      } catch (err) { const el = f.querySelector('.uc-err'); el.textContent = err.message || 'Save failed.'; el.hidden = false; }
    };
  }

  // ----------------------------------------------------- floating chat button
  function mountChatFab() {
    if (document.getElementById('uc-fab')) return;
    const b = document.createElement('button');
    b.id = 'uc-fab'; b.title = 'Messages';
    b.innerHTML = '<span class="iconify" data-icon="ph:chat-circle-dots-fill"></span>';
    b.onclick = () => openChat();
    document.body.appendChild(b);
  }

  // expose a tiny API for debugging / mentorship buttons elsewhere
  window.UC = { state, openAuth, openLinkedIn, openChat, openProfile, refreshLiveFeed, API };

  document.addEventListener('DOMContentLoaded', () => {
    handleOAuthRedirect();
    bootSession();
    mountChatFab();
  });
  if (document.readyState !== 'loading') { handleOAuthRedirect(); bootSession(); mountChatFab(); }
})();
