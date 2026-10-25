/* ==========================================================================
   UniCircle — premium feature data layer (mentorships · ideas · events ·
   ll_sessions · membership · deep directory search).
   The single seam every UI slice plugs into. Talks to PocketBase via the authed
   REST helper exposed on window.UC. Idempotency-aware (votes/RSVPs are join
   collections with a unique index), and degrades to a designed empty-state when
   the backend is unreachable or a collection is empty.
   ========================================================================== */
(function () {
  'use strict';

  const UC = () => window.UC || {};
  const api = (...a) => UC().api(...a);
  const esc = (s) => (UC().esc ? UC().esc(s) : String(s ?? ''));
  const toast = (...a) => UC().toast && UC().toast(...a);
  const me = () => UC().state && UC().state.user;
  const online = () => UC().state && UC().state.online;

  // A backend list call that never throws: returns {items, total, ok} so slices
  // can render an empty-state instead of crashing when offline/empty/denied.
  async function list(collection, query = '') {
    try {
      const r = await api('GET', `/api/collections/${collection}/records${query}`);
      return { items: r.items || [], total: r.totalItems || 0, ok: true };
    } catch (e) {
      return { items: [], total: 0, ok: false, status: e.status };
    }
  }

  // Standard empty / offline placeholder, brand-styled (reuses .uc-card).
  function emptyState(el, message, offline) {
    if (!el) return;
    el.innerHTML = `<div class="uc-card" style="text-align:center; padding:var(--space-5); color:var(--color-text-secondary);">
      <span class="iconify" data-icon="${offline ? 'ph:cloud-slash' : 'ph:sparkle'}" style="font-size:28px; opacity:.6;"></span>
      <p style="margin-top:var(--space-2); font-size:var(--text-sm);">${esc(message)}</p>
    </div>`;
  }

  // -------------------------------------------------------------- mentorships
  const mentorships = {
    listRequested: () => list('mentorships', '?filter=(status="requested")&expand=mentor,mentee&sort=-created'),
    request(mentorId, topic) {
      if (!UC().requireAuth('signin')) return Promise.reject(new Error('auth'));
      return api('POST', '/api/collections/mentorships/records',
        { mentor: mentorId, mentee: me().id, topic: topic || 'Mentorship request', status: 'requested' });
    },
    // "Become a mentor" flips the profile flag (owned by the user) — reuses openProfile UI too.
    becomeMentor(offer) {
      if (!UC().requireAuth('signin')) return Promise.reject(new Error('auth'));
      return api('PATCH', `/api/collections/users/records/${me().id}`,
        { mentor: true, mentor_offer: offer || '' });
    },
  };

  const speakerRequests = {
    list: () => list('speaker_requests', '?sort=-created'),
    create(topic, format) {
      if (!UC().requireAuth('signin')) return Promise.reject(new Error('auth'));
      return api('POST', '/api/collections/speaker_requests/records',
        { requester: me().id, topic, format: format || 'guest-talk', status: 'open' });
    },
  };

  // --------------------------------------------------------------------- ideas
  const ideas = {
    listByVotes: async () => {
      const res = await list('ideas', '?sort=-created&expand=author');
      // votes are derived: count idea_votes per idea, then sort desc
      for (const it of res.items) {
        const v = await list('idea_votes', `?filter=(idea="${it.id}")&perPage=1`);
        it.votes = v.total;
        it.voted = !!(me() && (await list('idea_votes',
          `?filter=(idea="${it.id}" && user="${me().id}")&perPage=1`)).total);
      }
      res.items.sort((a, b) => b.votes - a.votes);
      return res;
    },
    post(title, body, category) {
      if (!UC().requireAuth('signin')) return Promise.reject(new Error('auth'));
      return api('POST', '/api/collections/ideas/records',
        { author: me().id, title, body: body || '', category: category || '' });
    },
    // Idempotent upvote: create the join row; a duplicate 400s (unique index) —
    // treated as "already voted", not an error. Returns the new vote count.
    async upvote(ideaId) {
      if (!UC().requireAuth('signin')) return Promise.reject(new Error('auth'));
      try {
        await api('POST', '/api/collections/idea_votes/records', { user: me().id, idea: ideaId });
      } catch (e) {
        if (e.status !== 400) throw e; // 400 == already voted (unique index)
      }
      return (await list('idea_votes', `?filter=(idea="${ideaId}")&perPage=1`)).total;
    },
  };

  // ------------------------------------------------------------ chapters/events
  const events = {
    listChapters: () => list('chapters', '?sort=name'),
    listUpcoming: () => list('events', '?sort=date&expand=chapter'),
    async rsvpCount(eventId) {
      return (await list('rsvps', `?filter=(event="${eventId}")&perPage=1`)).total;
    },
    async hasRsvped(eventId) {
      if (!me()) return false;
      return !!(await list('rsvps', `?filter=(event="${eventId}" && user="${me().id}")&perPage=1`)).total;
    },
    // Idempotent RSVP: duplicate join row 400s and is swallowed. Count stays 1.
    async rsvp(eventId) {
      if (!UC().requireAuth('signin')) return Promise.reject(new Error('auth'));
      try {
        await api('POST', '/api/collections/rsvps/records', { user: me().id, event: eventId });
      } catch (e) {
        if (e.status !== 400) throw e;
      }
      return this.rsvpCount(eventId);
    },
  };

  const llSessions = { listUpcoming: () => list('ll_sessions', '?sort=date') };

  // ---------------------------------------------------------------- membership
  const membership = {
    // Single source of truth for the runtime gate is users.supporter.
    isPremium: () => !!(me() && me().supporter),
    async mine() {
      if (!me()) return null;
      const r = await list('membership', `?filter=(user="${me().id}")&perPage=1`);
      return r.items[0] || null;
    },
  };

  // ---------------------------------------------------- deep directory search
  // Basic filters read `users`; deep filters read `profiles_deep`, which is
  // gated to supporters by API rule. A 403/empty result surfaces the upsell.
  const directory = {
    searchBasic: (q) => list('users', `?filter=(${q})&perPage=50`),
    async searchDeep(q) {
      if (!membership.isPremium()) return { gated: true, items: [], total: 0 };
      const r = await list('profiles_deep', `?filter=(${q})&expand=user&perPage=50`);
      if (!r.ok && r.status === 403) return { gated: true, items: [], total: 0 };
      return { gated: false, ...r };
    },
  };

  window.UCF = { list, emptyState, mentorships, speakerRequests, ideas, events,
                 llSessions, membership, directory, online, me };
})();
