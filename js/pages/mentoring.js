/* UniCircle page module: #mentoring ("Mentor & Tutor") — see js/pages/_shared.js.

   Two tabs: Mentors (users.mentor=true) and Tutors (users.tutor=true, with
   tutor_subjects and a role chip). Live people first, then labelled Samples.
   - "Request mentoring/tutoring" asks for a short topic, tries to create a
     mentorships record (silently ignored if the collection is not live yet),
     then sends the structured first message and opens the chat.
   - "My requests" lists mentorships where I am mentor or mentee; a mentor can
     set status active/closed. If the list cannot load: an honest empty state.
   - Filters: keyword / programme / sector / city. Honours
     #mentoring?q=…&programme=…&sector=…&city=…&tab=mentors|tutors&section=mentors|requests|lectures|myrequests
   - Emits: #map?city=…, #network?q=<programme|name>, #profile?section=mentoring.
   Listeners attach to the freshly rendered .uc-mc element (never to `root`,
   which persists across renders), so re-rendering never stacks handlers. */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  const HUES = [45, 275, 185, 235, 145, 305, 25];
  const ID_RE = /^[a-z0-9]{1,32}$/i;
  const ROLE_CHIP = { student: 'Student tutor', alumnus: 'Alumni', staff: 'Staff' };
  const KIND_LABEL = { mentoring: 'Mentoring', tutoring: 'Tutoring' };
  const STATUS_LABEL = { requested: 'Requested', active: 'Active', closed: 'Closed' };

  // Sample mentors — fictional people, shown with a "Sample" label.
  const SAMPLE_MENTORS = [
    { name: 'Amara Okafor', headline: 'Corporate finance lead · former investment banker', degree: 'M.Sc. Finance', location: 'Amsterdam', mentor_offer: 'CV review for finance roles, mock interviews, choosing between banking and corporate finance.' },
    { name: 'Lukas Brandt', headline: 'Product manager, B2B software', degree: 'B.Sc. Business Informatics', location: 'Berlin', mentor_offer: 'Breaking into product management, portfolio feedback, first-job negotiation.' },
    { name: 'Inès Moreau', headline: 'Strategy consultant', degree: 'M.Sc. International Business', location: 'Paris', mentor_offer: 'Case-interview practice and how to pick a first employer.' },
    { name: 'Pieter de Wit', headline: 'Policy advisor, energy transition', degree: 'M.A. Public Policy', location: 'Brussels', mentor_offer: 'Working in public institutions, traineeship applications, sustainability careers.' },
    { name: 'Sofia Marques', headline: 'Growth marketing lead', degree: 'B.Sc. Economics & Business', location: 'Lisbon', mentor_offer: 'Marketing portfolios, the first 90 days in a new role, coffee chats.' },
    { name: 'Daniel Kowalski', headline: 'Founder, health-tech startup', degree: 'M.Sc. Data Science', location: 'Warsaw', mentor_offer: 'Startup careers, data roles, validating an idea before you build it.' }
  ].map((m, i) => Object.assign({ key: 'sample:' + i, sample: true, kind: 'mentoring' }, m));

  // Sample tutors — fictional, labelled "Sample".
  const SAMPLE_TUTORS = [
    { name: 'Noor Haddad', role: 'student', headline: 'M.Sc. student, quantitative finance', degree: 'M.Sc. Financial Economics', location: 'Maastricht', tutor_subjects: 'Statistics, econometrics, Excel for finance' },
    { name: 'Jonas Weber', role: 'student', headline: 'B.Sc. student, business informatics', degree: 'B.Sc. Business Informatics', location: 'Berlin', tutor_subjects: 'Python basics, databases, intro to programming' },
    { name: 'Camille Laurent', role: 'alumnus', headline: 'Data analyst, former teaching assistant', degree: 'M.Sc. Data Science', location: 'Paris', tutor_subjects: 'Linear algebra, R, thesis methodology' }
  ].map((m, i) => Object.assign({ key: 'sampletutor:' + i, sample: true, kind: 'tutoring' }, m));

  // Sample incoming requests (what a mentor sees once mentoring).
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

  const FORMATS = ['Intro call (30 min)', 'CV review', 'Coffee chat', 'Questions by message', 'Study session'];

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || '?';
  }
  function hueFor(name) {
    let h = 0;
    String(name || '').split('').forEach((c) => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
    return HUES[h % HUES.length];
  }
  const cityOf = (m) => String(m.location || '').split(',')[0].trim();
  const haystack = (m) => [m.name, m.headline, m.degree, m.location, m.mentor_offer, m.tutor_subjects].join(' ').toLowerCase();

  function avatarHtml(m, size) {
    const UCP = window.UCP;
    const UC = window.UC;
    const px = size || 54;
    if (!m.sample && m.avatar && m.collectionId && UC && UC.avatarUrl) {
      const src = UC.safeUrl(UC.avatarUrl(m, px <= 64 ? 64 : 100)) || UC.avatarUrl(m, px <= 64 ? 64 : 100);
      return '<img class="uc-mc-avatar" src="' + UCP.esc(src) + '" alt="" width="' + px + '" height="' + px + '" loading="lazy">';
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
    const tgrid = page.querySelector('[data-mc-tgrid]');
    const empty = page.querySelector('[data-mc-empty]');
    const tempty = page.querySelector('[data-mc-tempty]');
    const status = page.querySelector('[data-mc-status]');
    const form = page.querySelector('[data-mc-filters]');
    const tablist = page.querySelector('[data-mc-tabs]');
    const tabBtns = Array.from(page.querySelectorAll('[data-mc-tab]'));
    const fq = form.elements.q;
    const fProg = form.elements.programme;
    const fSector = form.elements.sector;
    const fCity = form.elements.city;

    let tab = 'mentors';
    let live = [];          // live mentors
    let liveTutors = [];    // live tutors
    const initState = me ? (UCP.online() ? 'loading' : 'offline') : 'signedout';
    let liveState = initState;
    let tutorState = initState;
    let reqItems = null;    // null = unavailable / signed out
    const byKey = {};
    SAMPLE_MENTORS.concat(SAMPLE_TUTORS, SAMPLE_REQUESTS).forEach((m) => { byKey[m.key] = m; });

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
      const all = live.concat(SAMPLE_MENTORS, liveTutors, SAMPLE_TUTORS);
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

    // Server-enforced contact doors; the UI only explains them.
    const warn = (msg) => UCP.toast(esc(msg), 'warn');
    function errText(err, fallback) { return (err && err.message) ? String(err.message) : fallback; }
    function myPoints() { const u = UCP.user(); return Math.max(0, Number(u && u.points) || 0); }
    function contactInfo(m) {
      if (m.sample) return { mode: 'open', ok: true, note: '' };
      const mode = ['points', 'request', 'closed'].indexOf(m.contact_mode) >= 0 ? m.contact_mode : 'open';
      const need = Math.max(0, Math.min(10000, Math.floor(Number(m.min_points) || 0)));
      const have = myPoints();
      if (mode === 'points') {
        const ok = have >= need;
        return { mode, ok, need, have, note: 'Asks for ' + need + ' points (you have ' + have + ')'
          + (ok ? '.' : '. You can request once you have ' + need + ' points.') };
      }
      if (mode === 'request') return { mode, ok: false, note: 'Prefers a collaboration request before a mentoring request.' };
      if (mode === 'closed') return { mode, ok: false, note: 'Not accepting requests right now.' };
      return { mode, ok: true, note: '' };
    }
    function requestButton(m, tutor, isMe) {
      if (isMe) return '<button type="button" class="uc-pill-ghost" data-mc-become>Edit my ' + (tutor ? 'tutor' : 'mentor') + ' profile</button>';
      const ci = contactInfo(m);
      const k = esc(m.key);
      if (ci.mode === 'request') {
        return '<button type="button" class="uc-pill-ink" data-mc-act="collab" data-mc-key="' + k + '">Send collaboration request</button>';
      }
      if (ci.mode === 'closed') {
        return '<button type="button" class="uc-pill-ink" disabled aria-disabled="true">Not accepting requests</button>';
      }
      if (ci.mode === 'points' && !ci.ok) {
        return '<button type="button" class="uc-pill-ink" disabled aria-disabled="true">Request ' + (tutor ? 'tutoring' : 'mentoring') + '</button>';
      }
      return '<button type="button" class="uc-pill-ink" data-mc-act="request" data-mc-key="' + k + '">Request ' + (tutor ? 'tutoring' : 'mentoring') + ' <span class="uc-nudge" aria-hidden="true">→</span></button>';
    }

    // ----------------------------------------------------------------- cards
    function personCard(m) {
      const tutor = m.kind === 'tutoring';
      const isMe = !m.sample && me && m.id === me.id;
      const label = m.sample ? '<span class="uc-mc-badge">Sample</span>'
        : (isMe ? '<span class="uc-mc-badge uc-mc-badge--live">You</span>'
          : '<span class="uc-mc-badge uc-mc-badge--live">' + (tutor ? 'Live tutor' : 'Live mentor') + '</span>');
      const roleChip = tutor
        ? ' <span class="uc-mc-badge uc-mc-badge--role">' + esc(ROLE_CHIP[m.role] ? ROLE_CHIP[m.role] : 'Tutor') + '</span>'
        : '';
      const city = cityOf(m);
      const meta = [];
      if (m.degree) meta.push('<button type="button" class="uc-mc-link" data-mc-act="programme" data-mc-key="' + esc(m.key) + '" title="Find people from this programme">' + esc(m.degree) + '</button>');
      if (city) meta.push('<button type="button" class="uc-mc-link" data-mc-act="map" data-mc-key="' + esc(m.key) + '" title="See ' + esc(city) + ' on the map"><span class="iconify" data-icon="ph:map-pin-bold" aria-hidden="true"></span> ' + esc(city) + '</button>');
      const offer = tutor ? (m.tutor_subjects || 'Open to a first conversation.') : (m.mentor_offer || 'Open to a first conversation.');
      return '<article class="uc-card uc-mc-card" aria-label="' + esc(m.name) + '">'
        + '<div class="uc-mc-card-top">' + avatarHtml(m, 54)
        + '<div class="uc-mc-card-id"><div class="uc-mc-name">' + esc(m.name || 'Member') + ' ' + label + roleChip + '</div>'
        + (m.headline ? '<div class="uc-mc-sub">' + esc(m.headline) + '</div>' : '') + '</div></div>'
        + (meta.length ? '<div class="uc-mc-meta">' + meta.join('<span aria-hidden="true">·</span>') + '</div>' : '')
        + '<p class="uc-mc-offer"><span class="uc-mc-offer-l">' + (tutor ? 'Tutors' : 'Offers') + '</span> ' + esc(offer) + '</p>'
        + (isMe ? '' : (function () { const ci = contactInfo(m); return ci.note ? '<p class="uc-mc-door' + (ci.ok ? '' : ' is-blocked') + '">' + esc(ci.note) + '</p>' : ''; })())
        + '<div class="uc-mc-actions">'
        + requestButton(m, tutor, isMe)
        + '<button type="button" class="uc-pill-ghost" data-mc-act="profile" data-mc-key="' + esc(m.key) + '">View profile</button>'
        + '</div></article>';
    }

    function renderLists() {
      const mList = live.concat(SAMPLE_MENTORS).filter(matches);
      const tList = liveTutors.concat(SAMPLE_TUTORS).filter(matches);
      grid.innerHTML = mList.map(personCard).join('');
      tgrid.innerHTML = tList.map(personCard).join('');
      empty.hidden = mList.length > 0;
      tempty.hidden = tList.length > 0;
      const tutorTab = tab === 'tutors';
      const list = tutorTab ? tList : mList;
      const st = tutorTab ? tutorState : liveState;
      const noun = tutorTab ? 'tutor' : 'mentor';
      const nLive = list.filter((m) => !m.sample).length;
      const nSample = list.length - nLive;
      const smp = nSample + ' sample' + (nSample === 1 ? '' : 's');
      let msg;
      if (st === 'loading') msg = 'Loading live ' + noun + 's…';
      else if (st === 'signedout') msg = 'Sign in to see live ' + noun + 's · showing ' + smp;
      else if (st === 'offline') msg = 'Network offline · showing ' + smp;
      else if (st === 'error') msg = 'Could not load live ' + noun + 's · showing ' + smp;
      else msg = nLive + ' live ' + noun + (nLive === 1 ? '' : 's') + ' · ' + smp;
      status.textContent = msg;
      if (window.Iconify) { window.Iconify.scan(grid); window.Iconify.scan(tgrid); }
    }

    function selectTab(name, focus) {
      tab = name === 'tutors' ? 'tutors' : 'mentors';
      tabBtns.forEach((b) => {
        const on = b.getAttribute('data-mc-tab') === tab;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      page.querySelectorAll('[data-mc-panel]').forEach((p) => { p.hidden = p.getAttribute('data-mc-panel') !== tab; });
      renderLists();
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
      const meRec = me ? (live.concat(liveTutors).find((m) => m.id === me.id) || UCP.user() || me) : null;
      const mentorOn = meRec ? (meRec.mentor && meRec.tutor ? 'Mentor + tutor' : meRec.mentor ? 'Mentor' : meRec.tutor ? 'Tutor' : 'Off') : '—';
      const liveN = liveState === 'ready' ? String(live.concat(liveTutors).filter((m) => !(me && m.id === me.id)).length) : '—';
      page.querySelector('[data-mc-stats]').innerHTML =
        '<div class="uc-stat"><div class="uc-stat-n">' + esc(mentorOn) + '</div><div class="uc-stat-l">Your mentor / tutor profile'
        + (meRec && !meRec.mentor && !meRec.tutor ? ' — <button type="button" class="uc-mc-link" data-mc-become>switch it on</button>' : '') + '</div></div>'
        + '<div class="uc-stat"><div class="uc-stat-n">' + sent + '</div><div class="uc-stat-l">Requests you\'ve sent (this device)</div></div>'
        + '<div class="uc-stat"><div class="uc-stat-n">' + esc(liveN) + '</div><div class="uc-stat-l">Other live mentors and tutors</div></div>';
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

    // --------------------------------------------------------- my mentorships
    const STAGES = [['goal', 'Goal'], ['plan', 'Plan'], ['sessions', 'Sessions'], ['done', 'Done']];
    const DOC_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'txt', 'docx'];
    const DOC_MAX = 10 * 1024 * 1024;
    const POINTS_FOR = { tutoring: 10, mentoring: 15 };
    const docsCache = {};   // mentorship id -> array of mentorship_docs | 'error'
    const openDocs = {};    // mentorship id -> true while its documents panel is open
    const busy = {};        // ids with a request in flight

    function pbDate(v) {
      if (!v) return null;
      const d = new Date(String(v).replace(' ', 'T'));
      return isNaN(d.getTime()) ? null : d;
    }
    const fmtDate = (d) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const fmtDateTime = (d) => d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    function dateInputValue(v) { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v || '')); return m ? m[1] : ''; }
    function cleanName(n) { return String(n || 'file').replace(/_[a-z0-9]{10}(\.[^.]+)$/i, '$1'); }

    function emptyOrbit() {
      return '<div class="uc-empty-orbit" style="--uc-node-h:45"><div class="uc-empty-nodes" aria-hidden="true"><i></i><u></u><i></i></div>'
        + '<p>Your mentorships will appear here</p></div>';
    }

    function stepperHtml(r, locked) {
      const cur = Math.max(0, STAGES.findIndex((s) => s[0] === r.stage));
      return '<ol class="uc-mc-stepper" aria-label="Mentorship stage">' + STAGES.map((s, i) => {
        const cls = 'uc-mc-step' + (i < cur ? ' is-past' : '') + (i === cur ? ' is-current' : '');
        const inner = '<span class="uc-mc-step-n" aria-hidden="true">' + (i + 1) + '</span><span class="uc-mc-step-l">' + esc(s[1]) + '</span>';
        return '<li class="' + cls + '">' + (locked
          ? '<span class="uc-mc-step-b"' + (i === cur ? ' aria-current="step"' : '') + '>' + inner + '</span>'
          : '<button type="button" class="uc-mc-step-b" data-mc-act="stage" data-mc-id="' + esc(r.id) + '" data-mc-stage="' + esc(s[0]) + '"'
            + (i === cur ? ' aria-current="step"' : '') + '>' + inner + '</button>') + '</li>';
      }).join('') + '</ol>';
    }

    function pointsHintHtml(r, iAmMentor, kind) {
      if (!iAmMentor || r.status !== 'active') return '';
      const at = pbDate(r.active_at);
      if (!at) return '';
      const ready = new Date(at.getTime() + 24 * 3600 * 1000);
      if (ready.getTime() > Date.now()) {
        return '<p class="uc-mc-hint">Points are awarded if you close after ' + esc(fmtDateTime(ready)) + '.</p>';
      }
      return '<p class="uc-mc-hint">Closing now can earn you ' + POINTS_FOR[kind] + ' status points.</p>';
    }

    function mentorshipCard(r, u) {
      const iAmMentor = r.mentor === u.id;
      const ex = r.expand || {};
      const other = iAmMentor ? ex.mentee : ex.mentor;
      const otherId = iAmMentor ? r.mentee : r.mentor;
      const kind = r.kind === 'tutoring' ? 'tutoring' : 'mentoring';
      const st = STATUS_LABEL[r.status] ? r.status : 'requested';
      const closed = st === 'closed';
      const who = (other && other.name) || 'a member';
      const id = ID_RE.test(String(r.id || '')) ? r.id : '';
      const active = pbDate(r.active_at);
      const goals = String(r.goals || '');
      let acts = '';
      if (id && !closed) {
        if (iAmMentor && st === 'requested') acts += '<button type="button" class="uc-pill-ink uc-pill-sm" data-mc-act="setstatus" data-mc-id="' + esc(id) + '" data-mc-status="active">Accept</button>';
        acts += '<button type="button" class="uc-pill-ghost uc-pill-sm" data-mc-act="setstatus" data-mc-id="' + esc(id) + '" data-mc-status="closed">'
          + (iAmMentor && st === 'active' ? 'Close and finish' : 'Close') + '</button>';
      }
      if (ID_RE.test(String(otherId || ''))) acts += '<button type="button" class="uc-pill-ghost uc-pill-sm" data-mc-act="chat" data-mc-id="' + esc(otherId) + '">Message</button>';

      const plan = closed
        ? '<div class="uc-mc-plan is-ro"><div class="uc-mc-plan-row"><span class="uc-mc-label">Goals</span><p class="uc-mc-ro">' + (goals ? esc(goals) : 'No goals were written down.') + '</p></div>'
          + '<div class="uc-mc-plan-row"><span class="uc-mc-label">Next session</span><p class="uc-mc-ro">' + (dateInputValue(r.next_session) ? esc(fmtDate(pbDate(dateInputValue(r.next_session)) || new Date())) : 'None planned') + '</p></div></div>'
        : '<form class="uc-mc-plan" data-mc-planform="' + esc(id) + '" novalidate>'
          + '<label class="uc-mc-plan-row"><span class="uc-mc-label">Goals</span>'
          + '<textarea name="goals" rows="3" maxlength="500" placeholder="What do you want to get out of this? Keep it concrete.">' + esc(goals) + '</textarea>'
          + '<span class="uc-mc-count" data-mc-gcount aria-live="off">' + goals.length + ' / 500</span></label>'
          + '<label class="uc-mc-plan-row"><span class="uc-mc-label">Next session</span>'
          + '<input type="date" name="next_session" value="' + esc(dateInputValue(r.next_session)) + '"></label>'
          + '<div class="uc-mc-plan-acts"><button type="submit" class="uc-pill-ink uc-pill-sm">Save plan</button></div></form>';

      let docs = '';
      if (st !== 'requested' && id) {
        const open = !!openDocs[id];
        docs = '<div class="uc-mc-docs-wrap"><button type="button" class="uc-mc-docs-toggle" data-mc-act="docs" data-mc-id="' + esc(id) + '" aria-expanded="' + open + '" aria-controls="uc-mc-docs-' + esc(id) + '">'
          + 'Documents <span class="uc-mc-docs-chev" aria-hidden="true">›</span></button>'
          + '<div class="uc-mc-docs" id="uc-mc-docs-' + esc(id) + '" data-mc-docs="' + esc(id) + '"' + (open ? '' : ' hidden') + '></div></div>';
      }

      return '<article class="uc-card uc-mc-ms' + (closed ? ' is-closed' : '') + '" data-mc-ms="' + esc(id) + '" aria-label="' + esc(KIND_LABEL[kind]) + ' with ' + esc(who) + '">'
        + '<div class="uc-mc-ms-head"><div class="uc-mc-ms-id">'
        + '<div class="uc-mc-req-top"><span class="uc-mc-chip uc-mc-chip--kind">' + esc(KIND_LABEL[kind]) + '</span>'
        + '<span class="uc-mc-chip uc-mc-chip--' + esc(st) + '">' + esc(closed ? 'Closed' : STATUS_LABEL[st]) + '</span></div>'
        + '<div class="uc-mc-name">' + esc(r.topic || 'No topic given') + '</div>'
        + '<div class="uc-mc-sub">' + (iAmMentor ? 'With ' : 'With ') + esc(who) + (iAmMentor ? ' (you mentor)' : ' (your ' + (kind === 'tutoring' ? 'tutor' : 'mentor') + ')')
        + (active ? ' · Active since ' + esc(fmtDate(active)) : '') + '</div></div>'
        + '<div class="uc-mc-req-acts">' + acts + '</div></div>'
        + stepperHtml(r, closed || !id)
        + (closed ? '<p class="uc-mc-hint">Closed. This mentorship is read-only.</p>' : '')
        + plan
        + (iAmMentor && st === 'active' ? pointsHintHtml(r, iAmMentor, kind) : '')
        + (iAmMentor && !closed && st !== 'requested'
          ? '<p class="uc-mc-fine">The mentor or tutor earns status points when a mentorship that was active for at least 24 hours is closed by them (10 tutoring / 15 mentoring). The person helped earns none.</p>' : '')
        + docs
        + '</article>';
    }

    function renderMyRequests() {
      const box = page.querySelector('[data-mc-myreq]');
      if (!box) return;
      const u = UCP.user();
      if (!reqItems || !reqItems.length || !u) { box.innerHTML = emptyOrbit(); return; }
      box.innerHTML = '<div class="uc-mc-reqlist">' + reqItems.map((r) => mentorshipCard(r, u)).join('') + '</div>';
      Object.keys(openDocs).forEach((id) => { if (openDocs[id]) { renderDocs(id); if (docsCache[id] === undefined) loadDocs(id); } });
    }
    function loadMyRequests() {
      const u = UCP.user();
      if (!u || !ID_RE.test(String(u.id || '')) || !UCP.online()) { reqItems = null; renderMyRequests(); return Promise.resolve(); }
      const filter = encodeURIComponent('(mentor="' + u.id + '"||mentee="' + u.id + '")');
      return UCP.api('GET', '/api/collections/mentorships/records?perPage=50&sort=-created&expand=mentor,mentee&filter=' + filter)
        .then((r) => { reqItems = (r && r.items) || []; })
        .catch(() => { reqItems = null; })
        .then(() => { if (page.isConnected) renderMyRequests(); });
    }
    const findMs = (id) => (reqItems || []).find((r) => r.id === id);

    function patchMs(id, body, okMsg) {
      if (!ID_RE.test(String(id || '')) || busy[id]) return Promise.resolve(false);
      busy[id] = true;
      return UCP.api('PATCH', '/api/collections/mentorships/records/' + id, body)
        .then(() => { busy[id] = false; if (okMsg) UCP.toast(esc(okMsg)); return loadMyRequests().then(() => true); })
        .catch((err) => { busy[id] = false; warn(errText(err, 'Could not update the mentorship — please try again.')); return false; });
    }
    function setStatus(id, st) {
      if (st !== 'active' && st !== 'closed') return;
      if (st === 'active') { patchMs(id, { status: 'active' }, 'Request accepted.'); return; }
      const r = findMs(id);
      const u = UCP.user();
      const mentorSide = !!(r && u && r.mentor === u.id);
      UCP.dialog({
        title: mentorSide ? 'Close and finish this mentorship?' : 'Close this mentorship?',
        body: '<p>A closed mentorship is frozen: nobody can edit the plan or add documents any more. Its documents are deleted 90 days after closing.</p>'
          + (mentorSide ? '<p class="uc-mc-fine">The mentor or tutor earns status points when a mentorship that was active for at least 24 hours is closed by them (10 tutoring / 15 mentoring). The person helped earns none.</p>' : ''),
        actions: [
          { label: 'Keep it open' },
          { label: mentorSide ? 'Close and finish' : 'Close', primary: true, onClick: (close) => { close(); patchMs(id, { status: 'closed' }, 'Mentorship closed.'); } }
        ]
      });
    }
    function savePlan(form) {
      const id = form.getAttribute('data-mc-planform');
      const goals = form.elements.goals.value.trim().slice(0, 500);
      const ns = form.elements.next_session.value;
      if (ns && !/^\d{4}-\d{2}-\d{2}$/.test(ns)) { warn('Please pick a valid date.'); return; }
      patchMs(id, { goals: goals, next_session: ns || '' }, 'Plan saved.');
    }
    function setStage(id, stage) {
      if (!STAGES.some((s) => s[0] === stage)) return;
      const r = findMs(id);
      if (r && r.stage === stage) return;
      patchMs(id, { stage: stage });
    }

    // ------------------------------------------------------------- documents
    function renderDocs(id) {
      const box = page.querySelector('[data-mc-docs="' + id + '"]');
      if (!box) return;
      const r = findMs(id);
      const u = UCP.user();
      const active = !!(r && r.status === 'active');
      const items = docsCache[id];
      let html = '<p class="uc-mc-notice">Only you two can see these documents. They are deleted 90 days after the mentorship closes. Do not upload ID documents, health data or other people\'s grades.</p>';
      if (items === undefined) html += '<p class="uc-mc-fine">Loading documents…</p>';
      else if (items === 'error') html += '<p class="uc-mc-fine">Could not load the documents right now.</p>';
      else if (!items.length) html += '<p class="uc-mc-fine">No documents yet.</p>';
      else {
        html += '<ul class="uc-mc-doclist">' + items.map((d) => {
          const up = d.expand && d.expand.uploader;
          const mine = !!(u && d.uploader === u.id);
          const created = pbDate(d.created);
          const did = ID_RE.test(String(d.id || '')) ? d.id : '';
          return '<li class="uc-mc-doc"><div class="uc-mc-doc-body"><div class="uc-mc-doc-name">' + esc(cleanName(d.file)) + '</div>'
            + (d.note ? '<div class="uc-mc-doc-note">' + esc(d.note) + '</div>' : '')
            + '<div class="uc-mc-sub">' + esc(mine ? 'You' : ((up && up.name) || 'A member')) + (created ? ' · ' + esc(fmtDate(created)) : '') + '</div></div>'
            + '<div class="uc-mc-doc-acts">'
            + (did ? '<button type="button" class="uc-pill-ghost uc-pill-sm" data-mc-act="opendoc" data-mc-id="' + esc(id) + '" data-mc-doc="' + esc(did) + '">Open</button>' : '')
            + (did && mine && active ? '<button type="button" class="uc-pill-ghost uc-pill-sm" data-mc-act="deldoc" data-mc-id="' + esc(id) + '" data-mc-doc="' + esc(did) + '">Delete</button>' : '')
            + '</div></li>';
        }).join('') + '</ul>';
      }
      if (active) {
        const full = Array.isArray(items) && items.length >= 30;
        html += full ? '<p class="uc-mc-fine">The limit of 30 documents is reached. Delete one to add another.</p>'
          : '<form class="uc-mc-upform" data-mc-docform="' + esc(id) + '" novalidate>'
            + '<label class="uc-mc-plan-row"><span class="uc-mc-label">File (PDF, PNG, JPG, TXT or DOCX, up to 10 MB)</span>'
            + '<input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.docx"></label>'
            + '<label class="uc-mc-plan-row"><span class="uc-mc-label">Note (optional)</span>'
            + '<input type="text" name="note" maxlength="300" autocomplete="off" placeholder="What is this file?"></label>'
            + '<div class="uc-mc-plan-acts"><button type="submit" class="uc-pill-ink uc-pill-sm">Upload</button>'
            + '<span class="uc-mc-fine" data-mc-upstate role="status" aria-live="polite"></span></div></form>';
      } else {
        html += '<p class="uc-mc-fine">' + (r && r.status === 'closed' ? 'This mentorship is closed, so the list is read-only.' : 'Documents can be shared once the mentorship is active.') + '</p>';
      }
      box.innerHTML = html;
    }
    function loadDocs(id) {
      if (!ID_RE.test(String(id || ''))) return Promise.resolve();
      const filter = encodeURIComponent('(mentorship="' + id + '")');
      return UCP.api('GET', '/api/collections/mentorship_docs/records?filter=' + filter + '&sort=-created&perPage=50&expand=uploader')
        .then((r) => { docsCache[id] = (r && r.items) || []; })
        .catch(() => { docsCache[id] = 'error'; })
        .then(() => { if (page.isConnected) renderDocs(id); });
    }
    function toggleDocs(btn) {
      const id = btn.getAttribute('data-mc-id');
      if (!ID_RE.test(String(id || ''))) return;
      const box = page.querySelector('[data-mc-docs="' + id + '"]');
      if (!box) return;
      const open = box.hidden;
      box.hidden = !open;
      openDocs[id] = open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) { renderDocs(id); loadDocs(id); }
    }
    function uploadDoc(form) {
      const id = form.getAttribute('data-mc-docform');
      const u = UCP.user();
      const file = form.elements.file.files && form.elements.file.files[0];
      const state = form.querySelector('[data-mc-upstate]');
      const btn = form.querySelector('button[type="submit"]');
      if (!u || !ID_RE.test(String(id || ''))) return;
      if (!file) { warn('Choose a file first.'); return; }
      const ext = (String(file.name).split('.').pop() || '').toLowerCase();
      if (DOC_EXT.indexOf(ext) < 0) { warn('This file type is not allowed. Use PDF, PNG, JPG, TXT or DOCX.'); return; }
      if (file.size > DOC_MAX) { warn('The file is larger than 10 MB.'); return; }
      if (file.size === 0) { warn('The file is empty.'); return; }
      const cached = docsCache[id];
      if (Array.isArray(cached) && cached.length >= 30) { warn('The limit of 30 documents is reached.'); return; }
      const note = form.elements.note.value.trim().slice(0, 300);
      btn.disabled = true;
      state.textContent = 'Uploading ' + file.name + '…';
      UC.uploadMedia('/api/collections/mentorship_docs/records', 'POST', { mentorship: id, uploader: u.id, note: note }, 'file', file, file.name)
        .then(() => { UCP.toast('Document uploaded.'); return loadDocs(id); })
        .catch((err) => {
          btn.disabled = false;
          state.textContent = '';
          warn(errText(err, 'Upload failed — please try again.'));
        });
    }
    async function openDoc(id, docId) {
      const items = docsCache[id];
      const rec = Array.isArray(items) ? items.find((d) => d.id === docId) : null;
      if (!rec) return;
      // open the window synchronously (popup blockers), point it at the short-lived URL afterwards
      const w = window.open('about:blank', '_blank');
      try {
        const url = await UC.protectedFileUrl(rec, 'file');
        if (!url) throw new Error('No file');
        if (w) { w.opener = null; w.location.href = url; }
        else {
          const a = document.createElement('a');
          a.href = url; a.target = '_blank'; a.rel = 'noopener';
          document.body.appendChild(a); a.click(); a.remove();
        }
      } catch (err) {
        if (w) w.close();
        warn(errText(err, 'Could not open the document.'));
      }
    }
    function deleteDoc(id, docId) {
      UCP.dialog({
        title: 'Delete this document?',
        body: '<p>The file is removed for both of you. This cannot be undone.</p>',
        actions: [
          { label: 'Cancel' },
          { label: 'Delete', primary: true, onClick: (close) => {
            close();
            UCP.api('DELETE', '/api/collections/mentorship_docs/records/' + docId)
              .then(() => { UCP.toast('Document deleted.'); return loadDocs(id); })
              .catch((err) => warn(errText(err, 'Could not delete the document.')));
          } }
        ]
      });
    }


    // --------------------------------------------------------------- actions
    function becomeMentor() {
      UCP.dialog({
        title: 'Become a mentor or tutor',
        body: '<p>Mentoring and tutoring on UniCircle are light-touch: people see your card here, send a short ask with a topic, and the conversation continues in Messages. You decide what to accept.</p>'
          + '<ol class="uc-mc-steps uc-mc-steps--ink"><li>Open your profile and find the <b>Mentoring &amp; tutoring</b> card.</li>'
          + '<li>Switch on mentoring (alumni) and/or tutoring (students and alumni) and say what you offer.</li>'
          + '<li>Save. Your card appears in the Mentors or Tutors tab for signed-in members.</li></ol>',
        actions: [
          { label: 'Not now' },
          { label: UCP.user() ? 'Open my profile' : 'Sign in to start', primary: true, onClick: (close) => {
            close();
            if (!UC) return;
            if (!UCP.user()) { UC.openAuth('signin'); return; }
            UCP.go('profile', { section: 'mentoring' });
          } }
        ]
      });
    }

    function requestMentoring(m) {
      const tutor = m.kind === 'tutoring';
      const kind = tutor ? 'tutoring' : 'mentoring';
      if (m.sample) {
        UCP.toast(esc(m.name) + ' is a sample ' + (tutor ? 'tutor' : 'mentor') + ' — requests go to live people only.', 'warn');
        return;
      }
      if (!UCP.user()) { if (UC) UC.openAuth('signin'); return; }
      if (!UCP.online()) { UCP.toast('The network is offline right now — try again in a moment.', 'warn'); return; }
      const ci = contactInfo(m);
      if (ci.mode === 'request') { openCollab(m); return; }
      if (ci.mode === 'closed') { warn(ci.note); return; }
      if (ci.mode === 'points' && !ci.ok) { warn(ci.note); return; }
      const u = UCP.user();
      const fmt = FORMATS.map((f) => '<option>' + esc(f) + '</option>').join('');
      UCP.dialog({
        title: 'Ask ' + (m.name || (tutor ? 'this tutor' : 'this mentor')).split(' ')[0],
        body: '<form class="uc-mc-form" data-mc-reqform novalidate>'
          + '<label><span class="uc-mc-label">Topic (short) <span aria-hidden="true">*</span></span>'
          + '<input name="topic" maxlength="160" required autocomplete="off" placeholder="' + (tutor ? 'e.g. Help with econometrics exam prep' : 'e.g. Choosing between two master\'s programmes') + '"></label>'
          + '<label><span class="uc-mc-label">More detail (optional)</span>'
          + '<textarea name="goal" rows="3" maxlength="600" placeholder="Anything that helps them say yes quickly."></textarea></label>'
          + '<label><span class="uc-mc-label">Preferred format</span><select name="format">' + fmt + '</select></label>'
          + '<label><span class="uc-mc-label">About you (optional)</span><input name="about" maxlength="140" value="' + esc(u.degree || u.headline || '') + '" placeholder="Programme and year"></label>'
          + '<p class="uc-mc-fine">This sends a real message to ' + esc(m.name) + ' and opens your conversation.</p></form>',
        actions: [
          { label: 'Cancel' },
          { label: 'Send request', primary: true, onClick: async (close, d) => {
            const f = d.querySelector('[data-mc-reqform]');
            const topic = f.elements.topic.value.trim().slice(0, 160);
            if (!topic) { f.elements.topic.focus(); UCP.toast('Add a short topic first.', 'warn'); return; }
            const btn = d.querySelectorAll('.uc-dialog-actions button')[1];
            if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
            const goal = f.elements.goal.value.trim();
            const about = f.elements.about.value.trim();
            // 1) record the request; any failure (collection not live yet) is ignored on purpose
            let recorded = false;
            if (ID_RE.test(String(m.id || ''))) {
              try {
                await UCP.api('POST', '/api/collections/mentorships/records', { mentor: m.id, mentee: u.id, kind: kind, topic: topic, status: 'requested' });
                recorded = true;
              } catch (e) {
                // only a missing collection (404) falls back to message-only; every other server message is shown
                if (!e || e.status !== 404) {
                  if (btn) { btn.disabled = false; btn.textContent = 'Send request'; }
                  warn(errText(e, 'Could not send the request — please try again.'));
                  return;
                }
              }
            }
            // 2) the structured first message, adapted for kind
            const text = (tutor ? 'Tutoring request' : 'Mentoring request') + '\n\nTopic: ' + topic
              + (goal ? '\nDetails: ' + goal : '') + '\nPreferred format: ' + f.elements.format.value
              + (about ? '\nAbout me: ' + about : '') + '\n\n— sent via UniCircle Mentor & Tutor';
            try {
              await UCP.api('POST', '/api/collections/messages/records', { sender: u.id, recipient: m.id, text: text, read: false });
              const sent = UCP.store('mc_requests') || [];
              sent.push({ id: m.id, at: Date.now() });
              UCP.store('mc_requests', sent.slice(-100));
              close();
              UCP.toast('Request sent to ' + esc(m.name) + '.');
              renderStats();
              if (recorded) loadMyRequests();
              if (UC) UC.openChat(m.id);
            } catch (err) {
              if (btn) { btn.disabled = false; btn.textContent = 'Send request'; }
              warn(errText(err, 'Could not send the request — please try again.'));
            }
          } }
        ]
      });
    }

    function openCollab(m) {
      if (!UCP.user()) { if (UC) UC.openAuth('signin'); return; }
      if (m.sample) { warn('This is a sample profile — collaboration requests go to live members only.'); return; }
      if (window.UCCollab && typeof window.UCCollab.requestDialog === 'function') window.UCCollab.requestDialog(m.id, m.name);
      else warn('Collaboration requests are not available right now.');
    }

    function viewProfile(m) {
      const city = cityOf(m);
      const isOffer = !!m.kind;
      const tutor = m.kind === 'tutoring';
      const isMe = !m.sample && me && m.id === me.id;
      const rows = [];
      if (m.headline) rows.push(['Role', esc(m.headline)]);
      if (tutor && ROLE_CHIP[m.role]) rows.push(['Status', esc(ROLE_CHIP[m.role])]);
      if (m.degree) rows.push(['Programme', '<button type="button" class="uc-mc-link" data-pf="programme">' + esc(m.degree) + '</button>']);
      if (city) rows.push(['City', esc(m.location)]);
      if (tutor ? m.tutor_subjects : m.mentor_offer) rows.push([tutor ? 'Tutors' : 'Offers', esc(tutor ? m.tutor_subjects : m.mentor_offer)]);
      if (m.ask) rows.push(['Asks', '“' + esc(m.ask) + '”']);
      const actions = [{ label: 'Close' }];
      if (city) actions.push({ label: 'See on map', onClick: (close) => { close(); UCP.go('map', { city: city }); } });
      if (!isMe) actions.push({ label: 'Message', primary: !isOffer, onClick: (close) => {
        if (m.sample) { UCP.toast('This is a sample profile — messages go to live members only.', 'warn'); return; }
        close(); if (UC) UC.openChat(m.id);
      } });
      if (isOffer && !isMe) actions.push({ label: tutor ? 'Request tutoring' : 'Request mentoring', primary: true, onClick: (close) => { if (!m.sample) close(); requestMentoring(m); } });
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
      if (t.hasAttribute('data-mc-tab')) { selectTab(t.getAttribute('data-mc-tab')); return; }
      if (t.hasAttribute('data-mc-become')) { becomeMentor(); return; }
      if (t.hasAttribute('data-mc-find')) {
        const sec = page.querySelector('#uc-mc-mentors');
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => fq.focus({ preventScroll: true }), 350);
        return;
      }
      const act = t.getAttribute('data-mc-act');
      if (!act) return;
      if (act === 'stage') { setStage(t.getAttribute('data-mc-id'), t.getAttribute('data-mc-stage')); return; }
      if (act === 'docs') { toggleDocs(t); return; }
      if (act === 'opendoc') { openDoc(t.getAttribute('data-mc-id'), t.getAttribute('data-mc-doc')); return; }
      if (act === 'deldoc') { deleteDoc(t.getAttribute('data-mc-id'), t.getAttribute('data-mc-doc')); return; }
      if (act === 'setstatus') { setStatus(t.getAttribute('data-mc-id'), t.getAttribute('data-mc-status')); return; }
      if (act === 'chat') {
        const pid = t.getAttribute('data-mc-id');
        if (UC && ID_RE.test(String(pid || ''))) UC.openChat(pid);
        return;
      }
      const key = t.getAttribute('data-mc-key');
      if (act === 'volunteer') { const l = SAMPLE_LECTURES.find((x) => x.key === key); if (l) volunteer(l); return; }
      const m = byKey[key];
      if (!m) return;
      if (act === 'request') requestMentoring(m);
      else if (act === 'collab') openCollab(m);
      else if (act === 'profile') viewProfile(m);
      else if (act === 'map') UCP.go('map', { city: cityOf(m) });
      else if (act === 'programme') UCP.go('network', { q: m.degree });
      else if (act === 'accept') {
        UCP.toast('This is a sample request. Real requests arrive in My requests and Messages — switch on mentoring or tutoring in your profile to receive them.', 'warn');
      }
    });

    tablist.addEventListener('keydown', (e) => {
      const i = tabBtns.indexOf(document.activeElement);
      if (i < 0) return;
      let j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % tabBtns.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabBtns.length) % tabBtns.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabBtns.length - 1;
      if (j >= 0) { e.preventDefault(); selectTab(tabBtns[j].getAttribute('data-mc-tab'), true); }
    });

    page.addEventListener('submit', (e) => {
      const pf = e.target.closest('[data-mc-planform]');
      if (pf) { e.preventDefault(); savePlan(pf); return; }
      const df = e.target.closest('[data-mc-docform]');
      if (df) { e.preventDefault(); uploadDoc(df); }
    });
    page.addEventListener('input', (e) => {
      const g = e.target.closest && e.target.closest('textarea[name="goals"]');
      if (!g) return;
      const c = g.parentNode.querySelector('[data-mc-gcount]');
      if (c) c.textContent = g.value.length + ' / 500';
    });

    form.addEventListener('input', renderLists);
    form.addEventListener('change', renderLists);
    form.addEventListener('submit', (e) => { e.preventDefault(); renderLists(); });
    form.addEventListener('reset', () => setTimeout(() => { fProg.value = ''; fCity.value = ''; renderLists(); }, 0));

    // ------------------------------------------------------------- initial
    refreshOptions();
    const hadFilterParams = !!(fq.value || wantProg || wantCity || params.get('sector'));
    wantProg = ''; wantCity = '';
    selectTab(params.get('tab') === 'tutors' ? 'tutors' : 'mentors');
    renderRequests();
    renderStats();
    renderLectures();
    renderMyRequests();

    const section = params.get('section');
    if (section && /^(mentors|requests|lectures|myrequests)$/.test(section)) {
      const el = page.querySelector(section === 'myrequests' ? '#uc-mc-myrequests' : '#uc-mc-' + section);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } else if (hadFilterParams) {
      setTimeout(() => page.querySelector('#uc-mc-mentors').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }

    // ---------------------------------------------------------- live data
    function loadPeople(field, assign) {
      const filter = encodeURIComponent('(' + field + '=true)');
      return UCP.api('GET', '/api/collections/users/records?filter=' + filter + '&perPage=60')
        .then((r) => { assign((r && r.items ? r.items : []), 'ready'); })
        .catch(() => { assign([], 'error'); });
    }
    if (initState === 'loading') {
      const mk = (prefix, kind) => (items) => items.map((u) => {
        const o = Object.assign({}, u, { key: prefix + u.id, sample: false, kind: kind });
        byKey[o.key] = o;
        return o;
      });
      const mkM = mk('live:', 'mentoring');
      const mkT = mk('tutor:', 'tutoring');
      Promise.all([
        loadPeople('mentor', (items, st) => { live = mkM(items); liveState = st; }),
        loadPeople('tutor', (items, st) => { liveTutors = mkT(items); tutorState = st; })
      ]).then(() => {
        if (!page.isConnected) return;
        refreshOptions();
        renderLists();
        renderStats();
      });
    }
    loadMyRequests();
  };
})();
