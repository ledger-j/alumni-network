/* UniCircle page module: #mentoring — see js/pages/_shared.js for the contract.

   Alumni mentoring students (two-sided):
   - Live mentors: users with mentor=true from PocketBase (signed in + online),
     followed by clearly labelled Sample mentors.
   - Filters: keyword / programme / sector / city. Honours
     #mentoring?q=…&programme=…&sector=…&city=…&section=mentors|requests|lectures
   - "Request mentoring" on a live mentor → structured ask → real message
     (POST messages) → UC.openChat(mentor.id). Samples answer with an honest toast.
   - Emits: #map?city=…, #network?q=<programme|name>.
   Listeners attach to the freshly rendered .uc-mc element (never to `root`,
   which persists across renders), so re-rendering never stacks handlers. */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  const HUES = [45, 275, 185, 235, 145, 305, 25];

  // Sample mentors — fictional people, shown with a "Sample" label.
  const SAMPLE_MENTORS = [
    { name: 'Amara Okafor', headline: 'Corporate finance lead · former investment banker', degree: 'M.Sc. Finance', location: 'Amsterdam', mentor_offer: 'CV review for finance roles, mock interviews, choosing between banking and corporate finance.' },
    { name: 'Lukas Brandt', headline: 'Product manager, B2B software', degree: 'B.Sc. Business Informatics', location: 'Berlin', mentor_offer: 'Breaking into product management, portfolio feedback, first-job negotiation.' },
    { name: 'Inès Moreau', headline: 'Strategy consultant', degree: 'M.Sc. International Business', location: 'Paris', mentor_offer: 'Case-interview practice and how to pick a first employer.' },
    { name: 'Pieter de Wit', headline: 'Policy advisor, energy transition', degree: 'M.A. Public Policy', location: 'Brussels', mentor_offer: 'Working in public institutions, traineeship applications, sustainability careers.' },
    { name: 'Sofia Marques', headline: 'Growth marketing lead', degree: 'B.Sc. Economics & Business', location: 'Lisbon', mentor_offer: 'Marketing portfolios, the first 90 days in a new role, coffee chats.' },
    { name: 'Daniel Kowalski', headline: 'Founder, health-tech startup', degree: 'M.Sc. Data Science', location: 'Warsaw', mentor_offer: 'Startup careers, data roles, validating an idea before you build it.' }
  ].map((m, i) => Object.assign({ key: 'sample:' + i, sample: true }, m));

  // Sample incoming requests (what an alumnus sees once mentoring).
  const SAMPLE_REQUESTS = [
    { key: 'req:0', sample: true, name: 'Sophie Vermeulen', degree: 'B.Sc. International Business · 3rd year', location: 'Rotterdam',
      match: 'Finance career track', headline: 'Student',
      ask: 'I\'m choosing between a master\'s in Financial Economics and Econometrics — I\'d love 30 minutes on how you decided and where it led you.' },
    { key: 'req:1', sample: true, name: 'Omar Al-Rashid', degree: 'M.Sc. Financial Economics · 1st year', location: 'Utrecht',
      match: 'Same programme', headline: 'Student',
      ask: 'Our next block is case-heavy — could you share how you approached case work and what the pace is really like?' }
  ];

  const SAMPLE_LECTURES = [
    { key: 'lec:0', title: 'Careers in sustainable finance', course: 'Sustainable Finance (Master\'s)', format: '45-min talk + Q&A · online or on campus', when: 'Spring term' },
    { key: 'lec:1', title: 'From thesis to first product: data roles in practice', course: 'Applied Data Analytics (Bachelor\'s)', format: '30-min guest session', when: 'Autumn term' },
    { key: 'lec:2', title: 'How strategy work really happens', course: 'Strategic Management (Bachelor\'s)', format: 'Panel of 2–3 alumni', when: 'Spring term' }
  ];

  const SECTORS = {
    finance: ['financ', 'bank', 'invest', 'account', 'audit', 'risk', 'treasury', 'fintech', 'asset'],
    consulting: ['consult', 'strategy', 'advisory'],
    technology: ['tech', 'software', 'product', 'engineer', 'data', 'developer', 'informatics', 'ai '],
    marketing: ['marketing', 'brand', 'growth', 'communication', 'sales', 'media'],
    public: ['policy', 'public', 'government', 'ngo', 'non-profit', 'nonprofit', 'institution', 'ministry'],
    health: ['health', 'medic', 'pharma', 'care', 'clinic'],
    sustainability: ['sustainab', 'energy', 'climate', 'esg', 'circular', 'environment'],
    entrepreneurship: ['founder', 'startup', 'start-up', 'entrepreneur', 'venture']
  };

  const FORMATS = ['Intro call (30 min)', 'CV review', 'Coffee chat', 'Questions by message'];

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || '?';
  }
  function hueFor(name) {
    let h = 0;
    String(name || '').split('').forEach((c) => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
    return HUES[h % HUES.length];
  }
  const cityOf = (m) => String(m.location || '').split(',')[0].trim();
  const haystack = (m) => [m.name, m.headline, m.degree, m.location, m.mentor_offer].join(' ').toLowerCase();

  function avatarHtml(m, size) {
    const UCP = window.UCP;
    const UC = window.UC;
    const px = size || 54;
    if (!m.sample && m.avatar && m.collectionId && UC && UC.API) {
      const src = UC.API + '/api/files/' + encodeURIComponent(m.collectionId) + '/' + encodeURIComponent(m.id) + '/' + encodeURIComponent(m.avatar);
      return '<img class="uc-mc-avatar" src="' + UCP.esc(src) + '" alt="" width="' + px + '" height="' + px + '">';
    }
    return '<div class="uc-avatar-initials uc-mc-avatar" aria-hidden="true" style="width:' + px + 'px;height:' + px + 'px;font-size:' + Math.round(px * 0.39)
      + 'px;background:oklch(0.9 0.06 ' + hueFor(m.name) + ');">' + UCP.esc(initials(m.name)) + '</div>';
  }

  window.UCPages['mentoring'] = function (root) {
    const UCP = window.UCP;
    const UC = window.UC;
    const page = root.querySelector('.uc-mc');
    if (!page || !UCP) return;
    const esc = UCP.esc;
    const me = UCP.user();

    const grid = page.querySelector('[data-mc-grid]');
    const empty = page.querySelector('[data-mc-empty]');
    const status = page.querySelector('[data-mc-status]');
    const form = page.querySelector('[data-mc-filters]');
    const fq = form.elements.q;
    const fProg = form.elements.programme;
    const fSector = form.elements.sector;
    const fCity = form.elements.city;

    let live = [];
    let liveState = me ? (UCP.online() ? 'loading' : 'offline') : 'signedout';
    const byKey = {};
    SAMPLE_MENTORS.concat(SAMPLE_REQUESTS).forEach((m) => { byKey[m.key] = m; });

    // ---------------------------------------------------------------- params
    const params = UCP.params ? UCP.params() : new URLSearchParams();
    fq.value = params.get('q') || '';
    let wantProg = params.get('programme') || '';
    let wantCity = params.get('city') || '';
    if (params.get('sector') && SECTORS[params.get('sector')]) fSector.value = params.get('sector');

    // --------------------------------------------------------------- filters
    function fillSelect(sel, values, keep) {
      const first = sel.options[0].outerHTML;
      const uniq = Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
      if (keep && uniq.indexOf(keep) < 0) uniq.unshift(keep);
      sel.innerHTML = first + uniq.map((v) => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
      sel.value = keep || '';
    }
    function refreshOptions() {
      const all = live.concat(SAMPLE_MENTORS);
      fillSelect(fProg, all.map((m) => String(m.degree || '').trim()), fProg.value || wantProg);
      fillSelect(fCity, all.map(cityOf), fCity.value || wantCity);
    }

    function matches(m) {
      const hs = haystack(m);
      const q = fq.value.trim().toLowerCase();
      if (q && !q.split(/\s+/).every((w) => hs.indexOf(w) >= 0)) return false;
      if (fProg.value && String(m.degree || '').trim() !== fProg.value) return false;
      if (fCity.value && cityOf(m) !== fCity.value) return false;
      if (fSector.value && !SECTORS[fSector.value].some((k) => hs.indexOf(k) >= 0)) return false;
      return true;
    }

    // ----------------------------------------------------------------- cards
    function mentorCard(m) {
      const isMe = !m.sample && me && m.id === me.id;
      const label = m.sample ? '<span class="uc-mc-badge">Sample</span>'
        : (isMe ? '<span class="uc-mc-badge uc-mc-badge--live">You</span>' : '<span class="uc-mc-badge uc-mc-badge--live">Live mentor</span>');
      const city = cityOf(m);
      const meta = [];
      if (m.degree) meta.push('<button type="button" class="uc-mc-link" data-mc-act="programme" data-mc-key="' + esc(m.key) + '" title="Find people from this programme">' + esc(m.degree) + '</button>');
      if (city) meta.push('<button type="button" class="uc-mc-link" data-mc-act="map" data-mc-key="' + esc(m.key) + '" title="See ' + esc(city) + ' on the map"><span class="iconify" data-icon="ph:map-pin-bold" aria-hidden="true"></span> ' + esc(city) + '</button>');
      return '<article class="uc-card uc-mc-card" aria-label="' + esc(m.name) + '">'
        + '<div class="uc-mc-card-top">' + avatarHtml(m, 54)
        + '<div class="uc-mc-card-id"><div class="uc-mc-name">' + esc(m.name || 'Member') + ' ' + label + '</div>'
        + (m.headline ? '<div class="uc-mc-sub">' + esc(m.headline) + '</div>' : '') + '</div></div>'
        + (meta.length ? '<div class="uc-mc-meta">' + meta.join('<span aria-hidden="true">·</span>') + '</div>' : '')
        + '<p class="uc-mc-offer"><span class="uc-mc-offer-l">Offers</span> ' + esc(m.mentor_offer || 'Open to a first conversation.') + '</p>'
        + '<div class="uc-mc-actions">'
        + (isMe ? '<button type="button" class="uc-pill-ghost" data-mc-become>Edit my mentor profile</button>'
          : '<button type="button" class="uc-pill-ink" data-mc-act="request" data-mc-key="' + esc(m.key) + '">Request mentoring</button>')
        + '<button type="button" class="uc-pill-ghost" data-mc-act="profile" data-mc-key="' + esc(m.key) + '">View profile</button>'
        + '</div></article>';
    }

    function renderMentors() {
      const list = live.concat(SAMPLE_MENTORS).filter(matches);
      grid.innerHTML = list.map(mentorCard).join('');
      empty.hidden = list.length > 0;
      const nLive = list.filter((m) => !m.sample).length;
      const nSample = list.length - nLive;
      let msg = '';
      if (liveState === 'loading') msg = 'Loading live mentors…';
      else if (liveState === 'signedout') msg = 'Sign in to see live mentors · showing ' + nSample + ' sample' + (nSample === 1 ? '' : 's');
      else if (liveState === 'offline') msg = 'Network offline · showing ' + nSample + ' sample' + (nSample === 1 ? '' : 's');
      else if (liveState === 'error') msg = 'Could not load live mentors · showing ' + nSample + ' sample' + (nSample === 1 ? '' : 's');
      else msg = nLive + ' live mentor' + (nLive === 1 ? '' : 's') + ' · ' + nSample + ' sample' + (nSample === 1 ? '' : 's');
      status.textContent = msg;
      if (window.Iconify) window.Iconify.scan(grid);
    }

    function renderRequests() {
      const box = page.querySelector('[data-mc-requests]');
      box.innerHTML = SAMPLE_REQUESTS.map((r) => '<article class="uc-card uc-mc-card" aria-label="Request from ' + esc(r.name) + '">'
        + '<div class="uc-mc-card-top">' + avatarHtml(r, 54)
        + '<div class="uc-mc-card-id"><div class="uc-mc-name">' + esc(r.name) + ' <span class="uc-mc-badge">Sample</span></div>'
        + '<div class="uc-mc-sub">' + esc(r.degree) + '</div></div></div>'
        + '<div class="uc-tag">Match: ' + esc(r.match) + '</div>'
        + '<p class="uc-mc-quote">“' + esc(r.ask) + '”</p>'
        + '<div class="uc-mc-actions">'
        + '<button type="button" class="uc-pill-ink" data-mc-act="accept" data-mc-key="' + esc(r.key) + '">Accept match</button>'
        + '<button type="button" class="uc-pill-ghost" data-mc-act="profile" data-mc-key="' + esc(r.key) + '">View profile</button>'
        + '</div></article>').join('');
    }

    function renderStats() {
      const sent = (UCP.store('mc_requests') || []).length;
      const meRec = me ? (live.find((m) => m.id === me.id) || me) : null;
      const mentorOn = meRec ? (meRec.mentor ? 'On' : 'Off') : '—';
      const liveN = liveState === 'ready' ? String(live.filter((m) => !(me && m.id === me.id)).length) : '—';
      page.querySelector('[data-mc-stats]').innerHTML =
        '<div class="uc-stat"><div class="uc-stat-n">' + esc(mentorOn) + '</div><div class="uc-stat-l">Your mentor profile'
        + (meRec && !meRec.mentor ? ' — <button type="button" class="uc-mc-link" data-mc-become>switch it on</button>' : '') + '</div></div>'
        + '<div class="uc-stat"><div class="uc-stat-n">' + sent + '</div><div class="uc-stat-l">Requests you\'ve sent (this device)</div></div>'
        + '<div class="uc-stat"><div class="uc-stat-n">' + esc(liveN) + '</div><div class="uc-stat-l">Other live mentors in the circle</div></div>';
    }

    function renderLectures() {
      page.querySelector('[data-mc-lectures]').innerHTML = SAMPLE_LECTURES.map((l) => {
        const done = (UCP.store('mc_volunteered') || []).indexOf(l.key) >= 0;
        return '<article class="uc-row uc-mc-lecture">'
          + '<div class="uc-mc-lecture-body"><div class="uc-mc-name">' + esc(l.title) + ' <span class="uc-mc-badge">Sample</span></div>'
          + '<div class="uc-mc-sub">' + esc(l.course) + ' · ' + esc(l.format) + ' · ' + esc(l.when) + '</div></div>'
          + '<button type="button" class="' + (done ? 'uc-pill-ghost' : 'uc-pill-ink') + ' uc-pill-sm" data-mc-act="volunteer" data-mc-key="' + esc(l.key) + '">'
          + (done ? 'Email drafted — send again' : 'Volunteer to speak') + '</button></article>';
      }).join('');
    }

    // --------------------------------------------------------------- actions
    function becomeMentor() {
      UCP.dialog({
        title: 'Become a mentor',
        body: '<p>Mentoring on UniCircle is light-touch: students see your card here, send a short structured ask, and the conversation continues in Messages. You decide what to accept.</p>'
          + '<ol class="uc-mc-steps uc-mc-steps--ink"><li>Open your profile and tick <b>Offer mentorship to current students</b>.</li>'
          + '<li>Fill in <b>What you offer</b> — e.g. “30-min intro calls, CV reviews for consulting”.</li>'
          + '<li>Save. Your card appears in “Find a mentor” for signed-in members.</li></ol>',
        actions: [
          { label: 'Not now' },
          { label: me ? 'Open my profile' : 'Sign in to start', primary: true, onClick: (close) => {
            close();
            if (!UC) return;
            if (!UCP.user()) { UC.openAuth('signin'); return; }
            UC.openProfile();
            UCP.toast('Tick “Offer mentorship” and save — you\'ll appear in the mentor list.');
          } }
        ]
      });
    }

    function requestMentoring(m) {
      if (m.sample) {
        UCP.toast(esc(m.name) + ' is a sample mentor — requests go to live mentors only.', 'warn');
        return;
      }
      if (!UCP.user()) { if (UC) UC.openAuth('signin'); return; }
      if (!UCP.online()) { UCP.toast('The network is offline right now — try again in a moment.', 'warn'); return; }
      const u = UCP.user();
      const fmt = FORMATS.map((f) => '<option>' + esc(f) + '</option>').join('');
      UCP.dialog({
        title: 'Ask ' + (m.name || 'this mentor').split(' ')[0],
        body: '<form class="uc-mc-form" data-mc-reqform novalidate>'
          + '<label><span class="uc-mc-label">What would you like help with? <span aria-hidden="true">*</span></span>'
          + '<textarea name="goal" rows="4" maxlength="600" required placeholder="e.g. I\'m deciding between two master\'s programmes and would value your perspective."></textarea></label>'
          + '<label><span class="uc-mc-label">Preferred format</span><select name="format">' + fmt + '</select></label>'
          + '<label><span class="uc-mc-label">About you (optional)</span><input name="about" maxlength="140" value="' + esc(u.degree || u.headline || '') + '" placeholder="Programme and year"></label>'
          + '<p class="uc-mc-fine">This sends a real message to ' + esc(m.name) + ' and opens your conversation.</p></form>',
        actions: [
          { label: 'Cancel' },
          { label: 'Send request', primary: true, onClick: async (close, d) => {
            const f = d.querySelector('[data-mc-reqform]');
            const goal = f.elements.goal.value.trim();
            if (!goal) { f.elements.goal.focus(); UCP.toast('Add a sentence about what you\'d like help with.', 'warn'); return; }
            const btn = d.querySelectorAll('.uc-dialog-actions button')[1];
            if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
            const about = f.elements.about.value.trim();
            const text = 'Mentoring request\n\nGoal: ' + goal + '\nPreferred format: ' + f.elements.format.value
              + (about ? '\nAbout me: ' + about : '') + '\n\n— sent via UniCircle Mentoring';
            try {
              await UCP.api('POST', '/api/collections/messages/records', { sender: u.id, recipient: m.id, text: text, read: false });
              const sent = UCP.store('mc_requests') || [];
              sent.push({ id: m.id, at: Date.now() });
              UCP.store('mc_requests', sent.slice(-100));
              close();
              UCP.toast('Request sent to ' + esc(m.name) + '.');
              renderStats();
              if (UC) UC.openChat(m.id);
            } catch (err) {
              if (btn) { btn.disabled = false; btn.textContent = 'Send request'; }
              UCP.toast('Could not send the request — please try again.', 'warn');
            }
          } }
        ]
      });
    }

    function viewProfile(m) {
      const city = cityOf(m);
      const isMentor = SAMPLE_MENTORS.indexOf(m) >= 0 || (!m.sample && live.indexOf(m) >= 0);
      const isMe = !m.sample && me && m.id === me.id;
      const rows = [];
      if (m.headline) rows.push(['Role', esc(m.headline)]);
      if (m.degree) rows.push(['Programme', '<button type="button" class="uc-mc-link" data-pf="programme">' + esc(m.degree) + '</button>']);
      if (city) rows.push(['City', esc(m.location)]);
      if (m.mentor_offer) rows.push(['Offers', esc(m.mentor_offer)]);
      if (m.ask) rows.push(['Asks', '“' + esc(m.ask) + '”']);
      const actions = [{ label: 'Close' }];
      if (city) actions.push({ label: 'See on map', onClick: (close) => { close(); UCP.go('map', { city: city }); } });
      if (!isMe) actions.push({ label: 'Message', primary: !isMentor, onClick: (close) => {
        if (m.sample) { UCP.toast('This is a sample profile — messages go to live members only.', 'warn'); return; }
        close(); if (UC) UC.openChat(m.id);
      } });
      if (isMentor && !isMe) actions.push({ label: 'Request mentoring', primary: true, onClick: (close) => { if (!m.sample) close(); requestMentoring(m); } });
      const closeProfile = UCP.dialog({
        title: m.name || 'Member',
        body: '<div class="uc-mc-profile">' + avatarHtml(m, 64)
          + '<div>' + (m.sample ? '<span class="uc-mc-badge">Sample profile</span>' : '<span class="uc-mc-badge uc-mc-badge--live">Live member</span>') + '</div></div>'
          + '<dl class="uc-mc-dl">' + rows.map((r) => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('') + '</dl>',
        actions: actions
      });
      const dlgs = document.querySelectorAll('dialog.uc-dialog');
      const prog = dlgs.length ? dlgs[dlgs.length - 1].querySelector('[data-pf="programme"]') : null;
      if (prog) prog.addEventListener('click', () => { closeProfile(); UCP.go('network', { q: m.degree }); });
    }

    function volunteer(l) {
      const u = UCP.user();
      UCP.dialog({
        title: 'Volunteer to speak',
        body: '<p><b>' + esc(l.title) + '</b><br><span class="uc-mc-sub">' + esc(l.course) + ' · ' + esc(l.format) + '</span></p>'
          + '<form class="uc-mc-form" data-mc-volform novalidate>'
          + '<label><span class="uc-mc-label">Your name</span><input name="name" maxlength="80" value="' + esc((u && u.name) || '') + '"></label>'
          + '<label><span class="uc-mc-label">What could you talk about?</span><textarea name="angle" rows="3" maxlength="500" placeholder="Your angle, role and one story students would remember."></textarea></label>'
          + '<label><span class="uc-mc-label">Availability</span><input name="when" maxlength="120" placeholder="e.g. weekday afternoons, online"></label>'
          + '<p class="uc-mc-fine">This opens a pre-filled email to hello@unicircle.eu in your mail app — nothing is sent until you press send there.</p></form>',
        actions: [
          { label: 'Cancel' },
          { label: 'Open email draft', primary: true, onClick: (close, d) => {
            const f = d.querySelector('[data-mc-volform]');
            const body = 'Hello UniCircle team,\n\nI would like to volunteer for the guest-lecture request:\n'
              + l.title + ' — ' + l.course + ' (' + l.when + ')\n\n'
              + 'Name: ' + f.elements.name.value.trim() + '\n'
              + 'Topic / angle: ' + f.elements.angle.value.trim() + '\n'
              + 'Availability: ' + f.elements.when.value.trim() + '\n'
              + (u && u.headline ? 'Role: ' + u.headline + '\n' : '')
              + '\nThank you!';
            const href = 'mailto:hello@unicircle.eu?subject=' + encodeURIComponent('Guest lecture: ' + l.title)
              + '&body=' + encodeURIComponent(body);
            const done = UCP.store('mc_volunteered') || [];
            if (done.indexOf(l.key) < 0) { done.push(l.key); UCP.store('mc_volunteered', done); }
            close();
            window.location.href = href;
            renderLectures();
          } }
        ]
      });
    }

    // ------------------------------------------------------------- wiring
    page.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t || !page.contains(t)) return;
      if (t.hasAttribute('data-mc-become')) { becomeMentor(); return; }
      if (t.hasAttribute('data-mc-find')) {
        const sec = page.querySelector('#uc-mc-mentors');
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => fq.focus({ preventScroll: true }), 350);
        return;
      }
      const act = t.getAttribute('data-mc-act');
      if (!act) return;
      const key = t.getAttribute('data-mc-key');
      if (act === 'volunteer') { const l = SAMPLE_LECTURES.find((x) => x.key === key); if (l) volunteer(l); return; }
      const m = byKey[key];
      if (!m) return;
      if (act === 'request') requestMentoring(m);
      else if (act === 'profile') viewProfile(m);
      else if (act === 'map') UCP.go('map', { city: cityOf(m) });
      else if (act === 'programme') UCP.go('network', { q: m.degree });
      else if (act === 'accept') {
        UCP.toast('This is a sample request. Real requests from students arrive in your Messages — switch on mentoring in your profile to receive them.', 'warn');
      }
    });

    form.addEventListener('input', renderMentors);
    form.addEventListener('change', renderMentors);
    form.addEventListener('submit', (e) => { e.preventDefault(); renderMentors(); });
    form.addEventListener('reset', () => setTimeout(() => { fProg.value = ''; fCity.value = ''; renderMentors(); }, 0));

    // ------------------------------------------------------------- initial
    refreshOptions();
    const hadFilterParams = !!(fq.value || wantProg || wantCity || params.get('sector'));
    wantProg = ''; wantCity = '';
    renderMentors();
    renderRequests();
    renderStats();
    renderLectures();

    const section = params.get('section');
    if (section && /^(mentors|requests|lectures)$/.test(section)) {
      const el = page.querySelector('#uc-mc-' + section);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } else if (hadFilterParams) {
      setTimeout(() => page.querySelector('#uc-mc-mentors').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }

    // ---------------------------------------------------------- live data
    if (liveState === 'loading') {
      const filter = encodeURIComponent('(mentor=true)');
      UCP.api('GET', '/api/collections/users/records?filter=' + filter + '&perPage=60')
        .then((r) => {
          if (!page.isConnected) return;
          live = (r && r.items ? r.items : []).map((u) => Object.assign({}, u, { key: 'live:' + u.id, sample: false }));
          live.forEach((m) => { byKey[m.key] = m; });
          liveState = 'ready';
        })
        .catch(() => { liveState = 'error'; })
        .then(() => {
          if (!page.isConnected) return;
          refreshOptions();
          renderMentors();
          renderStats();
        });
    }
  };
})();
