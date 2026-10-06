/* UniCircle page module: #pbl-hub (Case Hub) — see js/pages/_shared.js for the contract.

   Problem-based cases that students and alumni solve together.
   - Honours #pbl-hub?id=<slug> (scroll, highlight, expand) and
     #pbl-hub?topic=…&course=…&q=… (filters). Filter changes rewrite the hash
     with history.replaceState (no re-render).
   - Upvotes: once per viewer per approach (UCP.store 'case_votes'), toggleable.
   - "Post a case": local draft kept in UCP.store 'case_drafts' and labelled
     "Draft — visible only to you"; signed-in members can also share it on the
     live feed (POST posts).
   - Emits: #network?q=<author name | topic>.
   This module deliberately uses .uc-ch-* selectors (not .pbl-case-card /
   .upvote-widget / #pbl-create-modal) so app.js's legacy initPblInteractivity()
   finds nothing and cannot double-toggle votes. */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  const TOPICS = ['Finance', 'Strategy', 'Marketing', 'Data & Analytics', 'Sustainability', 'Operations', 'Entrepreneurship'];

  // Sample cases — fictional people and situations, labelled "Sample case".
  const SAMPLE_CASES = [
    {
      slug: 'hedging-through-a-rate-shock', topic: 'Finance', course: 'International Financial Management', level: 'Advanced',
      author: { name: 'Maya Lindqvist', role: 'M.Sc. student' },
      title: 'Hedging an equity portfolio through a sudden rate shock',
      desc: 'In a tutorial we debated whether bear-put spreads can protect an equity portfolio when a central bank surprises the market with a rate move. Under sudden volatility shifts, simple delta hedging breaks down. How do practitioners manage gamma and vega exposure in that situation without giving up too much return?',
      solutions: [
        { name: 'Tomás Ferreira', role: 'Portfolio risk manager', votes: 28,
          text: 'Delta-gamma neutral models struggle when the whole volatility smile shifts. In practice many desks add further out-of-the-money puts so the book stays vega-positive — the hedge gains when volatility spikes — and scale in with ratio spreads to keep the premium cost manageable.' },
        { name: 'Hannah Weiss', role: 'Quantitative risk analyst', votes: 14,
          text: 'Rebalancing on a fixed timetable can hurt you during a shock. Consider threshold-based triggers — for example, rebalance only after the underlying moves more than about 1.5 standard deviations. You avoid over-trading costs and keep coverage when liquidity thins out.' }
      ]
    },
    {
      slug: 'startup-valuation-under-inflation', topic: 'Finance', course: 'Corporate Valuation', level: 'Intermediate',
      author: { name: 'Jonas Pereira', role: 'B.Sc. student' },
      title: 'Valuing an early-stage software company when costs inflate',
      desc: 'DCF models assume fairly stable cost profiles, but young software companies are facing rising wage and capital costs. Do revenue multiples (EV/ARR) still work as an anchor, or should we use option-pricing approaches to capture the flexibility of an early-stage firm?',
      solutions: [
        { name: 'Claire Dubois', role: 'Corporate finance associate', votes: 19,
          text: 'Multiples can mislead when capital costs squeeze terminal values. A blend works well: use an option-pricing view for operational flexibility, then sanity-check against multiples with an explicit inflation haircut. If you keep the DCF, stress-test the discount rate well above today\'s level.' }
      ]
    },
    {
      slug: 'churn-with-little-data', topic: 'Data & Analytics', course: 'Applied Machine Learning', level: 'Intermediate',
      author: { name: 'Noah Becker', role: 'M.Sc. student' },
      title: 'Predicting churn for a small platform with patchy data',
      desc: 'Our project team is helping a small student-housing platform understand why tenants leave after one term. There are only about 800 users and the data is incomplete. Is a predictive churn model realistic, or should we start somewhere else?',
      solutions: [
        { name: 'Priya Nair', role: 'Data scientist', votes: 9,
          text: 'With 800 users a model will mostly learn noise. Start with cohort tables and ten short exit interviews — you will likely find two or three drivers you can act on. Revisit modelling once events are logged consistently.' }
      ]
    },
    {
      slug: 'reusable-packaging-pilot', topic: 'Sustainability', course: 'Operations & Supply Chain', level: 'Intermediate',
      author: { name: 'Aisha Rahman', role: 'B.Sc. student' },
      title: 'Designing a reusable-packaging pilot that gives a clear answer',
      desc: 'A mid-sized food producer wants to pilot reusable packaging with three regional retailers. Return rates are uncertain and cleaning adds cost. How would you design a pilot that tells you, within six months, whether to scale?',
      solutions: []
    },
    {
      slug: 'choosing-a-second-market', topic: 'Strategy', course: 'International Strategy', level: 'Advanced',
      author: { name: 'Lea Novak', role: 'M.Sc. student' },
      title: 'Which second market should a B2B software start-up enter?',
      desc: 'A start-up that is profitable at home wants to expand. The founders are split between a larger neighbouring market with strong competition and a smaller one with no clear leader. Which criteria would you use to decide, and what would you test first?',
      solutions: []
    }
  ].map((c) => Object.assign({ sample: true }, c));

  function slugify(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'case';
  }

  window.UCPages['pbl-hub'] = function (root) {
    const UCP = window.UCP;
    const UC = window.UC;
    const page = root.querySelector('.uc-ch');
    if (!page || !UCP) return;
    const esc = UCP.esc;

    const list = page.querySelector('[data-case-list]');
    const topicsBox = page.querySelector('[data-case-topics]');
    const search = page.querySelector('[data-case-search]');
    const status = page.querySelector('[data-case-status]');
    const empty = page.querySelector('[data-case-empty]');

    const params = UCP.params ? UCP.params() : new URLSearchParams();
    const filt = { topic: params.get('topic') || '', course: params.get('course') || '', q: params.get('q') || '' };
    search.value = filt.q;
    const expanded = {};

    const drafts = () => (UCP.store('case_drafts') || []).filter((d) => d && d.slug && d.title);
    const votes = () => UCP.store('case_votes') || {};
    const allCases = () => drafts().map((d) => Object.assign({ draft: true, solutions: [] }, d)).concat(SAMPLE_CASES);

    function syncHash() {
      const p = {};
      if (filt.topic) p.topic = filt.topic;
      if (filt.course) p.course = filt.course;
      if (filt.q) p.q = filt.q;
      const qs = new URLSearchParams(p).toString();
      try { history.replaceState(null, '', '#pbl-hub' + (qs ? '?' + qs : '')); } catch (e) { /* ignore */ }
    }

    function matches(c) {
      if (filt.topic && c.topic !== filt.topic) return false;
      if (filt.course && c.course !== filt.course) return false;
      const q = filt.q.trim().toLowerCase();
      if (q) {
        const hs = [c.title, c.desc, c.topic, c.course, c.author && c.author.name]
          .concat((c.solutions || []).map((s) => s.name + ' ' + s.text)).join(' ').toLowerCase();
        if (!q.split(/\s+/).every((w) => hs.indexOf(w) >= 0)) return false;
      }
      return true;
    }

    function renderTopics() {
      const used = Array.from(new Set(allCases().map((c) => c.topic).filter(Boolean)));
      const chip = (val, label) => '<button type="button" class="uc-chip uc-ch-chip" data-case-topic="' + esc(val) + '" aria-pressed="'
        + (filt.topic === val ? 'true' : 'false') + '">' + esc(label) + '</button>';
      topicsBox.innerHTML = chip('', 'All topics') + used.map((t) => chip(t, t)).join('')
        + (filt.course ? '<button type="button" class="uc-chip uc-ch-chip" data-case-clear-course aria-pressed="true">Course: '
          + esc(filt.course) + ' <span aria-hidden="true">×</span><span class="uc-sr">(clear)</span></button>' : '');
    }

    function solutionHtml(c, s, i) {
      const id = c.slug + '#' + i;
      const on = !!votes()[id];
      const n = (s.votes || 0) + (on ? 1 : 0);
      return '<div class="uc-ch-sol">'
        + '<button type="button" class="uc-ch-vote' + (on ? ' is-on' : '') + '" data-case-vote="' + esc(id) + '" data-base="' + (s.votes || 0) + '" aria-pressed="' + on + '"'
        + ' aria-label="Upvote approach by ' + esc(s.name) + ', ' + n + ' votes">'
        + '<span class="iconify" data-icon="ph:caret-up-' + (on ? 'fill' : 'bold') + '" aria-hidden="true"></span><span class="uc-ch-vote-n">' + n + '</span></button>'
        + '<div class="uc-ch-sol-body"><div class="uc-ch-sol-meta">'
        + '<button type="button" class="uc-mc-link" data-case-person="' + esc(s.name) + '" title="Find ' + esc(s.name) + ' in the network">' + esc(s.name) + '</button>'
        + ' <span class="uc-ch-muted">· ' + esc(s.role) + '</span></div>'
        + '<p class="uc-ch-sol-text">' + esc(s.text) + '</p></div></div>';
    }

    function caseHtml(c) {
      const sols = c.solutions || [];
      const open = !!expanded[c.slug];
      const panelId = 'uc-ch-sols-' + c.slug;
      const badge = c.draft
        ? (c.shared
          ? '<span class="uc-mc-badge uc-mc-badge--draft">Your case — listed here only for you</span><span class="uc-mc-badge uc-mc-badge--live">Shared on the feed</span>'
          : '<span class="uc-mc-badge uc-mc-badge--draft">Draft — visible only to you</span>')
        : '<span class="uc-mc-badge">Sample case</span>';
      const sorted = sols.map((s, i) => ({ s: s, i: i }))
        .sort((a, b) => (b.s.votes || 0) - (a.s.votes || 0));
      return '<article class="uc-ch-case" id="case-' + esc(c.slug) + '" data-case-id="' + esc(c.slug) + '" aria-labelledby="uc-ch-t-' + esc(c.slug) + '">'
        + '<div class="uc-ch-case-top">'
        + '<button type="button" class="uc-tag uc-ch-tagbtn" data-case-topic="' + esc(c.topic) + '" title="Show ' + esc(c.topic) + ' cases">' + esc(c.topic) + '</button>'
        + (c.course ? '<button type="button" class="uc-tag uc-ch-tagbtn uc-ch-tag-course" data-case-course="' + esc(c.course) + '" title="Show cases from this course">' + esc(c.course) + '</button>' : '')
        + (c.level ? '<span class="uc-ch-level">' + esc(c.level) + '</span>' : '')
        + '<span class="uc-ch-badges">' + badge + '</span></div>'
        + '<h3 class="uc-ch-title" id="uc-ch-t-' + esc(c.slug) + '" tabindex="-1">' + esc(c.title) + '</h3>'
        + '<div class="uc-ch-author">Posted by '
        + (c.draft ? '<b>you</b>' : '<button type="button" class="uc-mc-link" data-case-person="' + esc(c.author.name) + '">' + esc(c.author.name) + '</button> <span class="uc-ch-muted">· ' + esc(c.author.role) + '</span>')
        + '</div>'
        + '<p class="uc-ch-desc">' + esc(c.desc) + '</p>'
        + '<div class="uc-ch-bar">'
        + (sols.length
          ? '<button type="button" class="uc-pill-ghost uc-pill-sm" data-case-toggle="' + esc(c.slug) + '" aria-expanded="' + open + '" aria-controls="' + panelId + '">'
            + (open ? 'Hide' : 'Show') + ' ' + sols.length + ' approach' + (sols.length === 1 ? '' : 'es') + '</button>'
          : '<span class="uc-ch-muted">No approaches yet.</span>')
        + '<button type="button" class="uc-pill-ghost uc-pill-sm" data-case-invite="' + esc(c.topic) + '"><span class="iconify" data-icon="ph:user-plus-bold" aria-hidden="true"></span>&nbsp;Invite a member</button>'
        + '<button type="button" class="uc-pill-ghost uc-pill-sm" data-case-copy="' + esc(c.slug) + '"><span class="iconify" data-icon="ph:link-bold" aria-hidden="true"></span>&nbsp;Copy link</button>'
        + (c.draft ? '<button type="button" class="uc-pill-ghost uc-pill-sm" data-case-discard="' + esc(c.slug) + '">Discard draft</button>' : '')
        + '</div>'
        + (sols.length ? '<div class="uc-ch-sols" id="' + panelId + '"' + (open ? '' : ' hidden') + '>'
          + '<div class="uc-eyebrow uc-ch-sols-h">Approaches from alumni</div>'
          + sorted.map((x) => solutionHtml(c, x.s, x.i)).join('') + '</div>' : '')
        + '</article>';
    }

    function render() {
      renderTopics();
      const all = allCases();
      const shown = all.filter(matches);
      list.innerHTML = shown.map(caseHtml).join('');
      empty.hidden = shown.length > 0;
      const nd = shown.filter((c) => c.draft).length;
      status.textContent = shown.length + ' of ' + all.length + ' case' + (all.length === 1 ? '' : 's')
        + (nd ? ' · ' + nd + ' draft' + (nd === 1 ? '' : 's') : '') + ' · samples shown for illustration';
      if (window.Iconify) window.Iconify.scan(page);
    }

    function focusCase(slug) {
      const el = list.querySelector('[data-case-id="' + (window.CSS && CSS.escape ? CSS.escape(slug) : slug) + '"]');
      if (!el) return false;
      el.classList.remove('is-highlight');
      void el.offsetWidth; // restart the highlight animation
      el.classList.add('is-highlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const h = el.querySelector('.uc-ch-title');
      if (h) h.focus({ preventScroll: true });
      return true;
    }

    function openCase(slug) {
      if (!allCases().some((c) => c.slug === slug)) {
        UCP.toast('That case is no longer available.', 'warn');
        return;
      }
      if (!allCases().filter(matches).some((c) => c.slug === slug)) {
        filt.topic = ''; filt.course = ''; filt.q = ''; search.value = '';
      }
      expanded[slug] = true;
      render();
      setTimeout(() => focusCase(slug), 60);
    }

    function toggleVote(btn) {
      const id = btn.getAttribute('data-case-vote');
      const v = votes();
      if (v[id]) delete v[id]; else v[id] = true;
      UCP.store('case_votes', v);
      const on = !!v[id];
      const n = (parseInt(btn.getAttribute('data-base'), 10) || 0) + (on ? 1 : 0);
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', String(on));
      const who = (btn.getAttribute('aria-label') || '').replace(/^Upvote approach by (.*), \d+ votes$/, '$1');
      btn.setAttribute('aria-label', 'Upvote approach by ' + who + ', ' + n + ' votes');
      btn.innerHTML = '<span class="iconify" data-icon="ph:caret-up-' + (on ? 'fill' : 'bold') + '" aria-hidden="true"></span><span class="uc-ch-vote-n">' + n + '</span>';
      if (window.Iconify) window.Iconify.scan(btn);
    }

    function copyLink(slug) {
      const url = location.href.split('#')[0] + '#pbl-hub?id=' + encodeURIComponent(slug);
      const done = () => UCP.toast('Link copied.');
      const fail = () => UCP.toast('Copy this link: ' + esc(url), 'warn');
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fail);
        else fail();
      } catch (e) { fail(); }
    }

    function postCase() {
      const u = UCP.user();
      const canShare = !!(u && UCP.online());
      const opts = TOPICS.map((t) => '<option' + (t === filt.topic ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
      UCP.dialog({
        title: 'Post a case',
        body: '<form class="uc-mc-form" data-case-form novalidate>'
          + '<label><span class="uc-mc-label">Case title <span aria-hidden="true">*</span></span><input name="title" maxlength="140" required placeholder="e.g. Should a regional retailer launch its own delivery service?"></label>'
          + '<label><span class="uc-mc-label">Topic</span><select name="topic">' + opts + '</select></label>'
          + '<label><span class="uc-mc-label">Course or context (optional)</span><input name="course" maxlength="80" placeholder="e.g. Strategic Management, internship project"></label>'
          + '<label><span class="uc-mc-label">The problem <span aria-hidden="true">*</span></span><textarea name="desc" rows="5" maxlength="2000" required placeholder="Give the key numbers, what you have tried, and the question you want alumni to help with."></textarea></label>'
          + (canShare
            ? '<label class="uc-mc-check"><input type="checkbox" name="share" checked> Also share it on the live feed so members can see it</label>'
            : '<p class="uc-mc-fine">' + (u ? 'The network is offline — your case is saved as a draft on this device.' : 'Sign in to also share your case on the live feed. For now it is saved as a draft on this device.') + '</p>')
          + '</form>',
        actions: [
          { label: 'Cancel' },
          { label: 'Save case', primary: true, onClick: async (close, d) => {
            const f = d.querySelector('[data-case-form]');
            const title = f.elements.title.value.trim();
            const desc = f.elements.desc.value.trim();
            if (!title) { f.elements.title.focus(); UCP.toast('Give your case a title.', 'warn'); return; }
            if (!desc) { f.elements.desc.focus(); UCP.toast('Describe the problem in a few sentences.', 'warn'); return; }
            const draft = {
              slug: 'draft-' + slugify(title) + '-' + Date.now().toString(36),
              title: title, topic: f.elements.topic.value, course: f.elements.course.value.trim(),
              desc: desc, created: Date.now(), shared: false
            };
            const share = canShare && f.elements.share && f.elements.share.checked;
            if (share) {
              const btn = d.querySelectorAll('.uc-dialog-actions button')[1];
              if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
              try {
                await UCP.api('POST', '/api/collections/posts/records', {
                  author: u.id, text: '📌 New case: ' + title + '\n\n' + desc, degree: 'Case', likes: 0
                });
                draft.shared = true;
              } catch (e) { draft.shared = false; }
            }
            UCP.store('case_drafts', [draft].concat(drafts()).slice(0, 50));
            close();
            if (share && draft.shared) UCP.toast('Case saved and shared on the live feed.');
            else if (share) UCP.toast('Saved as a draft — sharing on the feed failed, try again later.', 'warn');
            else UCP.toast('Case saved as a draft on this device.');
            if (draft.topic !== filt.topic) filt.topic = '';
            filt.course = ''; filt.q = ''; search.value = '';
            syncHash();
            render();
            setTimeout(() => focusCase(draft.slug), 60);
          } }
        ]
      });
    }

    // ------------------------------------------------------------- wiring
    page.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t || !page.contains(t)) return;
      if (t.hasAttribute('data-case-new')) { postCase(); return; }
      if (t.hasAttribute('data-case-vote')) { toggleVote(t); return; }
      if (t.hasAttribute('data-case-topic')) {
        const v = t.getAttribute('data-case-topic');
        const fromChipRow = topicsBox.contains(t);
        filt.topic = (!fromChipRow || filt.topic !== v) ? v : '';
        syncHash(); render();
        if (fromChipRow) {
          const again = Array.from(topicsBox.querySelectorAll('[data-case-topic]')).find((b) => b.getAttribute('data-case-topic') === v);
          if (again) again.focus();
        } else {
          topicsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        return;
      }
      if (t.hasAttribute('data-case-course')) { filt.course = t.getAttribute('data-case-course'); syncHash(); render(); return; }
      if (t.hasAttribute('data-case-clear-course')) { filt.course = ''; syncHash(); render(); return; }
      if (t.hasAttribute('data-case-person')) { UCP.go('network', { q: t.getAttribute('data-case-person') }); return; }
      if (t.hasAttribute('data-case-invite')) { UCP.go('network', { q: t.getAttribute('data-case-invite') }); return; }
      if (t.hasAttribute('data-case-copy')) { copyLink(t.getAttribute('data-case-copy')); return; }
      if (t.hasAttribute('data-case-toggle')) {
        const slug = t.getAttribute('data-case-toggle');
        expanded[slug] = !expanded[slug];
        const panel = page.querySelector('#uc-ch-sols-' + (window.CSS && CSS.escape ? CSS.escape(slug) : slug));
        if (panel) panel.hidden = !expanded[slug];
        t.setAttribute('aria-expanded', String(!!expanded[slug]));
        t.textContent = t.textContent.replace(/^(Show|Hide)/, expanded[slug] ? 'Hide' : 'Show');
        return;
      }
      if (t.hasAttribute('data-case-discard')) {
        const slug = t.getAttribute('data-case-discard');
        UCP.store('case_drafts', drafts().filter((d) => d.slug !== slug));
        UCP.toast('Draft discarded from this device.');
        render();
      }
    });

    let qTimer = null;
    search.addEventListener('input', () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { filt.q = search.value; syncHash(); render(); }, 150);
    });

    // ------------------------------------------------------------- initial
    render();
    const id = params.get('id');
    if (id) openCase(id);
  };
})();
