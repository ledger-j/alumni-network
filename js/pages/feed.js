/* UniCircle page module: #feed -- see js/pages/_shared.js for the contract.

   Live feed (PocketBase `posts`), composer, per-viewer like toggle, author
   delete, and horizontal cross-links (author/#tag/degree -> #network?q=...,
   city -> #map?city=...). Never uses the legacy `.feed-posts-list` / `.uc-live-post`
   classes (unicircle.js observes those and would inject old cards). */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  const PER_PAGE = 30;
  const SYSTEM_NAME = 'UniCircle';
  const LIKES_KEY = 'feed_likes';

  const UCP = () => window.UCP;
  const esc = (s) => UCP().esc(s);

  // Build a hash exactly the way UCP.go does, for real <a href> links.
  const hashFor = (page, params) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return '#' + page + (qs ? '?' + qs : '');
  };

  const initials = (name) => String(name || '?').trim().split(/\s+/)
    .map((s) => s[0] || '').slice(0, 2).join('').toUpperCase() || '?';

  const hueOf = (seed) => {
    let h = 0;
    const s = String(seed || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return [235, 275, 305, 185, 145, 45, 25][h % 7];
  };

  const parseDate = (v) => {
    if (!v) return null;
    const t = Date.parse(String(v).replace(' ', 'T'));
    return Number.isNaN(t) ? null : new Date(t);
  };

  function relTime(v) {
    const d = parseDate(v);
    if (!d) return '';
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 45) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + ' h ago';
    const days = Math.round(h / 24);
    if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago');
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  const cityOf = (location) => String(location || '').split(/[,\u00b7|]/)[0].trim();

  function avatarUrl(u) {
    if (!u || !u.avatar || !u.collectionId || !u.id || !window.UC || !window.UC.API) return '';
    return window.UC.API + '/api/files/' + encodeURIComponent(u.collectionId) + '/'
      + encodeURIComponent(u.id) + '/' + encodeURIComponent(u.avatar);
  }

  function avatarHtml(u, cls) {
    const name = (u && u.name) || '';
    const url = avatarUrl(u);
    return '<div class="uc-avatar-initials ' + cls + '" style="background:oklch(0.9 0.06 ' + hueOf((u && u.id) || name) + ');" aria-hidden="true">'
      + esc(initials(name))
      + (url ? '<img src="' + esc(url) + '" alt="" loading="lazy" data-uc-feed-avatar-img>' : '')
      + '</div>';
  }

  // Escaped post text -> HTML with safe autolinks, #tag cross-links and <br>.
  function richText(text) {
    // Plain segment: escape, then link #tags (tag chars never include & or ;,
    // so escaped entities like &#39; can't be mistaken for tags).
    const plain = (seg) => esc(seg)
      .replace(/(^|\s)#([\p{L}\p{N}_-]{2,40})/gu, (m, pre, tag) =>
        pre + '<a href="' + esc(hashFor('network', { q: tag })) + '" class="uc-feed-tag">#' + tag + '</a>')
      .replace(/\r?\n/g, '<br>');
    const raw = String(text == null ? '' : text);
    const re = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(raw))) {
      out += plain(raw.slice(last, m.index))
        + '<a href="' + esc(m[0]) + '" target="_blank" rel="noopener noreferrer nofollow ugc" class="uc-feed-ext">' + esc(m[0]) + '</a>';
      last = re.lastIndex;
    }
    return out + plain(raw.slice(last));
  }

  const likes = () => UCP().store(LIKES_KEY) || {};

  function postHtml(p) {
    const a = (p.expand && p.expand.author) || null;
    const me = UCP().user();
    const name = (a && a.name) || 'Member';
    const official = !!(a && a.name === SYSTEM_NAME);
    const mine = !!(me && p.author && p.author === me.id);
    const liked = !!likes()[p.id];
    const created = parseDate(p.created);
    const city = a ? cityOf(a.location) : '';
    const img = p.image && /^https?:\/\//i.test(p.image) ? p.image : '';

    const nameHtml = a && !official
      ? '<a href="' + esc(hashFor('network', { q: name })) + '" class="uc-feed-name">' + esc(name) + '</a>'
      : '<span class="uc-feed-name">' + esc(name) + '</span>';

    const metaBits = [];
    if (a && a.headline) metaBits.push(esc(a.headline));
    if (city) metaBits.push('<a href="' + esc(hashFor('map', { city })) + '" class="uc-feed-city">' + esc(city) + '</a>');

    return '<article class="uc-card uc-feed-post" data-uc-post="' + esc(p.id) + '" aria-label="Post by ' + esc(name) + '">'
      + '<header class="uc-feed-head">'
      + avatarHtml(a || { name }, 'uc-feed-avatar')
      + '<div class="uc-feed-who">'
      + '<div class="uc-feed-nameline">' + nameHtml
      + (official ? ' <span class="uc-feed-chip uc-feed-official">Official</span>' : '')
      + (p.degree ? ' <a href="' + esc(hashFor('network', { q: p.degree })) + '" class="uc-feed-chip">' + esc(p.degree) + '</a>' : '')
      + '</div>'
      + (metaBits.length ? '<div class="uc-feed-meta">' + metaBits.join(' \u00b7 ') + '</div>' : '')
      + (created ? '<time class="uc-feed-time" datetime="' + esc(created.toISOString()) + '" title="' + esc(created.toLocaleString()) + '">' + esc(relTime(p.created)) + '</time>' : '')
      + '</div></header>'
      + '<div class="uc-feed-text">' + richText(p.text) + '</div>'
      + (img ? '<div class="uc-feed-img"><img src="' + esc(img) + '" alt="Image shared by ' + esc(name) + '" loading="lazy" data-uc-feed-post-img></div>' : '')
      + '<footer class="uc-feed-actions">'
      + '<button type="button" class="uc-feed-act" data-uc-like aria-pressed="' + liked + '" title="Saved on this device only">'
      + '<span class="iconify" data-icon="' + (liked ? 'ph:heart-fill' : 'ph:heart') + '" aria-hidden="true"></span>'
      + '<span data-uc-like-label>' + (liked ? 'Liked' : 'Like') + '</span></button>'
      + (p.likes > 0 ? '<span class="uc-feed-count">' + esc(p.likes) + (p.likes === 1 ? ' like' : ' likes') + '</span>' : '')
      + '<span style="flex:1"></span>'
      + (a && !mine && !official && a.id ? '<button type="button" class="uc-feed-act" data-uc-msg="' + esc(a.id) + '" aria-label="Message ' + esc(name) + '"><span class="iconify" data-icon="ph:chat-circle" aria-hidden="true"></span><span>Message</span></button>' : '')
      + (mine ? '<button type="button" class="uc-feed-act uc-feed-del" data-uc-del aria-label="Delete this post"><span class="iconify" data-icon="ph:trash" aria-hidden="true"></span><span>Delete</span></button>' : '')
      + '</footer></article>';
  }

  function stateHtml(kind) {
    if (kind === 'offline') {
      return '<div class="uc-card uc-feed-state" data-uc-feed-state>'
        + '<span class="iconify" data-icon="ph:wifi-slash" aria-hidden="true"></span>'
        + '<p class="uc-serif">The live feed is out of reach right now.</p>'
        + '<p class="uc-feed-state-sub">We could not contact the UniCircle server. Check your connection and try again.</p>'
        + '<button type="button" class="uc-btn-ghost" data-uc-feed-retry>Try again</button></div>';
    }
    return '<div class="uc-card uc-feed-state" data-uc-feed-state data-uc-feed-empty>'
      + '<span class="iconify" data-icon="ph:pencil-simple-line" aria-hidden="true"></span>'
      + '<p class="uc-serif">The feed is quiet \u2014 be the first to post.</p>'
      + '<p class="uc-feed-state-sub">Share a career update, a question for your programme, or an opportunity.</p>'
      + '<button type="button" class="uc-btn-dark" data-uc-feed-compose-focus>Write a post</button></div>';
  }

  window.UCPages['feed'] = function (root) {
    const list = root.querySelector('[data-uc-feed-list]');
    if (!list) return;
    const form = root.querySelector('[data-uc-feed-compose]');
    const ta = root.querySelector('#uc-feed-text');
    const submitBtn = root.querySelector('[data-uc-feed-submit]');
    const hint = root.querySelector('[data-uc-feed-hint]');
    const moreWrap = root.querySelector('[data-uc-feed-more-wrap]');
    const moreBtn = root.querySelector('[data-uc-feed-more]');
    const scan = (el) => { if (window.Iconify) window.Iconify.scan(el); };

    let page = 0;
    let totalPages = 1;
    let loading = false;
    const seen = new Set();

    // ---- composer avatar / signed-out affordance
    const me = UCP().user();
    const meAv = root.querySelector('[data-uc-feed-me]');
    if (meAv) {
      if (me) {
        meAv.outerHTML = avatarHtml(me, 'uc-feed-avatar');
      } else {
        meAv.textContent = '?';
      }
    }
    if (!me && hint) hint.textContent = 'Sign in to post to your circle.';

    // ---- mentorship panel: personalise the search with the viewer's degree
    const mLink = root.querySelector('[data-uc-feed-mentor-link]');
    if (mLink && me && me.degree) mLink.setAttribute('href', hashFor('mentoring', { q: me.degree }));
    const mCopy = root.querySelector('[data-uc-feed-mentor-copy]');
    if (mCopy && me && me.mentor) {
      mCopy.innerHTML = 'You offer mentoring \u2014 <em style="font-style:italic;">thank you.</em>';
    }

    // ---- live feed
    async function load(next) {
      if (loading) return;
      loading = true;
      list.setAttribute('aria-busy', 'true');
      if (moreBtn) { moreBtn.disabled = true; moreBtn.textContent = 'Loading\u2026'; }
      const want = next ? page + 1 : 1;
      try {
        const r = await UCP().api('GET', '/api/collections/posts/records?sort=-created&perPage='
          + PER_PAGE + '&page=' + want + '&expand=author');
        if (!list.isConnected) return;
        const items = (r && r.items) || [];
        page = want;
        totalPages = (r && r.totalPages) || 1;
        if (!next) { list.innerHTML = ''; seen.clear(); }
        const fresh = items.filter((p) => p && p.id && !seen.has(p.id));
        fresh.forEach((p) => seen.add(p.id));
        if (!next && !fresh.length) {
          list.innerHTML = stateHtml('empty');
        } else if (fresh.length) {
          list.insertAdjacentHTML('beforeend', fresh.map(postHtml).join(''));
        }
      } catch (err) {
        if (!list.isConnected) return;
        if (next) {
          UCP().toast('Could not load more posts.', 'warn');
        } else {
          list.innerHTML = stateHtml('offline');
        }
      } finally {
        loading = false;
        if (list.isConnected) {
          list.setAttribute('aria-busy', 'false');
          if (moreWrap) moreWrap.hidden = !(page >= 1 && page < totalPages);
          if (moreBtn) { moreBtn.disabled = false; moreBtn.textContent = 'Load more posts'; }
          scan(list);
        }
      }
    }

    moreBtn && moreBtn.addEventListener('click', () => load(true));
    root.querySelector('[data-uc-feed-refresh]')?.addEventListener('click', () => load(false));

    // Broken avatars / images: fall back to initials, drop a dead image.
    list.addEventListener('error', (e) => {
      const t = e.target;
      if (t && t.matches && t.matches('[data-uc-feed-avatar-img]')) t.remove();
      else if (t && t.matches && t.matches('[data-uc-feed-post-img]')) t.closest('.uc-feed-img')?.remove();
    }, true);

    // ---- per-post actions (delegated)
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !list.contains(btn)) return;

      if (btn.hasAttribute('data-uc-feed-retry')) { load(false); return; }
      if (btn.hasAttribute('data-uc-feed-compose-focus')) { focusComposer(); return; }

      const card = btn.closest('[data-uc-post]');
      if (!card) return;
      const id = card.getAttribute('data-uc-post');

      if (btn.hasAttribute('data-uc-like')) {
        // Visual, per-viewer only -- never PATCHes the shared like count.
        const map = likes();
        const on = !map[id];
        if (on) map[id] = 1; else delete map[id];
        UCP().store(LIKES_KEY, map);
        btn.setAttribute('aria-pressed', String(on));
        btn.querySelector('[data-uc-like-label]').textContent = on ? 'Liked' : 'Like';
        const icon = btn.querySelector('.iconify, svg');
        if (icon) {
          const span = document.createElement('span');
          span.className = 'iconify';
          span.setAttribute('aria-hidden', 'true');
          span.setAttribute('data-icon', on ? 'ph:heart-fill' : 'ph:heart');
          icon.replaceWith(span);
          scan(btn);
        }
        return;
      }

      if (btn.hasAttribute('data-uc-msg')) {
        if (window.UC && window.UC.openChat) window.UC.openChat(btn.getAttribute('data-uc-msg'));
        return;
      }

      if (btn.hasAttribute('data-uc-del')) {
        UCP().dialog({
          title: 'Delete this post?',
          body: '<p>It will be removed from the feed for everyone. This cannot be undone.</p>',
          actions: [
            { label: 'Cancel' },
            {
              label: 'Delete post', primary: true,
              onClick: async (close, d) => {
                const b = d && d.querySelector('.uc-dialog-actions .uc-btn-dark');
                if (b) { b.disabled = true; b.textContent = 'Deleting\u2026'; }
                try {
                  await UCP().api('DELETE', '/api/collections/posts/records/' + encodeURIComponent(id));
                  close();
                  seen.delete(id);
                  card.remove();
                  if (!list.querySelector('[data-uc-post]')) { list.innerHTML = stateHtml('empty'); scan(list); }
                  UCP().toast('Post deleted.');
                } catch (err) {
                  if (b) { b.disabled = false; b.textContent = 'Delete post'; }
                  UCP().toast('Could not delete the post. Please try again.', 'warn');
                }
              }
            }
          ]
        });
      }
    });

    // ---- composer
    function focusComposer() {
      if (!ta) return;
      ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ta.focus({ preventScroll: true });
    }

    if (ta && !me) {
      ta.addEventListener('focus', () => { if (!UCP().user() && window.UC) window.UC.openAuth('signin'); }, { once: true });
    }

    ta && ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
    });

    form && form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = UCP().user();
      if (!user) { if (window.UC) window.UC.openAuth('signin'); return; }
      const text = (ta.value || '').trim();
      if (!text) { ta.focus(); if (hint) hint.textContent = 'Write something first.'; return; }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting\u2026';
      try {
        const rec = await UCP().api('POST', '/api/collections/posts/records', { author: user.id, text, degree: '', likes: 0 });
        rec.expand = rec.expand || {};
        rec.expand.author = rec.expand.author || user;
        if (!rec.created) rec.created = new Date().toISOString();
        ta.value = '';
        if (hint) hint.textContent = 'Posted. Visible to all members of your circle.';
        list.querySelector('[data-uc-feed-state]')?.remove();
        if (rec.id) seen.add(rec.id);
        list.insertAdjacentHTML('afterbegin', postHtml(rec));
        scan(list);
        UCP().toast('Posted to your circle.');
      } catch (err) {
        if (err && (err.status === 401 || err.status === 403)) {
          UCP().toast('Your session has expired \u2014 please sign in again.', 'warn');
          if (window.UC) window.UC.openAuth('signin');
        } else {
          UCP().toast('Could not publish your post. Check your connection and try again.', 'warn');
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
      }
    });

    // ---- "New in your circle": swap the sample people for real newest members
    async function loadPeople() {
      const box = root.querySelector('[data-uc-feed-people]');
      const user = UCP().user();
      if (!box || !user) return;
      try {
        const flt = encodeURIComponent('id != "' + String(user.id).replace(/"/g, '') + '"');
        const r = await UCP().api('GET', '/api/collections/users/records?sort=-created&perPage=3&filter=' + flt);
        const people = (r && r.items) || [];
        if (!people.length || !box.isConnected) return;
        box.innerHTML = people.map((u) => {
          const name = u.name || 'Member';
          const city = cityOf(u.location);
          const sub = [u.headline ? esc(u.headline) : (u.degree ? esc(u.degree) : '')]
            .concat(city ? ['<a href="' + esc(hashFor('map', { city, layer: 'alumni' })) + '" class="uc-feed-city">' + esc(city) + '</a>'] : [])
            .filter(Boolean).join(' \u00b7 ');
          return '<div class="uc-feed-person">' + avatarHtml(u, 'uc-feed-avatar-sm')
            + '<div style="flex:1;min-width:0;"><a href="' + esc(hashFor('network', { q: name })) + '" class="uc-feed-side-title">' + esc(name) + '</a>'
            + (sub ? '<div class="uc-feed-side-sub">' + sub + '</div>' : '') + '</div>'
            + '<button type="button" class="uc-feed-iconbtn" data-uc-feed-people-msg="' + esc(u.id) + '" aria-label="Message ' + esc(name) + '">'
            + '<span class="iconify" data-icon="ph:chat-circle" aria-hidden="true"></span></button></div>';
        }).join('');
        root.querySelector('[data-uc-feed-people-sample]')?.remove();
        box.addEventListener('error', (e) => {
          if (e.target && e.target.matches && e.target.matches('[data-uc-feed-avatar-img]')) e.target.remove();
        }, true);
        box.addEventListener('click', (e) => {
          const b = e.target.closest('[data-uc-feed-people-msg]');
          if (b && window.UC && window.UC.openChat) window.UC.openChat(b.getAttribute('data-uc-feed-people-msg'));
        });
        scan(box);
      } catch (err) { /* keep the labelled sample cards */ }
    }

    load(false);
    loadPeople();

    // #feed?compose=1 -> focus the composer (other lanes link here).
    const params = UCP().params ? UCP().params() : new URLSearchParams();
    if (params.get('compose') === '1') {
      if (!me && window.UC) window.UC.openAuth('signin');
      else setTimeout(focusComposer, 60);
    }
  };
})();
