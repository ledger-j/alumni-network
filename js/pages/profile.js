/* UniCircle page module: #profile — see js/pages/_shared.js for the contract.

   Fills "my profile" from UC.state.user and shows only real numbers:
   posts (posts collection), people messaged (messages collection) and the
   per-device connect list kept by the network page (UCP.store('net_connect')).
   Emits: #map?city=…, #mentoring, #feed?compose=1                              */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  const safeUrl = (u) => (window.UC && window.UC.safeUrl ? window.UC.safeUrl(u) : (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : ''));
  const cityOf = (loc) => String(loc || '').split(/[,/·|(]/)[0].trim();
  const initials = (n) => String(n || '?').trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  const validId = (id) => /^[a-z0-9]{1,32}$/i.test(String(id || ''));

  function ago(iso) {
    const t = Date.parse(String(iso || '').replace(' ', 'T'));
    if (!t) return '';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    if (s < 86400 * 30) return Math.round(s / 86400) + 'd ago';
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  window.UCPages['profile'] = function (root) {
    const UCP = window.UCP;
    const esc = UCP.esc;
    const $ = (s) => root.querySelector(s);
    const page = $('.uc-pf-page') || root;
    const counts = { posts: null, peers: null };

    // ------------------------------------------------------------- identity
    function fill() {
      const u = UCP.user();
      const nameEl = $('[data-pf="name"]');
      if (!nameEl) return;
      if (!u) {
        nameEl.textContent = 'You’re signed out';
        $('[data-pf="headline"]').textContent = 'Sign in to see and edit your profile.';
        return;
      }
      nameEl.textContent = u.name || 'Your name';

      const hl = $('[data-pf="headline"]');
      hl.textContent = u.headline || 'Add a headline so classmates can find you.';
      hl.style.color = u.headline ? '' : 'var(--uc-muted)';

      const deg = $('[data-pf="degree"]');
      deg.hidden = !u.degree;
      deg.innerHTML = u.degree
        ? '<a href="#network?' + new URLSearchParams({ q: u.degree }).toString() + '" class="uc-pf-inline">' + esc(u.degree) + '</a>'
        : '';

      fillMedia();

      const loc = $('[data-pf="location"]');
      const city = cityOf(u.location);
      loc.innerHTML = u.location
        ? '<a href="#map?' + new URLSearchParams({ city }).toString() + '" class="uc-pf-inline" title="See ' + esc(city) + ' on the map">'
          + '<span class="iconify" data-icon="ph:map-pin-bold" aria-hidden="true"></span> ' + esc(u.location) + '</a>'
        : '<button type="button" class="uc-pf-linkbtn" data-pf-edit>Add your city</button>';

      const m = $('[data-pf="mentor"]');
      const mt = [];
      if (u.mentor) mt.push('mentoring' + (u.mentor_offer ? ' · ' + u.mentor_offer : ''));
      if (u.tutor) mt.push('tutoring' + (u.tutor_subjects ? ' · ' + u.tutor_subjects : ''));
      m.textContent = mt.length ? 'Open to ' + mt.join(' and ') : 'Mentoring & tutoring: not offered';
      m.setAttribute('title', mt.length ? 'See the Mentor & Tutor page' : 'See how mentoring and tutoring work');

      const about = $('[data-pf="about"]');
      const parts = [];
      if (u.headline) parts.push('<p style="margin:0 0 8px;"><strong style="color:var(--uc-ink);">' + esc(u.headline) + '</strong></p>');
      if (u.degree || u.location) {
        parts.push('<p style="margin:0 0 8px;">' + [u.degree ? 'Studied ' + esc(u.degree) : '', u.location ? 'based in ' + esc(u.location) : '']
          .filter(Boolean).join(', ') + '.</p>');
      }
      parts.push('<p style="margin:0;">' + (u.mentor
        ? 'Open to mentoring' + (u.mentor_offer ? ' — ' + esc(u.mentor_offer) : '') + '.'
        : 'Not offering mentoring right now. <button type="button" class="uc-pf-linkbtn" data-pf-edit>Offer mentorship</button>') + '</p>');
      about.innerHTML = u.headline || u.degree || u.location || u.mentor ? parts.join('')
        : '<p style="margin:0;">Tell your circle what you do and what you can help with — <button type="button" class="uc-pf-linkbtn" data-pf-edit>add a headline, programme and mentoring offer</button>.</p>';

      fillMentoring();
      fillContact();
      renderCounts();
      if (window.Iconify) window.Iconify.scan(page);
    }

    // ------------------------------------------------ mentoring & tutoring
    const mtForm = $('[data-pf-mt-form]');
    function fillMentoring() {
      const u = UCP.user();
      if (!mtForm) return;
      const f = mtForm.elements;
      f.role.value = u && /^(alumnus|student|staff)$/.test(String(u.role || '')) ? u.role : '';
      f.mentor.checked = !!(u && u.mentor);
      f.mentor_offer.value = (u && u.mentor_offer) || '';
      f.tutor.checked = !!(u && u.tutor);
      f.tutor_subjects.value = (u && u.tutor_subjects) || '';
      Array.from(f).forEach((el) => { if (el.tagName !== 'BUTTON') el.disabled = !u; });
    }
    if (mtForm) mtForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = UCP.user();
      if (!u) { if (window.UC) window.UC.openAuth('signin'); return; }
      if (!/^[a-z0-9]{1,32}$/i.test(String(u.id || ''))) { UCP.toast('Could not save your settings.', 'warn'); return; }
      const f = mtForm.elements;
      const btn = $('[data-pf-mt-save]');
      const body = {
        role: f.role.value,
        mentor: f.mentor.checked,
        mentor_offer: f.mentor_offer.value.trim().slice(0, 200),
        tutor: f.tutor.checked,
        tutor_subjects: f.tutor_subjects.value.trim().slice(0, 200)
      };
      if (btn) btn.disabled = true;
      try {
        const r = await window.UC.api('PATCH', '/api/collections/users/records/' + u.id, body);
        window.UC.state.user = Object.assign({}, window.UC.state.user, body, r && typeof r === 'object' ? r : {});
        UCP.toast('Mentoring & tutoring settings saved.');
        if (page.isConnected) fill();
      } catch (err) {
        UCP.toast('Could not save your settings — please try again.', 'warn');
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    function renderCounts() {
      const local = Object.keys(UCP.store('net_connect') || {}).length;
      const set = (k, v) => { const el = $('[data-pf-count="' + k + '"]'); if (el) el.textContent = v == null ? '—' : String(v); };
      set('posts', counts.posts);
      set('peers', counts.peers);
      set('connects', local);
      const line = $('[data-pf-count-line]');
      if (line) {
        line.textContent = counts.posts == null ? '—'
          : counts.posts + (counts.posts === 1 ? ' post' : ' posts')
            + (counts.peers != null ? ' · ' + counts.peers + (counts.peers === 1 ? ' conversation' : ' conversations') : '');
      }
    }


    // ------------------------------------------- shared: save to users record
    const UCx = () => window.UC;
    function adoptUser(r, body) {
      UCx().state.user = Object.assign({}, UCx().state.user, body || {}, r && typeof r === 'object' ? r : {});
      try {
        const a = JSON.parse(localStorage.getItem('uc_auth') || 'null');
        if (a && typeof a === 'object') { a.user = UCx().state.user; localStorage.setItem('uc_auth', JSON.stringify(a)); }
      } catch (e) { /* storage unavailable */ }
    }
    const ownId = () => { const u = UCP.user(); return u && validId(u.id) ? u.id : null; };
    const needUser = () => { if (UCP.user()) return true; if (window.UC && window.UC.openAuth) window.UC.openAuth('signin'); return false; };

    // ------------------------------------------------------- cover + avatar
    let bandFx = null;
    function fillMedia() {
      const u = UCP.user();
      const av = $('[data-pf="avatar"]');
      if (av) {
        if (u && u.avatar && UCx() && UCx().avatarUrl) {
          av.innerHTML = '<img src="' + esc(UCx().avatarUrl(u, 256)) + '" alt="' + esc((u.name || 'Your') + ' profile photo') + '">';
        } else {
          av.textContent = initials((u && (u.name || u.email)) || '?');
        }
      }
      const img = $('[data-pf-cover-img]');
      const cv = $('[data-pf-cover-canvas]');
      const rm = $('[data-pf-cover-remove]');
      const url = u && UCx() && UCx().coverUrl ? UCx().coverUrl(u, 1584, 396) : null;
      if (img) { img.hidden = !url; if (url) img.src = url; else img.removeAttribute('src'); }
      if (rm) rm.hidden = !url;
      if (cv) {
        cv.hidden = !!url;
        if (!url && !bandFx && window.UCConstellation && typeof window.UCConstellation.mount === 'function') {
          try {
            const pal = window.UCTheme && window.UCTheme.palette ? window.UCTheme.palette(0.62) : null;
            bandFx = window.UCConstellation.mount(cv, Object.assign({ count: 36, wash: null }, pal ? { palette: pal } : {}));
          } catch (e) { bandFx = null; }
        }
      }
      const own = !!u;
      root.querySelectorAll('[data-pf-photo-change],[data-pf-cover-change]').forEach((b) => { b.hidden = !own; });
    }

    async function changeImage(kind) {
      if (!needUser()) return;
      const id = ownId();
      const U = UCx();
      if (!id || !U.pickImage || !U.cropImage || !U.uploadMedia) { UCP.toast('Image upload is not available right now.', 'warn'); return; }
      const isAv = kind === 'avatar';
      let file;
      try { file = await U.pickImage(); } catch (e) { file = null; }
      if (!file) return;
      let out;
      try {
        out = await U.cropImage(file, isAv
          ? { width: 400, height: 400, mime: 'image/jpeg', maxBytes: 2 * 1024 * 1024 }
          : { width: 1584, height: 396, mime: 'image/jpeg', maxBytes: 5 * 1024 * 1024 });
      } catch (e) { UCP.toast(e && e.message ? e.message : 'Could not read that image.', 'warn'); return; }
      const url = URL.createObjectURL(out.blob);
      const kb = Math.max(1, Math.round(out.blob.size / 1024));
      let saving = false;
      const close = UCP.dialog({
        title: isAv ? 'New profile photo' : 'New cover image',
        body: '<div class="uc-pf-prev"><img src="' + esc(url) + '" alt="Preview of your new ' + (isAv ? 'photo' : 'cover') + '"' + (isAv ? ' class="uc-pf-prev-av"' : '') + '>'
          + '<p class="uc-pf-fine" style="margin:0;text-align:center;">Cropped to ' + (isAv ? '400 × 400' : '1584 × 396') + ', about ' + kb + ' KB. Visible to all UniCircle members.</p></div>',
        actions: [
          { label: 'Cancel', onClick: (c) => { if (!saving) c(); } },
          { label: 'Save', primary: true, onClick: async (c, d) => {
            if (saving) return;
            saving = true;
            const btn = d && d.querySelector('button.uc-btn-dark');
            if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
            try {
              const r = await U.uploadMedia('/api/collections/users/records/' + id, 'PATCH', {}, isAv ? 'avatar' : 'cover', out.blob, out.name);
              adoptUser(r);
              UCP.toast(isAv ? 'Photo updated.' : 'Cover updated.');
              c();
              if (page.isConnected) fillMedia();
            } catch (err) {
              saving = false;
              if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
              UCP.toast(err && err.message ? err.message : 'Could not upload the image.', 'warn');
            }
          } }
        ]
      });
      if (close && close.el) close.el.addEventListener('close', () => URL.revokeObjectURL(url));
    }

    function removeCover() {
      if (!needUser()) return;
      const id = ownId();
      if (!id) return;
      UCP.dialog({
        title: 'Remove your cover?',
        body: '<p style="margin:0;">Your cover image will be deleted and the calm default band shows instead.</p>',
        actions: [
          { label: 'Keep it' },
          { label: 'Remove cover', primary: true, onClick: async (c) => {
            try {
              const r = await UCx().api('PATCH', '/api/collections/users/records/' + id, { cover: null });
              adoptUser(r, { cover: '' });
              UCP.toast('Cover removed.');
              c();
              if (page.isConnected) fillMedia();
            } catch (err) { UCP.toast(err && err.message ? err.message : 'Could not remove the cover.', 'warn'); }
          } }
        ]
      });
    }

    // ------------------------------------------------------- contact settings
    const ctForm = $('[data-pf-ct-form]');
    function ctSync() {
      if (!ctForm) return;
      const mode = (ctForm.elements.contact_mode.value || 'open');
      const box = $('[data-pf-ct-points]');
      if (box) box.hidden = mode !== 'points';
    }
    function fillContact() {
      if (!ctForm) return;
      const u = UCP.user();
      const f = ctForm.elements;
      const mode = u && /^(open|points|request|closed)$/.test(String(u.contact_mode || '')) ? u.contact_mode : 'open';
      Array.from(f.contact_mode).forEach((r) => { r.checked = r.value === mode; });
      f.min_points.value = u && u.min_points != null && u.min_points !== '' ? String(u.min_points) : '10';
      f.accepts_internship.checked = !!(u && u.accepts_internship);
      f.accepts_mentoring.checked = !!(u && u.accepts_mentoring);
      f.accepts_collab.checked = !!(u && u.accepts_collab);
      const have = $('[data-pf-ct-have]');
      if (have) { const n = Number(u && u.points) || 0; have.textContent = 'You have ' + n + ' status point' + (n === 1 ? '' : 's') + '.'; }
      Array.from(f).forEach((el) => { if (el.tagName !== 'BUTTON') el.disabled = !u; });
      ctSync();
    }
    if (ctForm) {
      ctForm.addEventListener('change', ctSync);
      ctForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!needUser()) return;
        const id = ownId();
        if (!id) { UCP.toast('Could not save your settings.', 'warn'); return; }
        const f = ctForm.elements;
        const mode = f.contact_mode.value || 'open';
        let min = Math.round(Number(f.min_points.value));
        if (!isFinite(min)) min = 10;
        min = Math.max(0, Math.min(10000, min));
        const body = {
          contact_mode: mode, min_points: min,
          accepts_internship: f.accepts_internship.checked,
          accepts_mentoring: f.accepts_mentoring.checked,
          accepts_collab: f.accepts_collab.checked
        };
        const btn = $('[data-pf-ct-save]');
        if (btn) btn.disabled = true;
        try {
          const r = await UCx().api('PATCH', '/api/collections/users/records/' + id, body);
          adoptUser(r, body);
          UCP.toast('Contact settings saved.');
          if (page.isConnected) fillContact();
        } catch (err) {
          UCP.toast(err && err.message ? err.message : 'Could not save your settings.', 'warn');
        } finally { if (btn) btn.disabled = false; }
      });
    }

    // ----------------------------------------------------------- my colour
    // Stored accent_hue: 1..360 (360 = hue 0), 0/empty = default look.
    const T = window.UCTheme;
    const colNote = $('[data-pf-col-note]');
    const slider = $('[data-pf-hue]');
    const hueN = $('[data-pf-hue-n]');
    let committed = T ? T.get() : null;
    let settingsRow = null;
    function showHue(h) {
      if (slider && h != null) slider.value = String(h);
      if (hueN) hueN.textContent = h == null ? 'default' : String(h);
      root.querySelectorAll('[data-pf-swatch]').forEach((b) => {
        const v = b.dataset.pfSwatch === '' ? null : Number(b.dataset.pfSwatch);
        b.setAttribute('aria-pressed', String(v === h));
      });
    }
    if (T && slider) {
      const sw = $('[data-pf-swatches]');
      sw.innerHTML = (T.presets || []).map((p) =>
        '<button type="button" class="uc-pf-swatch" data-pf-swatch="' + (p.hue == null ? '' : Number(p.hue)) + '" aria-pressed="false">'
        + '<i style="background:' + (p.hue == null ? 'oklch(0.34 0.02 90)' : 'oklch(0.5 0.13 ' + Number(p.hue) + ')') + '"></i>' + esc(p.name) + '</button>').join('');
      sw.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pf-swatch]');
        if (!b) return;
        const h = b.dataset.pfSwatch === '' ? null : Number(b.dataset.pfSwatch);
        T.set(h); showHue(h);
      });
      slider.addEventListener('input', () => {
        const h = Math.max(0, Math.min(360, Math.round(Number(slider.value) || 0)));
        T.set(h); showHue(T.get());
      });
      showHue(committed);
      $('[data-pf-col-cancel]').addEventListener('click', () => { T.set(committed); showHue(committed); if (colNote) colNote.textContent = 'Back to your saved colour.'; });
      $('[data-pf-col-reset]').addEventListener('click', () => { T.set(null); showHue(null); if (colNote) colNote.textContent = 'Default colour. Press Save to keep it.'; });
      $('[data-pf-col-save]').addEventListener('click', async () => {
        if (!needUser()) return;
        const id = ownId();
        if (!id) return;
        const cur = T.get();
        const val = cur == null ? 0 : (cur === 0 ? 360 : Math.max(1, Math.min(360, Math.round(cur))));
        const btn = $('[data-pf-col-save]');
        btn.disabled = true;
        try {
          if (!settingsRow) {
            const r = await UCx().api('GET', '/api/collections/user_settings/records?perPage=1&filter=' + encodeURIComponent('(user="' + id + '")'));
            settingsRow = (r.items || [])[0] || null;
          }
          if (settingsRow) settingsRow = await UCx().api('PATCH', '/api/collections/user_settings/records/' + settingsRow.id, { accent_hue: val });
          else settingsRow = await UCx().api('POST', '/api/collections/user_settings/records', { user: id, accent_hue: val });
          committed = cur;
          UCP.toast('Colour saved.');
          if (colNote) colNote.textContent = 'Saved.';
        } catch (err) {
          UCP.toast(err && err.message ? err.message : 'Could not save your colour.', 'warn');
        } finally { btn.disabled = false; }
      });
      // bring the server copy in (the device copy shows first)
      const id0 = ownId();
      if (id0 && UCP.online()) {
        UCx().api('GET', '/api/collections/user_settings/records?perPage=1&filter=' + encodeURIComponent('(user="' + id0 + '")'))
          .then((r) => {
            if (!page.isConnected) return;
            settingsRow = (r.items || [])[0] || null;
            if (!settingsRow) return;
            const v = Math.round(Number(settingsRow.accent_hue) || 0);
            const h = v <= 0 ? null : (v >= 360 ? 0 : v);
            if (h !== T.get() && T.get() === committed) { T.set(h); committed = h; showHue(h); }
          }).catch(() => { /* keep device copy */ });
      }
    } else if ($('#uc-pf-colour')) { $('#uc-pf-colour').hidden = true; }

    // ------------------------------------------------------ delete account
    function deleteAccount() {
      if (!needUser()) return;
      const id = ownId();
      if (!id) return;
      let go;
      const close = UCP.dialog({
        title: 'Delete my account',
        body: '<p style="margin:0 0 8px;">This permanently removes your profile, messages, mentorships, uploads, points and the events you host. <strong>It cannot be undone.</strong></p>'
          + '<label for="uc-pf-del-in" class="uc-mc-label">Type DELETE to confirm</label>'
          + '<input id="uc-pf-del-in" class="uc-pf-del-in" type="text" autocomplete="off" autocapitalize="characters" maxlength="10">',
        actions: [
          { label: 'Keep my account' },
          { label: 'Delete forever', primary: true, onClick: async (c, d) => {
            const inp = d.querySelector('#uc-pf-del-in');
            if (!inp || inp.value.trim() !== 'DELETE') { UCP.toast('Type DELETE to confirm.', 'warn'); return; }
            go.disabled = true;
            try {
              await UCx().api('DELETE', '/api/collections/users/records/' + id);
              try { localStorage.removeItem('uc_auth'); } catch (e) { /* ignore */ }
              c();
              location.hash = '';
              location.reload();
            } catch (err) {
              go.disabled = false;
              UCP.toast(err && err.message ? err.message : 'Could not delete the account.', 'warn');
            }
          } }
        ]
      });
      go = close.el.querySelector('button.uc-btn-dark');
      go.disabled = true;
      close.el.querySelector('#uc-pf-del-in').addEventListener('input', (e) => { go.disabled = e.target.value.trim() !== 'DELETE'; });
    }

    // -------------------------------------------------------------- posts
    function renderPosts(items, err) {
      const box = $('[data-pf-posts]');
      if (!box) return;
      if (err) { box.innerHTML = '<p class="uc-pf-empty">' + esc(err) + '</p>'; return; }
      if (!items.length) {
        box.innerHTML = '<p class="uc-pf-empty">You haven’t posted yet. <button type="button" class="uc-pf-linkbtn" data-pf-compose>Write your first post</button></p>';
        return;
      }
      box.innerHTML = items.map((p) => {
        const text = String(p.text || '');
        const short = text.length > 280 ? text.slice(0, 277) + '…' : text;
        const likes = Number(p.likes) || 0;
        return '<article class="uc-stat uc-pf-post">'
          + '<div style="font-size:12px;color:var(--uc-muted);margin-bottom:8px;">' + esc(ago(p.created)) + (p.degree ? ' · ' + esc(p.degree) : '') + '</div>'
          + '<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:var(--uc-ink);white-space:pre-line;">' + esc(short) + '</p>'
          + '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--uc-muted);">'
          + '<span>' + likes + (likes === 1 ? ' like' : ' likes') + '</span>'
          + '<a href="#feed" class="uc-pf-inline" style="font-weight:600;">Open feed</a></div></article>';
      }).join('');
    }

    async function loadData() {
      const u = UCP.user();
      if (!u) { renderPosts([], 'Sign in to see your posts.'); return; }
      if (!UCP.online()) {
        renderPosts([], 'The network is offline right now — your posts will show when it’s back.');
        $('[data-pf-stats-note]').textContent = 'Offline — counts unavailable';
        return;
      }
      if (!validId(u.id)) { renderPosts([], 'Couldn’t load your posts.'); return; }
      const postsQ = '/api/collections/posts/records?perPage=50&sort=-created&filter=' + encodeURIComponent("(author='" + u.id + "')");
      const msgQ = '/api/collections/messages/records?perPage=200&fields=sender,recipient&filter='
        + encodeURIComponent("(sender='" + u.id + "' || recipient='" + u.id + "')");
      const [posts, msgs] = await Promise.allSettled([UCP.api('GET', postsQ), UCP.api('GET', msgQ)]);
      if (!page.isConnected) return;
      if (posts.status === 'fulfilled') {
        counts.posts = Number(posts.value.totalItems != null ? posts.value.totalItems : (posts.value.items || []).length);
        renderPosts(posts.value.items || []);
      } else {
        renderPosts([], 'Couldn’t load your posts right now.');
      }
      if (msgs.status === 'fulfilled') {
        const peers = new Set();
        (msgs.value.items || []).forEach((m) => {
          if (m.sender && m.sender !== u.id) peers.add(m.sender);
          if (m.recipient && m.recipient !== u.id) peers.add(m.recipient);
        });
        counts.peers = peers.size;
      }
      renderCounts();
    }

    // ------------------------------------------------------------ actions
    // UC.openProfile() replaces UC.state.user on save; re-fill when it changes.
    function edit() {
      if (!(window.UC && window.UC.openProfile)) return;
      const before = UCP.user();
      window.UC.openProfile();
      let n = 0;
      const t = setInterval(() => {
        n++;
        if (!page.isConnected || n > 600) { clearInterval(t); return; }
        if (UCP.user() !== before) { clearInterval(t); fill(); }
      }, 500);
    }

    function contactInfo() {
      const u = UCP.user();
      if (!u) { if (window.UC) window.UC.openAuth('signin'); return; }
      const li = safeUrl(u.linkedin_url);
      const body = '<dl class="uc-net-dl">'
        + '<div class="uc-net-dl-r"><dt>Email</dt><dd>' + (u.email
          ? '<a href="mailto:' + esc(u.email) + '">' + esc(u.email) + '</a>' : 'Hidden') + '</dd></div>'
        + '<div class="uc-net-dl-r"><dt>LinkedIn</dt><dd>' + (li
          ? '<a href="' + esc(li) + '" target="_blank" rel="noopener noreferrer">' + esc(li.replace(/^https:\/\/(www\.)?/i, '')) + ' ↗</a>'
          : 'Not added yet — use “Import from LinkedIn”.') + '</dd></div>'
        + '</dl><p style="margin:12px 0 0;font-size:12px;color:var(--uc-muted);">Members reach you through UniCircle messages; your email is not shown in the directory.</p>';
      UCP.dialog({
        title: 'Contact info', body,
        actions: [{ label: 'Edit profile', onClick: (close) => { close(); edit(); } }, { label: 'Close', primary: true }]
      });
    }

    function selectTab(name, focus) {
      root.querySelectorAll('[data-pf-tab]').forEach((b) => {
        const on = b.dataset.pfTab === name;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        b.classList.toggle('uc-pill-ink', on);
        b.classList.toggle('uc-pill-ghost', !on);
        if (on && focus) b.focus();
      });
      root.querySelectorAll('[data-pf-panel]').forEach((p) => { p.hidden = p.dataset.pfPanel !== name; });
    }

    // Event delegation: some buttons are re-rendered by fill()/renderPosts().
    page.addEventListener('click', (e) => {
      const t = e.target.closest('button, a');
      if (!t || !page.contains(t)) return;
      if (t.hasAttribute('data-pf-edit')) { edit(); return; }
      if (t.hasAttribute('data-pf-enhance')) {
        if (!UCP.user()) { window.UC && window.UC.openAuth('signin'); return; }
        if (window.UC && window.UC.openLinkedIn) window.UC.openLinkedIn(); else edit();
        return;
      }
      if (t.hasAttribute('data-pf-contact')) { contactInfo(); return; }
      if (t.hasAttribute('data-pf-photo-change')) { changeImage('avatar'); return; }
      if (t.hasAttribute('data-pf-cover-change')) { changeImage('cover'); return; }
      if (t.hasAttribute('data-pf-cover-remove')) { removeCover(); return; }
      if (t.hasAttribute('data-pf-delete')) { deleteAccount(); return; }
      if (t.hasAttribute('data-pf-compose')) { UCP.go('feed', { compose: 1 }); return; }
      if (t.hasAttribute('data-pf-tab')) selectTab(t.dataset.pfTab);
    });
    const tablist = $('[role="tablist"]');
    if (tablist) tablist.addEventListener('keydown', (e) => {
      const tabs = Array.from(tablist.querySelectorAll('[data-pf-tab]'));
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      let j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j >= 0) { e.preventDefault(); selectTab(tabs[j].dataset.pfTab, true); }
    });

    fill();
    const sec = UCP.params ? UCP.params().get('section') : null;
    if (sec === 'mentoring') {
      const card = $('#uc-pf-mentoring');
      if (card) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
    loadData().catch(() => renderPosts([], 'Couldn’t load your posts right now.'));

    // Slots filled by other lanes (points, deep profile, collaboration inbox).
    ['profilePoints', 'profileDeep'].forEach((n) => {
      try { if (window.UCPages && typeof window.UCPages[n] === 'function') window.UCPages[n](root); } catch (e) { console.warn('[profile] slot ' + n, e); }
    });
    try {
      if (window.UCCollab && window.UCCollab.mountInbox) window.UCCollab.mountInbox(root.querySelector('[data-uc-slot="collab"]'));
    } catch (e) { console.warn('[profile] collab slot', e); }
  };
})();
