/* UniCircle page module: #network — see js/pages/_shared.js for the contract.

   Directory of real members (PocketBase `users`, signed-in only) plus clearly
   labelled SAMPLE profiles (fictional, read from components/network.html).
   Conversational search → sector / city / mentor filters + free-text keywords.
   Hash params honoured on load: q, city, mentor=1, sector, programme.
   Emits: #map?city=…, #mentoring?q=…, #network?q=…, #pbl-hub?id=…            */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  const MAX_SAMPLES_WHEN_REAL = 6;   // samples only shown while the real circle is small

  // Sector vocabulary: a token matches when it starts with a stem (or equals a short one).
  const SECTORS = {
    finance: ['financ', 'bank', 'invest', 'quant', 'risk', 'trading', 'trader', 'equity', 'asset',
      'fund', 'accounting', 'accountant', 'audit', 'fintech', 'treasury', 'crypto', 'cfo', 'controller', 'insurance'],
    consulting: ['consult', 'strategy', 'strategist', 'advisory', 'advisor', 'adviser'],
    technology: ['tech', 'software', 'engineer', 'developer', 'data', 'product', 'startup', 'digital', 'cto', 'cyber', 'cloud'],
    marketing: ['marketing', 'marketer', 'brand', 'sales', 'communication', 'advertis', 'commercial'],
    research: ['research', 'phd', 'academ', 'professor', 'lecturer', 'scientist', 'postdoc'],
    public: ['policy', 'government', 'public', 'ngo', 'nonprofit', 'ministry', 'diplomat']
  };
  const SHORT_SECTOR = { ai: 'technology', ml: 'technology', it: 'technology', ma: 'finance', pe: 'finance', vc: 'finance' };
  const SECTOR_LABEL = { finance: 'Finance', consulting: 'Consulting', technology: 'Technology & data',
    marketing: 'Marketing & sales', research: 'Research & academia', public: 'Public sector & policy' };

  const KNOWN_CITIES = ['Amsterdam', 'Berlin', 'London', 'Paris', 'Brussels', 'Frankfurt', 'Munich', 'Zurich',
    'Geneva', 'Rotterdam', 'Utrecht', 'The Hague', 'Eindhoven', 'Luxembourg', 'Dublin', 'Madrid', 'Barcelona',
    'Milan', 'Vienna', 'Copenhagen', 'Stockholm', 'Oslo', 'Lisbon', 'Warsaw', 'Prague', 'Antwerp', 'Cologne',
    'Düsseldorf', 'Hamburg', 'New York', 'Singapore', 'Hong Kong', 'Dubai', 'Toronto', 'Shanghai', 'Tokyo'];

  const STOP = new Set(('a an the and or of in at on to for from with who whom that which are is be been '
    + 'alumni alumnus alumna graduates graduate grads people peers person folks someone anyone members member '
    + 'find show me looking look search want need based near around working work works class classmates '
    + 'open my our their some any all into about like by as currently now who\'s whos').split(/\s+/));

  const HUES = [275, 185, 235, 25, 45, 305, 145];

  // ------------------------------------------------------------------ helpers
  const esc = (s) => window.UCP.esc(s);
  const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  const cityOf = (loc) => {
    const first = String(loc || '').split(/[,/·|(]/)[0].trim();
    return first ? (first === first.toLowerCase() ? titleCase(first) : first) : '';
  };
  const programmeOf = (deg) => String(deg || '').replace(/\s*[’'`]\s*\d{2,4}\s*$/, '').replace(/\s*\(?(class of )?\d{4}\)?\s*$/i, '').trim();
  const initials = (n) => String(n || '?').trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  const hueOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HUES[h % HUES.length]; };
  const tokens = (s) => norm(s).split(/[^a-z0-9&]+/).filter(Boolean);
  const safeUrl = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : '');
  
  function sectorsOf(text) {
    const out = new Set();
    tokens(text).forEach((t) => {
      if (SHORT_SECTOR[t]) out.add(SHORT_SECTOR[t]);
      Object.keys(SECTORS).forEach((k) => { if (SECTORS[k].some((st) => t.startsWith(st))) out.add(k); });
    });
    return Array.from(out);
  }

  function personFromUser(u) {
    const api = (window.UC && window.UC.API) || '';
    const avatar = u.avatar && u.collectionId
      ? api + '/api/files/' + encodeURIComponent(u.collectionId) + '/' + encodeURIComponent(u.id) + '/' + encodeURIComponent(u.avatar) : '';
    const name = (u.name || '').trim() || 'UniCircle member';
    return {
      id: u.id, sample: false, name,
      headline: u.headline || '', degree: u.degree || '', location: u.location || '',
      city: cityOf(u.location), programme: programmeOf(u.degree),
      mentor: !!u.mentor, offer: u.mentor_offer || '', linkedin: safeUrl(u.linkedin_url),
      avatar, hue: hueOf(name), sectors: sectorsOf((u.headline || '') + ' ' + (u.degree || ''))
    };
  }

  function personFromSample(el) {
    const d = el.dataset;
    return {
      id: d.id, sample: true, name: d.name || 'Sample person',
      headline: d.headline || '', degree: d.degree || '', location: d.location || '',
      city: cityOf(d.location), programme: programmeOf(d.degree),
      mentor: d.mentor === '1', offer: d.offer || '', linkedin: '',
      avatar: '', hue: Number(d.hue) || hueOf(d.name), sectors: sectorsOf((d.headline || '') + ' ' + (d.degree || ''))
    };
  }

  // ---------------------------------------------------- natural-language parse
  // "finance alumni in Berlin who mentor" → { sector:'finance', city:'Berlin', mentor:true, words:[] }
  function parseQuery(raw, cityList, programmeList) {
    const out = { sector: '', city: '', mentor: false, programme: '', words: [] };
    let q = ' ' + norm(raw).replace(/["“”]/g, ' ') + ' ';
    if (!q.trim()) return out;

    // An exact programme name (e.g. from a programme link) → programme filter.
    const exactProg = programmeList.find((p) => norm(p) === norm(raw).trim() || norm(p) === norm(programmeOf(raw)).trim());
    if (exactProg) { out.programme = exactProg; return out; }

    // Cities first (multi-word names like "New York" / "The Hague").
    const cities = Array.from(new Set(cityList.concat(KNOWN_CITIES))).sort((a, b) => b.length - a.length);
    for (const c of cities) {
      const re = new RegExp('(^|[^a-z0-9])' + norm(c).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^a-z0-9])');
      if (re.test(q)) { out.city = c; q = q.replace(re, '$1 '); break; }
    }
    if (/\bmentor\w*|\bmentee\w*/.test(q)) { out.mentor = true; q = q.replace(/\bmentor\w*|\bmentee\w*/g, ' '); }

    const rest = [];
    const words = q.split(/[^a-z0-9&]+/).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      const t = words[i];
      // Unknown city via "in/from/based in <word>" when no known city matched.
      if (!out.city && (t === 'in' || t === 'from' || t === 'near') && words[i + 1] && !STOP.has(words[i + 1])
          && !sectorsOf(words[i + 1]).length) {
        out.city = titleCase(words[i + 1]); i++; continue;
      }
      if (STOP.has(t) || t.length < 2) continue;
      const sec = sectorsOf(t);
      if (sec.length && !out.sector) { out.sector = sec[0]; continue; }
      if (sec.length && sec.includes(out.sector)) continue;
      rest.push(t);
    }
    out.words = rest;
    return out;
  }

  // ------------------------------------------------------------------- render
  function cardHtml(p, pending) {
    const av = p.avatar
      ? '<img class="uc-net-av" src="' + esc(p.avatar) + '" alt="" loading="lazy">'
      : '<div class="uc-avatar-initials uc-net-av" aria-hidden="true" style="background:oklch(0.9 0.06 ' + p.hue + ');">' + esc(initials(p.name)) + '</div>';
    const programme = p.degree
      ? '<button type="button" class="uc-net-link uc-net-sub" data-act="programme" title="Find others from ' + esc(p.programme || p.degree) + '">' + esc(p.degree) + '</button>'
      : '<span class="uc-net-sub">Programme not set</span>';
    const city = p.city
      ? '<button type="button" class="uc-net-link" data-act="city" aria-label="See ' + esc(p.city) + ' on the map"><span class="iconify" data-icon="ph:map-pin-bold" aria-hidden="true"></span> ' + esc(p.city) + '</button>'
      : '';
    return '<article class="uc-card uc-net-card" data-id="' + esc(p.id) + '" data-name="' + esc(p.name) + '"'
      + ' data-degree="' + esc(p.degree) + '" data-city="' + esc(p.city) + '" data-mentor="' + (p.mentor ? '1' : '0') + '"'
      + ' data-sector="' + esc(p.sectors.join(' ')) + '"' + (p.sample ? ' data-sample="1"' : '') + '>'
      + (p.sample ? '<span class="uc-net-badge" title="Fictional sample profile, not a member">Sample</span>' : '')
      + '<div class="uc-net-top">' + av + '<div style="min-width:0;">'
      + '<button type="button" class="uc-net-name" data-act="view">' + esc(p.name) + '</button>'
      + programme + '</div></div>'
      + '<p class="uc-net-headline">' + (p.headline ? esc(p.headline) : '<span style="color:var(--uc-muted);">No headline yet</span>') + '</p>'
      + '<div class="uc-net-meta">' + city
      + (p.mentor ? '<span class="uc-tag" style="margin:0;">Open to mentoring</span>' : '') + '</div>'
      + '<div class="uc-net-actions">'
      + '<button type="button" class="' + (pending ? 'uc-pill-ghost' : 'uc-pill-ink') + '" data-act="connect" aria-pressed="' + (pending ? 'true' : 'false') + '">'
      + (pending ? 'Pending' : 'Connect') + '</button>'
      + '<button type="button" class="uc-pill-ghost" data-act="message" aria-label="Message ' + esc(p.name) + '">Message</button></div>'
      + '<div class="uc-net-more">'
      + '<button type="button" class="uc-net-link" data-act="view">View profile</button>'
      + '<button type="button" class="uc-net-link" data-act="invite">Invite to a case</button></div>'
      + '</article>';
  }

  // ------------------------------------------------------------- case list
  // The Case Hub keeps its cases inside js/pages/pbl-hub.js (not exposed), so we
  // mirror the sample set by slug here. If that module ever publishes a list as
  // window.UCCases = [{slug, title, sample}], it is used instead.
  const CASES_MIRROR = [
    ['hedging-through-a-rate-shock', 'Hedging an equity portfolio through a sudden rate shock'],
    ['startup-valuation-under-inflation', 'Valuing an early-stage software company when costs inflate'],
    ['churn-with-little-data', 'Predicting churn for a small platform with patchy data'],
    ['reusable-packaging-pilot', 'Designing a reusable-packaging pilot that gives a clear answer'],
    ['choosing-a-second-market', 'Which second market should a B2B software start-up enter?']
  ];
  function loadCases() {
    const ext = Array.isArray(window.UCCases) ? window.UCCases.filter((c) => c && c.slug && c.title) : [];
    if (ext.length) return ext.map((c) => ({ slug: String(c.slug), title: String(c.title), sample: !!c.sample }));
    return CASES_MIRROR.map((c) => ({ slug: c[0], title: c[1], sample: true }));
  }

  // --------------------------------------------------------------- the page
  window.UCPages['network'] = function (root) {
    const UCP = window.UCP;
    const $ = (s) => root.querySelector(s);
    const grid = $('[data-net-grid]');
    if (!grid) return;
    const sampleGrid = $('[data-net-sample-grid]');
    const form = $('[data-net-form]');
    const qInput = $('[data-net-q]');
    const sel = {
      sector: $('[data-net-f="sector"]'), city: $('[data-net-f="city"]'),
      programme: $('[data-net-f="programme"]'), mentor: $('[data-net-f="mentor"]')
    };
    const countEl = $('[data-net-count]');
    const noticeEl = $('[data-net-notice]');
    const emptyEl = $('[data-net-empty]');
    const understoodEl = $('[data-net-understood]');
    const sampleHead = $('[data-net-sample-head]');

    // Samples: read the fictional cards from the partial, then drop the source block.
    const srcBox = $('[data-net-samples]');
    const samples = srcBox ? Array.from(srcBox.querySelectorAll('[data-sample]')).map(personFromSample) : [];
    if (srcBox) srcBox.remove();

    let real = [];
    let words = [];               // free-text keywords left over after parsing
    const me = UCP.user();
    const pendingMap = () => UCP.store('net_connect') || {};

    const visiblePool = () => real.concat(real.length < MAX_SAMPLES_WHEN_REAL ? samples : []);
    const byId = (id) => real.concat(samples).find((p) => p.id === id);

    // Populate city / programme selects from the people we have.
    function fillOptions() {
      const pool = visiblePool();
      const keep = { city: sel.city.value, programme: sel.programme.value };
      const cities = Array.from(new Set(pool.map((p) => p.city).filter(Boolean))).sort();
      const progs = Array.from(new Set(pool.map((p) => p.programme).filter(Boolean))).sort();
      if (keep.city && !cities.includes(keep.city)) cities.push(keep.city);
      if (keep.programme && !progs.includes(keep.programme)) progs.push(keep.programme);
      sel.city.innerHTML = '<option value="">All cities</option>' + cities.map((c) => '<option>' + esc(c) + '</option>').join('');
      sel.programme.innerHTML = '<option value="">All programmes</option>' + progs.map((c) => '<option>' + esc(c) + '</option>').join('');
      sel.city.value = keep.city; sel.programme.value = keep.programme;
    }
    function setSelect(el, v) {
      if (v && !Array.from(el.options).some((o) => o.value === v)) {
        const o = document.createElement('option'); o.textContent = v; o.value = v; el.appendChild(o);
      }
      el.value = v || '';
    }

    function matches(p) {
      const f = { sector: sel.sector.value, city: sel.city.value, programme: sel.programme.value, mentor: sel.mentor.value === '1' };
      if (f.sector && !p.sectors.includes(f.sector)) return false;
      if (f.city && norm(p.city) !== norm(f.city) && !norm(p.location).includes(norm(f.city))) return false;
      if (f.programme && !norm(p.degree).includes(norm(f.programme))) return false;
      if (f.mentor && !p.mentor) return false;
      if (words.length) {
        const hay = norm([p.name, p.headline, p.degree, p.location, p.offer].join(' '));
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    }

    function filtersActive() {
      return !!(sel.sector.value || sel.city.value || sel.programme.value || sel.mentor.value || words.length);
    }

    function syncHash() {
      const p = new URLSearchParams();
      const q = qInput.value.trim();
      if (q) p.set('q', q);
      if (sel.city.value) p.set('city', sel.city.value);
      if (sel.mentor.value === '1') p.set('mentor', '1');
      if (sel.sector.value) p.set('sector', sel.sector.value);
      if (sel.programme.value) p.set('programme', sel.programme.value);
      const qs = p.toString();
      try { history.replaceState(null, '', '#network' + (qs ? '?' + qs : '')); } catch (e) { /* ignore */ }
    }

    function render() {
      if (!grid.isConnected) return;
      const pend = pendingMap();
      const showSamples = real.length < MAX_SAMPLES_WHEN_REAL;
      const r = real.filter(matches);
      const s = showSamples ? samples.filter(matches) : [];
      grid.innerHTML = r.map((p) => cardHtml(p, !!pend[p.id])).join('');
      grid.hidden = !r.length;
      sampleGrid.innerHTML = s.map((p) => cardHtml(p, false)).join('');
      sampleHead.hidden = !s.length;
      emptyEl.hidden = !!(r.length || s.length);
      root.querySelectorAll('[data-net-clear]').forEach((b) => { if (!b.closest('[data-net-empty]')) b.hidden = !filtersActive(); });

      const total = real.length + (showSamples ? samples.length : 0);
      let txt = 'Showing ' + (r.length + s.length) + ' of ' + total;
      if (real.length) txt += ' · ' + r.length + ' member' + (r.length === 1 ? '' : 's');
      if (showSamples) txt += ' · ' + s.length + ' sample' + (s.length === 1 ? '' : 's');
      countEl.textContent = txt;
      renderCities();
      if (window.Iconify) window.Iconify.scan(root);
    }

    function explain(parsed) {
      const bits = [];
      if (parsed.sector) bits.push('Sector: ' + SECTOR_LABEL[parsed.sector]);
      if (parsed.city) bits.push('City: ' + parsed.city);
      if (parsed.programme) bits.push('Programme: ' + parsed.programme);
      if (parsed.mentor) bits.push('Open to mentoring');
      if (parsed.words.length) bits.push('Keywords: ' + parsed.words.join(', '));
      understoodEl.hidden = !bits.length;
      understoodEl.innerHTML = bits.length ? '<strong>Understood as</strong> ' + bits.map(esc).join(' · ') : '';
    }

    function runSearch(text) {
      const pool = real.concat(samples);
      const parsed = parseQuery(text, pool.map((p) => p.city).filter(Boolean), pool.map((p) => p.programme).filter(Boolean));
      sel.sector.value = parsed.sector;
      setSelect(sel.city, parsed.city);
      setSelect(sel.programme, parsed.programme);
      sel.mentor.value = parsed.mentor ? '1' : '';
      words = parsed.words;
      explain(parsed);
      render();
      syncHash();
    }

    function clearAll() {
      qInput.value = ''; words = [];
      Object.values(sel).forEach((s) => { s.value = ''; });
      understoodEl.hidden = true;
      render(); syncHash();
      qInput.focus();
    }

    // City chapters: counts of real members' locations; else sample cities (labelled).
    function renderCities() {
      const box = $('[data-net-cities]');
      const note = $('[data-net-cities-note]');
      if (!box) return;
      const fromReal = real.some((p) => p.city);
      const src = fromReal ? real : samples;
      const counts = {};
      src.forEach((p) => { if (p.city) counts[p.city] = (counts[p.city] || 0) + 1; });
      const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b)).slice(0, 6);
      note.textContent = fromReal ? 'From members’ profile locations' : 'Sample — from the illustrative profiles below';
      if (!top.length) { box.innerHTML = '<p style="margin:0;font-size:13px;color:var(--uc-muted);">No locations yet — add yours in your profile.</p>'; return; }
      const active = norm(sel.city.value);
      box.innerHTML = top.map((c) => {
        const n = counts[c];
        return '<div class="uc-net-city' + (active === norm(c) ? ' is-active' : '') + '">'
          + (fromReal ? '' : '<span class="uc-net-badge">Sample</span>')
          + '<div class="uc-net-city-n uc-serif">' + esc(c) + '</div>'
          + '<div class="uc-net-city-c">' + n + ' ' + (fromReal ? (n === 1 ? 'member' : 'members') : (n === 1 ? 'sample profile' : 'sample profiles')) + '</div>'
          + '<div class="uc-net-city-a">'
          + '<button type="button" class="uc-pill-ink uc-pill-sm" data-city-filter="' + esc(c) + '" aria-pressed="' + (active === norm(c)) + '">Show people</button>'
          + '<button type="button" class="uc-pill-ghost uc-pill-sm" data-city-map="' + esc(c) + '">See on map</button>'
          + '</div></div>';
      }).join('');
    }

    // ------------------------------------------------------------ actions
    function signInGate() {
      if (window.UC && window.UC.openAuth) window.UC.openAuth('signin');
      UCP.toast('Sign in to message members.', 'warn');
    }
    function sampleNote(what) {
      UCP.toast('This is a fictional sample profile — there’s no one to ' + what + '. Real members appear when you’re signed in and the network is online.', 'warn');
    }

    function message(p) {
      if (p.sample) return sampleNote('message');
      if (!UCP.user()) return signInGate();
      if (window.UC && window.UC.openChat) window.UC.openChat(p.id);
    }

    function toggleConnect(p, btn) {
      if (p.sample) return sampleNote('connect with');
      const m = pendingMap();
      if (m[p.id]) {
        delete m[p.id];
        UCP.toast('Removed ' + esc(p.name) + ' from your connect list.');
      } else {
        m[p.id] = Date.now();
        UCP.toast('Saved ' + esc(p.name) + ' to your connect list (on this device only — no request is sent). Message them to reach out.');
      }
      UCP.store('net_connect', m);
      if (btn) {
        const on = !!m[p.id];
        btn.textContent = on ? 'Pending' : 'Connect';
        btn.className = on ? 'uc-pill-ghost' : 'uc-pill-ink';
        btn.setAttribute('aria-pressed', String(on));
      }
    }

    function viewProfile(p) {
      const av = p.avatar
        ? '<img class="uc-net-av" src="' + esc(p.avatar) + '" alt="">'
        : '<div class="uc-avatar-initials uc-net-av" aria-hidden="true" style="background:oklch(0.9 0.06 ' + p.hue + ');">' + esc(initials(p.name)) + '</div>';
      const row = (k, v) => '<div class="uc-net-dl-r"><dt>' + k + '</dt><dd>' + v + '</dd></div>';
      const body = '<div class="uc-net-dlg">'
        + '<div class="uc-net-top">' + av + '<div><div style="font-size:17px;font-weight:700;color:var(--uc-ink);">' + esc(p.name)
        + (p.sample ? ' <span class="uc-net-badge" style="position:static;">Sample</span>' : '') + '</div>'
        + '<div style="font-size:13px;color:var(--uc-ink-2);">' + (p.headline ? esc(p.headline) : 'No headline yet') + '</div></div></div>'
        + '<dl class="uc-net-dl">'
        + row('Programme', p.degree ? esc(p.degree) : '—')
        + row('City', p.location ? esc(p.location) : '—')
        + row('Mentoring', p.mentor ? ('Open to mentoring' + (p.offer ? ' — ' + esc(p.offer) : '')) : 'Not offering mentoring')
        + (p.linkedin ? row('LinkedIn', '<a href="' + esc(p.linkedin) + '" target="_blank" rel="noopener noreferrer">View LinkedIn profile ↗</a>') : '')
        + '</dl>'
        + (p.sample ? '<p style="margin:12px 0 0;font-size:12px;color:var(--uc-muted);">Fictional sample profile used to illustrate the directory. Not a member.</p>' : '')
        + '</div>';
      const actions = [{ label: 'Message', primary: true, onClick: (close) => { close(); message(p); } }];
      if (p.city) actions.push({ label: 'See on map', onClick: (close) => { close(); UCP.go('map', { city: p.city }); } });
      if (p.mentor) actions.push({ label: 'Request mentoring', onClick: (close) => { close(); UCP.go('mentoring', { q: p.name }); } });
      actions.push({ label: 'Close' });
      UCP.dialog({ title: p.name, body, actions });
    }

    function invite(p) {
      const cases = loadCases();
      const mark = 'uc-net-inv-' + Date.now();
      const first = p.name.split(/\s+/)[0];
      const body = '<div id="' + mark + '">'
        + '<p style="margin:0 0 12px;">' + (p.sample
          ? 'This is a fictional sample profile, so there is no one to invite. You can still open a case:'
          : 'Invite ' + esc(first) + ' to think along on a case. Open it, or draft a message with the case link — you press Send yourself.')
        + '</p><ul class="uc-net-cases">'
        + cases.map((c) => '<li><span class="uc-net-case-t">' + esc(c.title)
          + (c.sample ? ' <span class="uc-net-badge" style="position:static;">Sample case</span>' : '') + '</span><span class="uc-net-case-a">'
          + '<button type="button" class="uc-pill-ghost uc-pill-sm" data-case-open="' + esc(c.slug) + '">Open case</button>'
          + (p.sample ? '' : '<button type="button" class="uc-pill-ink uc-pill-sm" data-case-send="' + esc(c.slug) + '">Draft in chat</button>')
          + '</span></li>').join('')
        + '</ul></div>';
      const close = UCP.dialog({ title: 'Invite to a case', body, actions: [{ label: 'Close' }] });
      const host = document.getElementById(mark);
      if (!host) return;
      host.addEventListener('click', (e) => {
        const open = e.target.closest('[data-case-open]');
        const send = e.target.closest('[data-case-send]');
        if (open) { close(); UCP.go('pbl-hub', { id: open.dataset.caseOpen }); }
        if (send) {
          const c = cases.find((x) => x.slug === send.dataset.caseSend);
          close();
          if (!UCP.user()) return signInGate();
          const link = location.origin + location.pathname + '#pbl-hub?id=' + encodeURIComponent(c.slug);
          message(p);
          draftInChat(p.id, 'Hi ' + first + ', I thought of you for this case on UniCircle: "' + c.title + '" — ' + link);
        }
      });
    }

    // Pre-fill the chat composer once the drawer has selected the peer (user still presses Send).
    function draftInChat(peerId, text) {
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        const formEl = document.getElementById('uc-msg-form');
        const inp = document.getElementById('uc-msg-input');
        const peer = window.UC && window.UC.state && window.UC.state.chatPeer;
        if (formEl && !formEl.hidden && inp && peer && peer.id === peerId) {
          clearInterval(t);
          if (!inp.value.trim()) inp.value = text;
          inp.focus();
          UCP.toast('Case link drafted in chat — press Send when you’re ready.');
        } else if (tries > 30) clearInterval(t);
      }, 150);
    }

    // ---------------------------------------------------------------- wiring
    function onCardClick(e) {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const card = b.closest('.uc-net-card');
      const p = card && byId(card.dataset.id);
      if (!p) return;
      const act = b.dataset.act;
      if (act === 'message') message(p);
      else if (act === 'connect') toggleConnect(p, b);
      else if (act === 'view') viewProfile(p);
      else if (act === 'invite') invite(p);
      else if (act === 'city' && p.city) UCP.go('map', { city: p.city });
      else if (act === 'programme') UCP.go('network', { q: p.programme || p.degree });
    }
    grid.addEventListener('click', onCardClick);
    sampleGrid.addEventListener('click', onCardClick);

    form.addEventListener('submit', (e) => { e.preventDefault(); runSearch(qInput.value); });
    root.querySelectorAll('[data-net-chip]').forEach((c) => c.addEventListener('click', () => {
      qInput.value = c.textContent.trim().replace(/^"|"$/g, '');
      runSearch(qInput.value);
    }));
    Object.values(sel).forEach((s) => s.addEventListener('change', () => { understoodEl.hidden = true; render(); syncHash(); }));
    root.querySelectorAll('[data-net-clear]').forEach((b) => b.addEventListener('click', clearAll));
    $('[data-net-cities]').addEventListener('click', (e) => {
      const f = e.target.closest('[data-city-filter]');
      const m = e.target.closest('[data-city-map]');
      if (m) UCP.go('map', { city: m.dataset.cityMap });
      if (f) {
        const c = f.dataset.cityFilter;
        setSelect(sel.city, norm(sel.city.value) === norm(c) ? '' : c);
        render(); syncHash();
        grid.closest('section').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // Apply #network?q=…&city=…&mentor=1&sector=…&programme=…
    function applyParams() {
      const ps = (UCP.params && UCP.params()) || new URLSearchParams();
      const q = ps.get('q') || '';
      qInput.value = q;
      if (q) runSearch(q); else { words = []; understoodEl.hidden = true; }
      if (ps.get('city')) setSelect(sel.city, ps.get('city'));
      if (ps.get('mentor') === '1') sel.mentor.value = '1';
      if (ps.get('sector') && SECTOR_LABEL[ps.get('sector')]) sel.sector.value = ps.get('sector');
      if (ps.get('programme')) setSelect(sel.programme, ps.get('programme'));
      render();
    }

    function notice(msg) { noticeEl.hidden = !msg; noticeEl.textContent = msg || ''; }

    // ------------------------------------------------------------- data load
    fillOptions();
    applyParams();

    if (!me) {
      notice('You’re signed out — showing sample profiles only. Sign in to search real members.');
      return;
    }
    if (!UCP.online()) {
      notice('The network is offline right now — showing sample profiles only.');
      return;
    }
    notice('Loading members…');
    UCP.api('GET', '/api/collections/users/records?perPage=60&sort=-created'
      + '&fields=' + encodeURIComponent('id,collectionId,name,headline,location,degree,mentor,mentor_offer,avatar,linkedin_url'))
      .then((r) => {
        if (!grid.isConnected) return;
        real = (r.items || []).filter((u) => u.id !== me.id).map(personFromUser);
        notice(real.length
          ? (real.length < MAX_SAMPLES_WHEN_REAL ? 'Your circle is still small — sample profiles are shown below the members.' : '')
          : 'No other members yet — the profiles below are samples. Invite classmates to fill the directory.');
        fillOptions();
        applyParams();
      })
      .catch(() => {
        if (!grid.isConnected) return;
        notice('Couldn’t load members right now — showing sample profiles only.');
      });
  };
})();
