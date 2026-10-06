/* UniCircle page module: #events — see js/pages/_shared.js for the contract.

   Events are curated SAMPLE content in components/events.html (the backend has
   no events collection). Everything here is honest, per-viewer behaviour:
     - RSVP toggle         → UCP.store('events_rsvp')  (this device only)
     - Details dialog      → date, place, description, .ics download (client-side Blob)
     - City / host links   → #map?city=… / #network?q=…
     - Filter chips        → All / This month / Going / per city
   Hash params honoured: #events?id=<slug>  #events?city=<City>  #events?q=<text>
   Hashes emitted:       #map?city=<City>   #network?q=<host>   #network?city=<City>
                         #events?id=… / ?city=… / ?q=… (replaceState, no re-render) */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  const RSVP_KEY = 'events_rsvp';
  const CONTACT = 'hello@unicircle.eu';

  const UCP = () => window.UCP || {};
  const esc = (s) => (UCP().esc ? UCP().esc(s) : String(s == null ? '' : s));
  const toast = (m, k) => UCP().toast && UCP().toast(m, k);

  const slugify = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  function readList(key) {
    const v = UCP().store ? UCP().store(key) : null;
    return Array.isArray(v) ? v : [];
  }

  // Replace the current hash without firing hashchange (no page re-render).
  function setHashParams(params) {
    const qs = new URLSearchParams();
    Object.keys(params).forEach((k) => { if (params[k]) qs.set(k, params[k]); });
    const h = '#events' + (qs.toString() ? '?' + qs.toString() : '');
    try { history.replaceState(null, '', h); } catch (e) { /* file:// or sandbox */ }
  }

  function fmtDate(iso, tz, opts) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    try { return new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: tz || undefined }, opts)).format(d); }
    catch (e) { return d.toUTCString(); }
  }

  /* ---------- .ics ---------- */
  const icsStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const icsText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
  function icsFold(line) {           // RFC 5545: lines ≤ 75 octets (approximate by chars)
    const out = [];
    while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); }
    out.push(line);
    return out.join('\r\n');
  }
  function downloadIcs(ev) {
    const start = new Date(ev.start);
    if (isNaN(start)) { toast('This event has no valid date to export.', 'warn'); return; }
    const end = !isNaN(new Date(ev.end)) ? new Date(ev.end) : new Date(start.getTime() + 2 * 3600e3);
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UniCircle//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + ev.id + '@unicircle.eu',
      'DTSTAMP:' + icsStamp(new Date()),
      'DTSTART:' + icsStamp(start),
      'DTEND:' + icsStamp(end),
      'SUMMARY:' + icsText(ev.title),
      'LOCATION:' + icsText(ev.place),
      'DESCRIPTION:' + icsText(ev.desc + (ev.desc ? '\n\n' : '') + 'Hosted by ' + ev.host
        + '. Sample listing on UniCircle — check with the host before travelling.'),
      'END:VEVENT', 'END:VCALENDAR'
    ].map(icsFold).join('\r\n') + '\r\n';
    try {
      const url = URL.createObjectURL(new Blob([lines], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = (ev.id || 'event') + '.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast('Calendar file downloaded — open it to add <b>' + esc(ev.title) + '</b>.');
    } catch (e) {
      toast('Your browser blocked the calendar download.', 'warn');
    }
  }

  /* ---------- mailto ---------- */
  function openMailto(subject, body) {
    const a = document.createElement('a');
    a.href = 'mailto:' + CONTACT + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    document.body.appendChild(a); a.click(); a.remove();
  }

  function suggestDialog(prefillCity) {
    const D = UCP().dialog;
    if (!D) return;
    const u = UCP().user ? UCP().user() : null;
    D({
      title: 'Suggest an event',
      body: '<p style="margin:0 0 12px;">Pitch a meetup, talk or reunion. This opens a pre-filled email to '
        + '<b>' + esc(CONTACT) + '</b> in your mail app — nothing is sent until you press send there.</p>'
        + '<div class="uc-ej-form">'
        + '<label class="uc-ej-field"><span>What is it?</span><input type="text" name="ev-title" maxlength="120" placeholder="e.g. Rotterdam chapter drinks"></label>'
        + '<label class="uc-ej-field"><span>City (or “Online”)</span><input type="text" name="ev-city" maxlength="60" value="' + esc(prefillCity || '') + '"></label>'
        + '<label class="uc-ej-field"><span>Preferred date</span><input type="date" name="ev-date"></label>'
        + '<label class="uc-ej-field"><span>Anything else?</span><textarea name="ev-notes" rows="3" maxlength="1500" placeholder="Format, who it is for, whether you can host…"></textarea></label>'
        + '</div>',
      actions: [
        { label: 'Cancel' },
        {
          label: 'Open email', primary: true,
          onClick: (close, d) => {
            const v = (n) => ((d.querySelector('[name="' + n + '"]') || {}).value || '').trim();
            const title = v('ev-title');
            if (!title) { const f = d.querySelector('[name="ev-title"]'); f && f.focus(); toast('Give the event a short name first.', 'warn'); return; }
            openMailto('Event suggestion: ' + title, [
              'Event: ' + title,
              'City: ' + (v('ev-city') || '—'),
              'Preferred date: ' + (v('ev-date') || '—'),
              '', v('ev-notes'), '',
              u && u.name ? '— ' + u.name : ''
            ].join('\n'));
            close();
          }
        }
      ]
    });
  }

  window.UCPages['events'] = function (root) {
    if (!root) return;
    const page = root.querySelector('.uc-ev-page') || root;
    const cards = Array.from(page.querySelectorAll('[data-uc-event]'));
    if (!cards.length) return;
    const G = (p, params) => UCP().go && UCP().go(p, params);
    const now = Date.now();

    const evOf = (card) => ({
      id: card.dataset.id || slugify((card.querySelector('.uc-ev-title') || {}).textContent),
      title: ((card.querySelector('.uc-ev-title') || {}).textContent || 'Event').replace(/\s+/g, ' ').trim(),
      city: card.dataset.city || '',
      start: card.dataset.start || '',
      end: card.dataset.end || '',
      tz: card.dataset.tz || '',
      host: card.dataset.host || '',
      place: card.dataset.place || card.dataset.city || '',
      desc: ((card.querySelector('.uc-ev-desc') || {}).textContent || '').trim()
    });
    cards.forEach((c) => { if (!c.dataset.id) c.dataset.id = evOf(c).id; c.setAttribute('tabindex', '-1'); });
    const byId = (id) => cards.find((c) => c.dataset.id === id);
    const isPast = (card) => { const t = Date.parse(card.dataset.start); return !isNaN(t) && t < now; };

    /* ---------- RSVP ---------- */
    let rsvps = readList(RSVP_KEY);
    function paintRsvp(card) {
      const btn = card.querySelector('[data-ev-rsvp]');
      if (!btn) return;
      const ev = evOf(card);
      if (isPast(card)) {
        btn.disabled = true; btn.textContent = 'Ended'; btn.setAttribute('aria-pressed', 'false');
        return;
      }
      const on = rsvps.indexOf(ev.id) >= 0;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-on', on);
      btn.innerHTML = on ? '<span class="iconify" data-icon="ph:check-bold" aria-hidden="true"></span>&nbsp;Going' : 'RSVP';
      btn.setAttribute('aria-label', (on ? 'Going to ' : 'RSVP to ') + ev.title);
      if (window.Iconify && on) window.Iconify.scan(btn);
    }
    function toggleRsvp(card, force) {
      const ev = evOf(card);
      if (isPast(card)) return;
      const on = rsvps.indexOf(ev.id) >= 0;
      const next = force == null ? !on : !!force;
      if (next === on) return;
      rsvps = next ? rsvps.concat(ev.id) : rsvps.filter((x) => x !== ev.id);
      UCP().store && UCP().store(RSVP_KEY, rsvps);
      paintRsvp(card);
      toast(next
        ? 'You’re going to <b>' + esc(ev.title) + '</b> — saved on this device only; hosts can’t see RSVPs yet.'
        : 'RSVP removed for <b>' + esc(ev.title) + '</b>.');
      if (activeFilter === 'going') applyFilter();
    }

    /* ---------- Details dialog ---------- */
    function openDetails(card) {
      const D = UCP().dialog;
      if (!D) return;
      const ev = evOf(card);
      const dateStr = fmtDate(ev.start, ev.tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const t1 = fmtDate(ev.start, ev.tz, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
      const t2 = ev.end ? fmtDate(ev.end, ev.tz, { hour: '2-digit', minute: '2-digit' }) : '';
      const going = rsvps.indexOf(ev.id) >= 0;
      const past = isPast(card);
      const online = /^online$/i.test(ev.city);
      const body =
        '<p class="uc-ej-sample-note">Sample listing — curated example, not a confirmed event.</p>'
        + '<dl class="uc-ej-dl">'
        + '<dt>When</dt><dd>' + esc(dateStr) + (t1 ? ' · ' + esc(t1) + (t2 ? '–' + esc(t2) : '') : '') + '</dd>'
        + '<dt>Where</dt><dd>' + esc(ev.place) + (online ? '' : ' <button type="button" class="uc-ej-link" data-d-map>Map</button>') + '</dd>'
        + '<dt>Host</dt><dd><button type="button" class="uc-ej-link" data-d-host>' + esc(ev.host || '—') + '</button></dd>'
        + '</dl>'
        + (ev.desc ? '<p style="margin:12px 0 0;">' + esc(ev.desc) + '</p>' : '')
        + '<div class="uc-ej-callout"><b>Who else is going?</b><br>Attendee lists appear once RSVPs are live. '
        + (online ? '<button type="button" class="uc-ej-link" data-d-people>Browse the network</button> in the meantime.'
          : '<button type="button" class="uc-ej-link" data-d-people>See alumni in ' + esc(ev.city) + '</button> in the meantime.')
        + '</div>';
      const close = D({
        title: ev.title,
        body: body,
        actions: [
          { label: 'Add to calendar', onClick: () => downloadIcs(ev) },
          past ? { label: 'Close' } : {
            label: going ? 'Cancel RSVP' : 'RSVP', primary: true,
            onClick: (c) => { toggleRsvp(card); c(); }
          }
        ]
      });
      const d = document.querySelector('dialog.uc-dialog:last-of-type');
      if (!d) return;
      const wire = (sel, fn) => { const b = d.querySelector(sel); if (b) b.addEventListener('click', () => { close(); fn(); }); };
      wire('[data-d-map]', () => G('map', { city: ev.city }));
      wire('[data-d-host]', () => G('network', { q: ev.host }));
      wire('[data-d-people]', () => G('network', online ? {} : { city: ev.city }));
    }

    /* ---------- Filters ---------- */
    const chipsBox = page.querySelector('[data-ev-chips]');
    const status = page.querySelector('[data-ev-status]');
    const empty = page.querySelector('[data-ev-empty]');
    const emptyMap = page.querySelector('[data-ev-empty-map]');
    const searchInput = page.querySelector('[data-uc-search] input');
    const cities = [];
    cards.forEach((c) => { const k = c.dataset.city; if (k && cities.indexOf(k) < 0) cities.push(k); });
    cities.sort((a, b) => (a === 'Online') - (b === 'Online') || a.localeCompare(b));
    let activeFilter = 'all';      // 'all' | 'month' | 'going' | 'city:<City>'
    let query = '';
    let pendingCity = '';          // a ?city= with no matching event

    const filters = [['all', 'All'], ['month', 'This month'], ['going', 'Going']]
      .concat(cities.map((c) => ['city:' + c, c]));
    if (chipsBox) {
      chipsBox.innerHTML = filters.map((f) =>
        '<button type="button" class="uc-chip uc-ej-chip" data-f="' + esc(f[0]) + '" aria-pressed="false">' + esc(f[1]) + '</button>').join('');
      chipsBox.addEventListener('click', (e) => {
        const b = e.target.closest('[data-f]');
        if (!b) return;
        pendingCity = '';
        activeFilter = b.dataset.f;
        applyFilter(true);
      });
    }

    function matches(card) {
      if (query) {
        const hay = (evOf(card).title + ' ' + card.dataset.city + ' ' + card.dataset.host + ' '
          + ((card.querySelector('.uc-ev-desc') || {}).textContent || '')).toLowerCase();
        if (hay.indexOf(query.toLowerCase()) < 0) return false;
      }
      if (pendingCity) return false;
      if (activeFilter === 'all') return true;
      if (activeFilter === 'going') return rsvps.indexOf(card.dataset.id) >= 0;
      if (activeFilter === 'month') {
        const d = new Date(card.dataset.start), n = new Date();
        return !isNaN(d) && d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
      }
      if (activeFilter.indexOf('city:') === 0) return card.dataset.city === activeFilter.slice(5);
      return true;
    }

    function applyFilter(writeHash) {
      let shown = 0;
      cards.forEach((c) => { const ok = matches(c); c.hidden = !ok; if (ok) shown++; });
      if (chipsBox) chipsBox.querySelectorAll('[data-f]').forEach((b) => {
        const on = b.dataset.f === activeFilter && !pendingCity;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.classList.toggle('active', on);
      });
      const cityName = pendingCity || (activeFilter.indexOf('city:') === 0 ? activeFilter.slice(5) : '');
      if (empty) empty.hidden = shown > 0;
      if (emptyMap) {
        const showMap = !shown && cityName && !/^online$/i.test(cityName);
        emptyMap.hidden = !showMap;
        emptyMap.dataset.city = cityName;
        if (showMap) emptyMap.textContent = 'See alumni in ' + cityName + ' on the map';
      }
      if (status) {
        const label = pendingCity ? 'in ' + pendingCity
          : activeFilter === 'month' ? 'this month'
          : activeFilter === 'going' ? 'you are going to'
          : cityName ? 'in ' + cityName : '';
        status.textContent = (activeFilter === 'all' && !query && !pendingCity) ? ''
          : shown + ' event' + (shown === 1 ? '' : 's') + (label ? ' ' + label : '') + (query ? ' matching “' + query + '”' : '');
      }
      if (writeHash) setHashParams({ city: cityName, q: query });
    }

    /* ---------- Search (local filter instead of the shell's network jump) ---------- */
    const form = page.querySelector('[data-uc-search]');
    if (form) {
      // Capture on the (fresh-per-render) page wrapper runs before the shell's
      // submit listener on the form, so search filters here instead of jumping to #network.
      page.addEventListener('submit', (e) => {
        if (e.target !== form) return;
        e.preventDefault(); e.stopPropagation();
        query = (searchInput && searchInput.value || '').trim();
        applyFilter(true);
      }, true);
      if (searchInput) searchInput.addEventListener('input', () => {
        query = searchInput.value.trim();
        applyFilter(false);
      });
    }

    /* ---------- Per-card wiring ---------- */
    cards.forEach((card) => {
      const ev = evOf(card);
      paintRsvp(card);
      if (isPast(card)) card.classList.add('is-past');
      const r = card.querySelector('[data-ev-rsvp]');
      if (r) r.addEventListener('click', () => toggleRsvp(card));
      const d = card.querySelector('[data-ev-details]');
      if (d) { d.addEventListener('click', () => openDetails(card)); d.setAttribute('aria-label', 'Details: ' + ev.title); }
      card.querySelectorAll('[data-ev-city]').forEach((b) => {
        b.setAttribute('aria-label', 'Show alumni in ' + ev.city + ' on the map');
        b.addEventListener('click', () => G('map', { city: ev.city }));
      });
      card.querySelectorAll('[data-ev-host]').forEach((b) => {
        b.setAttribute('aria-label', 'Find ' + ev.host + ' in the network');
        b.addEventListener('click', () => G('network', { q: ev.host }));
      });
    });

    page.querySelectorAll('[data-ev-suggest]').forEach((b) =>
      b.addEventListener('click', () => suggestDialog(pendingCity || (activeFilter.indexOf('city:') === 0 ? activeFilter.slice(5) : ''))));
    const clearBtn = page.querySelector('[data-ev-clear]');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      activeFilter = 'all'; pendingCity = ''; query = '';
      if (searchInput) searchInput.value = '';
      applyFilter(true);
    });
    if (emptyMap) emptyMap.addEventListener('click', () => G('map', { city: emptyMap.dataset.city || '' }));

    /* ---------- Deep links ---------- */
    const params = UCP().params ? UCP().params() : new URLSearchParams();
    const pCity = (params.get('city') || '').trim();
    const pQ = (params.get('q') || '').trim();
    const pId = (params.get('id') || '').trim();
    if (pQ) { query = pQ; if (searchInput) searchInput.value = pQ; }
    if (pCity) {
      const hit = cities.find((c) => c.toLowerCase() === pCity.toLowerCase());
      if (hit) activeFilter = 'city:' + hit; else pendingCity = pCity;
    }
    applyFilter(false);

    if (pId) {
      const card = byId(pId) || byId(slugify(pId));
      if (!card) {
        toast('That event isn’t listed any more.', 'warn');
      } else {
        if (card.hidden) { activeFilter = 'all'; pendingCity = ''; query = ''; if (searchInput) searchInput.value = ''; applyFilter(false); }
        // Wait for the view transition / layout before scrolling + opening.
        setTimeout(() => {
          if (!document.contains(card)) return;
          const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
          card.classList.add('is-highlight');
          setTimeout(() => card.classList.remove('is-highlight'), 2600);
          openDetails(card);
        }, 120);
      }
    }
  };
})();
