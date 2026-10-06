/* UniCircle page module: #profile — see js/pages/_shared.js for the contract.

   Fills "my profile" from UC.state.user and shows only real numbers:
   posts (posts collection), people messaged (messages collection) and the
   per-device connect list kept by the network page (UCP.store('net_connect')).
   Emits: #map?city=…, #mentoring, #feed?compose=1                              */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  const safeUrl = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : '');
  const cityOf = (loc) => String(loc || '').split(/[,/·|(]/)[0].trim();
  const initials = (n) => String(n || '?').trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  const validId = (id) => /^[a-z0-9]{5,30}$/i.test(String(id || ''));

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

      const av = $('[data-pf="avatar"]');
      const api = (window.UC && window.UC.API) || '';
      if (u.avatar && u.collectionId) {
        const src = api + '/api/files/' + encodeURIComponent(u.collectionId) + '/' + encodeURIComponent(u.id) + '/' + encodeURIComponent(u.avatar);
        av.innerHTML = '<img src="' + esc(src) + '" alt="' + esc(u.name || 'Your avatar') + '">';
      } else {
        av.textContent = initials(u.name || u.email || '?');
      }

      const loc = $('[data-pf="location"]');
      const city = cityOf(u.location);
      loc.innerHTML = u.location
        ? '<a href="#map?' + new URLSearchParams({ city }).toString() + '" class="uc-pf-inline" title="See ' + esc(city) + ' on the map">'
          + '<span class="iconify" data-icon="ph:map-pin-bold" aria-hidden="true"></span> ' + esc(u.location) + '</a>'
        : '<button type="button" class="uc-pf-linkbtn" data-pf-edit>Add your city</button>';

      const m = $('[data-pf="mentor"]');
      m.textContent = u.mentor ? 'Mentoring: open' + (u.mentor_offer ? ' · ' + u.mentor_offer : '') : 'Mentoring: not offered';
      m.setAttribute('title', u.mentor ? 'See the mentoring page' : 'See how mentoring works');

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

      renderCounts();
      if (window.Iconify) window.Iconify.scan(page);
    }

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
    loadData().catch(() => renderPosts([], 'Couldn’t load your posts right now.'));
  };
})();
