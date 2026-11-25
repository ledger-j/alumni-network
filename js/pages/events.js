/* UniCircle page module: #events — see js/pages/_shared.js for the contract.

   Real events come from the `events` collection (members only). While there are
   none, the curated SAMPLE cards in components/events.html stay visible (labelled).
   Real RSVPs are server rows (`rsvps`); only going_count is shown, never names.
   window.UCEvents (registered when this script loads, usable from any page):
     openCreate({date, city, lat, lng}) · eventsOn('YYYY-MM-DD') · rsvp(eventId)
   Sample-only behaviour (per viewer, this device):
     - RSVP toggle         → UCP.store('events_rsvp')
   Both modes:
     - Details dialog      → date, place, description, .ics download (client-side Blob)
     - City / host links   → #map?city=… / #network?q=…
     - Filter chips        → All / This month / Going / per city
   Hash params honoured: #events?id=<id|slug>  ?city=<City>  ?q=<text>  ?day=YYYY-MM-DD
   Hashes emitted:       #map?city=<City>   #network?q=<host>   #network?city=<City>
                         #events?id=… / ?city=… / ?q=… (replaceState, no re-render) */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  const RSVP_KEY = 'events_rsvp';
  const CONTACT = 'hello@unicircle.eu';
  const VERIFY_MSG = 'Sign in with the magic link to verify your email before creating events.';
  const HUES = [25, 305, 185, 235, 145];
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  const UCP = () => window.UCP || {};
  const esc = (s) => (UCP().esc ? UCP().esc(s) : String(s == null ? '' : s));
  const toast = (m, k) => UCP().toast && UCP().toast(m, k);
  const toastErr = (e, fallback) => toast(esc((e && e.message) || fallback || 'Something went wrong.'), 'warn');
  const meUser = () => (UCP().user ? UCP().user() : null);
  const hasApi = () => !!(window.UC && window.UC.api);

  const slugify = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const parseTs = (s) => (s ? Date.parse(String(s).replace(' ', 'T')) : NaN);   // PocketBase: "2026-12-12 17:00:00.000Z"
  const normIso = (s) => { const t = parseTs(s); return isNaN(t) ? '' : new Date(t).toISOString(); };
  const pbStamp = (d) => d.toISOString().replace('T', ' ');
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const localDay = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

  /* ====================== server data (page-independent) ====================== */
  const evCache = {};                 // id -> event record (with expand.host)
  let myRsvps = null;                 // Map eventId -> rsvp row id (own rows only)

  async function loadMyRsvps(force) {
    if (myRsvps && !force) return myRsvps;
    const m = new Map();
    if (hasApi() && meUser()) {
      try {
        const r = await window.UC.api('GET', '/api/collections/rsvps/records?perPage=200&fields=id,event');
        (r.items || []).forEach((x) => { if (x && x.event) m.set(x.event, x.id); });
      } catch (e) { /* offline: treat as none */ }
    }
    myRsvps = m;
    return m;
  }
  async function refreshEvent(id) {
    try {
      const r = await window.UC.api('GET', '/api/collections/events/records/' + encodeURIComponent(id) + '?expand=host');
      if (r && r.id) evCache[r.id] = r;
      return r;
    } catch (e) { return evCache[id] || null; }
  }
  async function fetchEvents(filter) {
    const q = '?filter=' + encodeURIComponent(filter) + '&sort=start&perPage=100&expand=host';
    const r = await window.UC.api('GET', '/api/collections/events/records' + q);
    const items = (r.items || []).filter((x) => x && x.id);
    items.forEach((x) => { evCache[x.id] = x; });
    return items;
  }
  function dayRange(dateISO) {
    if (!DAY_RE.test(String(dateISO || ''))) return null;
    const p = dateISO.split('-').map(Number);
    return [new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0), new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999)];
  }
  async function eventsOn(dateISO) {
    const r = dayRange(dateISO);
    if (!r || !hasApi() || !meUser()) return [];
    try { return await fetchEvents('start>="' + pbStamp(r[0]) + '" && start<="' + pbStamp(r[1]) + '"'); }
    catch (e) { return []; }
  }
  function changed(id, kind) {
    try { window.dispatchEvent(new CustomEvent('uc:events-changed', { detail: { id: id || '', kind: kind || 'list' } })); } catch (e) { /* old browser */ }
  }
  // Toggle my RSVP; resolves to the new state (true = going). Server errors are toasted.
  async function rsvp(eventId) {
    if (!hasApi() || !meUser()) { toast('Sign in to RSVP.', 'warn'); return false; }
    const map = await loadMyRsvps();
    const had = map.get(eventId);
    try {
      if (had) {
        await window.UC.api('DELETE', '/api/collections/rsvps/records/' + encodeURIComponent(had));
        map.delete(eventId);
      } else {
        const row = await window.UC.api('POST', '/api/collections/rsvps/records', { event: eventId, user: meUser().id });
        map.set(eventId, row && row.id);
      }
    } catch (e) {
      toastErr(e, 'Could not update your RSVP.');
      const fresh = await loadMyRsvps(true);
      return fresh.has(eventId);
    }
    await refreshEvent(eventId);       // going_count is recomputed by the server
    changed(eventId, 'rsvp');
    return map.has(eventId);
  }

  /* ====================== create sheet (own <dialog>, built lazily) ====================== */
  function openCreate(opts) {
    opts = opts || {};
    if (!meUser()) { toast('Sign in with the magic link to create an event.', 'warn'); return; }
    const old = document.querySelector('dialog.uc-ev-sheet');
    if (old) { try { old.close(); } catch (e) { /* closed */ } old.remove(); }
    const lat = Number(opts.lat), lng = Number(opts.lng);
    const hasPos = opts.lat != null && opts.lng != null && opts.lat !== '' && opts.lng !== '' && isFinite(lat) && isFinite(lng);
    const now = new Date();
    const max = new Date(now.getFullYear(), now.getMonth() + 12, now.getDate());
    const d = document.createElement('dialog');
    d.className = 'uc-dialog uc-ev-sheet';
    d.setAttribute('aria-labelledby', 'ucev-sheet-title');
    d.innerHTML =
      '<form class="uc-ev-sheet-form" novalidate>'
      + '<div class="uc-dialog-head"><h3 class="uc-serif" id="ucev-sheet-title">Create an event</h3>'
      + '<button type="button" class="uc-dialog-x" aria-label="Close" data-sh-x>×</button></div>'
      + '<div class="uc-dialog-body"><div class="uc-ej-form">'
      + '<label class="uc-ej-field"><span>Title</span><input type="text" name="title" maxlength="120" required autocomplete="off"></label>'
      + '<label class="uc-ej-field"><span>Description <small class="uc-ev-count" data-sh-count>0 / 2000</small></span>'
      + '<textarea name="description" rows="4" maxlength="2000"></textarea></label>'
      + '<label class="uc-ej-field"><span>Date</span><input type="date" name="date" required min="' + esc(localDay(now))
      + '" max="' + esc(localDay(max)) + '" value="' + esc(DAY_RE.test(String(opts.date || '')) ? opts.date : '') + '"></label>'
      + '<div class="uc-ej-form-2">'
      + '<label class="uc-ej-field"><span>Start time</span><input type="time" name="start" required></label>'
      + '<label class="uc-ej-field"><span>End time (optional)</span><input type="time" name="end"></label></div>'
      + '<div class="uc-ej-form-2">'
      + '<label class="uc-ej-field"><span>City</span><input type="text" name="city" maxlength="80" autocomplete="off" value="' + esc(opts.city || '') + '"></label>'
      + '<label class="uc-ej-field"><span>Place</span><input type="text" name="place" maxlength="120" autocomplete="off" aria-describedby="ucev-place-hint"></label></div>'
      + '<p class="uc-ej-hint" id="ucev-place-hint">Place: a public venue, not a home address.'
      + (hasPos ? ' The map position you picked is used (shown approximately).' : '') + '</p>'
      + '<p class="uc-ej-hint">Up to 3 events a day, within the next 12 months, max 14 days long. Times use your own time zone.</p>'
      + '<p class="uc-ej-hint uc-ev-err" role="alert" data-sh-err hidden></p>'
      + '</div></div>'
      + '<div class="uc-dialog-actions"><button type="button" class="uc-btn-ghost" data-sh-x>Cancel</button>'
      + '<button type="submit" class="uc-btn-dark" data-sh-go>Create event</button></div>'
      + '</form>';
    const close = () => { try { d.close(); } catch (e) { /* closed */ } d.remove(); };
    const f = d.querySelector('form');
    const q = (n) => f.elements[n];
    const err = d.querySelector('[data-sh-err]');
    const fail = (msg, field) => { err.textContent = msg; err.hidden = false; if (field) field.focus(); };
    d.querySelectorAll('[data-sh-x]').forEach((b) => b.addEventListener('click', close));
    d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    d.addEventListener('click', (e) => { if (e.target === d) close(); });
    q('description').addEventListener('input', () => {
      d.querySelector('[data-sh-count]').textContent = q('description').value.length + ' / 2000';
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const title = q('title').value.trim();
      if (!title) return fail('Give the event a title.', q('title'));
      if (!q('date').value) return fail('Pick a date.', q('date'));
      if (!q('start').value) return fail('Pick a start time.', q('start'));
      const start = new Date(q('date').value + 'T' + q('start').value);   // browser time zone
      if (isNaN(start)) return fail('That date or time is not valid.', q('date'));
      if (start.getTime() < Date.now()) return fail('Pick a start in the future.', q('date'));
      let end = null;
      if (q('end').value) {
        end = new Date(q('date').value + 'T' + q('end').value);
        if (isNaN(end) || end.getTime() <= start.getTime()) return fail('The end time must be after the start.', q('end'));
      }
      const body = {
        title: title, description: q('description').value.trim(),
        start: start.toISOString(), city: q('city').value.trim(), place: q('place').value.trim(),
        host: meUser().id
      };
      if (end) body.end = end.toISOString();
      if (hasPos) { body.lat = lat; body.lng = lng; }
      const go = d.querySelector('[data-sh-go]');
      go.disabled = true;
      try {
        const rec = await window.UC.api('POST', '/api/collections/events/records', body);
        if (rec && rec.id) evCache[rec.id] = rec;
        toast('Event created: <b>' + esc(title) + '</b>.');
        close();
        changed(rec && rec.id);
      } catch (x) {
        go.disabled = false;
        const m = String((x && x.message) || '');
        const unverified = /verif/i.test(m) || /verif/i.test(JSON.stringify((x && x.data) || {}));
        if (unverified) toast(esc(VERIFY_MSG), 'warn'); else toastErr(x, 'Could not create the event.');
        fail(unverified ? VERIFY_MSG : (m || 'Could not create the event.'));
      }
    });
    document.body.appendChild(d);
    d.showModal();
    q('title').focus();
  }

  window.UCEvents = { openCreate: openCreate, eventsOn: eventsOn, rsvp: rsvp };

  /* ====================== shared helpers ====================== */
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

  function fmtDate(iso, tz, opts, locale) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    try { return new Intl.DateTimeFormat(locale || 'en-GB', Object.assign({ timeZone: tz || undefined }, opts)).format(d); }
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
        + (ev.real ? '. Event on UniCircle.' : '. Sample listing on UniCircle — check with the host before travelling.')),
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

  /* ---------- mailto (sample mode only) ---------- */
  function openMailto(subject, body) {
    const a = document.createElement('a');
    a.href = 'mailto:' + CONTACT + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    document.body.appendChild(a); a.click(); a.remove();
  }

  function suggestDialog(prefillCity) {
    const D = UCP().dialog;
    if (!D) return;
    const u = meUser();
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

  /* ====================== the page ====================== */
  window.UCPages['events'] = function (root) {
    if (!root) return;
    const page = root.querySelector('.uc-ev-page') || root;
    const G = (p, params) => UCP().go && UCP().go(p, params);
    const sampleCards = Array.from(page.querySelectorAll('[data-uc-event]'));
    const realBox = page.querySelector('[data-ev-real]');
    const firstBox = page.querySelector('[data-ev-first]');
    const sampleOnly = Array.from(page.querySelectorAll('[data-ev-sample-only]'));
    const realNote = page.querySelector('[data-ev-real-note]');

    let realMode = false;
    let cards = sampleCards.slice();
    const realById = {};            // id -> normalised event view (real mode)
    const now = Date.now();

    /* ---------- per-card data ---------- */
    const evOf = (card) => {
      if (card.dataset.real && realById[card.dataset.id]) return realById[card.dataset.id];
      return {
        id: card.dataset.id || slugify((card.querySelector('.uc-ev-title') || {}).textContent),
        title: ((card.querySelector('.uc-ev-title') || {}).textContent || 'Event').replace(/\s+/g, ' ').trim(),
        city: card.dataset.city || '',
        start: card.dataset.start || '',
        end: card.dataset.end || '',
        tz: card.dataset.tz || '',
        host: card.dataset.host || '',
        place: card.dataset.place || card.dataset.city || '',
        desc: ((card.querySelector('.uc-ev-desc') || {}).textContent || '').trim()
      };
    };
    sampleCards.forEach((c) => { if (!c.dataset.id) c.dataset.id = evOf(c).id; c.setAttribute('tabindex', '-1'); });
    const byId = (id) => cards.find((c) => c.dataset.id === id);
    const isPast = (card) => { const t = Date.parse(card.dataset.start); return !isNaN(t) && t < now; };

    function toView(r) {
      const host = r.expand && r.expand.host;
      return {
        id: r.id, real: true, title: String(r.title || 'Event'),
        city: String(r.city || ''), start: normIso(r.start), end: normIso(r.end),
        tz: '', host: String((host && host.name) || 'A member'), hostId: host ? host.id : '',
        place: String(r.place || r.city || ''), desc: String(r.description || ''),
        going: Number(r.going_count) || 0
      };
    }

    /* ---------- RSVP ---------- */
    let rsvps = readList(RSVP_KEY);           // sample mode only
    const isGoing = (card) => (card.dataset.real
      ? !!(myRsvps && myRsvps.has(card.dataset.id))
      : rsvps.indexOf(card.dataset.id) >= 0);
    function paintRsvp(card) {
      const btn = card.querySelector('[data-ev-rsvp]');
      if (!btn) return;
      const ev = evOf(card);
      if (isPast(card)) {
        btn.disabled = true; btn.textContent = 'Ended'; btn.setAttribute('aria-pressed', 'false');
        return;
      }
      btn.disabled = false;
      const on = isGoing(card);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-on', on);
      if (card.dataset.real) {
        btn.textContent = on ? 'Going (cancel)' : 'RSVP';
      } else {
        btn.innerHTML = on ? '<span class="iconify" data-icon="ph:check-bold" aria-hidden="true"></span>&nbsp;Going' : 'RSVP';
        if (window.Iconify && on) window.Iconify.scan(btn);
      }
      btn.setAttribute('aria-label', (on ? 'Going to ' : 'RSVP to ') + ev.title + (on && card.dataset.real ? ' (cancel)' : ''));
    }
    function paintGoing(card) {
      const el = card.querySelector('[data-ev-going]');
      const ev = card.dataset.real ? realById[card.dataset.id] : null;
      if (el && ev) el.textContent = ev.going + ' going';
    }
    function pulse(el) {          // node-pulse: class toggle, CSS keyframe in p-events-jobs.css
      if (!el) return;
      el.classList.remove('uc-pulse'); void el.offsetWidth; el.classList.add('uc-pulse');
      setTimeout(() => el.classList.remove('uc-pulse'), 300);
    }
    function sayHello(card) {
      const ev = evOf(card);
      pulse(card.querySelector('[data-ev-hello]'));
      if (window.UC && window.UC.toast) window.UC.toast('Pick someone to invite to <b>' + esc(ev.title) + '</b> (sample event).');
      else toast('Pick someone to invite to <b>' + esc(ev.title) + '</b> (sample event).');
      if (window.UC && window.UC.openChat) window.UC.openChat();
    }
    let rsvpBusy = false;
    async function toggleRsvp(card) {
      const ev = evOf(card);
      if (isPast(card)) return;
      if (card.dataset.real) {
        if (rsvpBusy) return;
        rsvpBusy = true;
        const btn = card.querySelector('[data-ev-rsvp]');
        if (btn) btn.disabled = true;
        const on = await rsvp(ev.id);
        rsvpBusy = false;
        const fresh = evCache[ev.id];
        if (fresh) ev.going = Number(fresh.going_count) || 0;
        paintRsvp(card); paintGoing(card); pulse(card.querySelector('[data-ev-rsvp]'));
        toast(on ? 'You’re going to <b>' + esc(ev.title) + '</b>.' : 'RSVP removed for <b>' + esc(ev.title) + '</b>.');
        if (activeFilter === 'going') applyFilter();
        return;
      }
      const on = rsvps.indexOf(ev.id) >= 0;
      const next = !on;
      rsvps = next ? rsvps.concat(ev.id) : rsvps.filter((x) => x !== ev.id);
      UCP().store && UCP().store(RSVP_KEY, rsvps);
      paintRsvp(card);
      pulse(card.querySelector('[data-ev-rsvp]'));
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
      const real = !!card.dataset.real;
      const loc = real ? undefined : 'en-GB';
      const tz = real ? undefined : ev.tz;
      const dateStr = fmtDate(ev.start, tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, loc);
      const t1 = fmtDate(ev.start, tz, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }, loc);
      const t2 = ev.end ? fmtDate(ev.end, tz, { hour: '2-digit', minute: '2-digit' }, loc) : '';
      const going = isGoing(card);
      const past = isPast(card);
      const online = /^online$/i.test(ev.city);
      const where = real ? (ev.place + (ev.place && ev.city && ev.place !== ev.city ? ', ' : '') + (ev.place === ev.city ? '' : ev.city)) : ev.place;
      const body =
        (real ? '' : '<p class="uc-ej-sample-note">Sample listing — curated example, not a confirmed event.</p>')
        + '<dl class="uc-ej-dl">'
        + '<dt>When</dt><dd>' + esc(dateStr) + (t1 ? ' · ' + esc(t1) + (t2 ? '–' + esc(t2) : '') : '')
        + (real ? ' <small>(your time zone)</small>' : '') + '</dd>'
        + '<dt>Where</dt><dd>' + esc(where || '—') + (online || !ev.city ? '' : ' <button type="button" class="uc-ej-link" data-d-map>Map</button>') + '</dd>'
        + '<dt>Host</dt><dd><button type="button" class="uc-ej-link" data-d-host>' + esc(ev.host || '—') + '</button></dd>'
        + (real ? '<dt>Going</dt><dd>' + esc(ev.going) + '</dd>' : '')
        + '</dl>'
        + (ev.desc ? '<p class="uc-ev-pre" style="margin:12px 0 0;">' + esc(ev.desc) + '</p>' : '')
        + (real
          ? '<div class="uc-ej-callout">Attendee names are never shown, only the number going.</div>'
          : '<div class="uc-ej-callout"><b>Who else is going?</b><br>Attendee lists appear once RSVPs are live. '
            + (online ? '<button type="button" class="uc-ej-link" data-d-people>Browse the network</button> in the meantime.'
              : '<button type="button" class="uc-ej-link" data-d-people>See alumni in ' + esc(ev.city) + '</button> in the meantime.')
            + '</div>');
      const close = D({
        title: ev.title,
        body: body,
        actions: [
          { label: 'Add to calendar', onClick: () => downloadIcs(ev) },
          past ? { label: 'Close' } : {
            label: going ? (real ? 'Going (cancel)' : 'Cancel RSVP') : 'RSVP', primary: true,
            onClick: (c) => { toggleRsvp(card); c(); }
          }
        ]
      });
      const d = close && close.el;
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
    let activeFilter = 'all';      // 'all' | 'month' | 'going' | 'day:<ISO>' | 'city:<City>'
    let query = '';
    let pendingCity = '';          // a ?city= with no matching event
    let pendingDay = '';           // a ?day= (real mode)

    function buildChips() {
      if (!chipsBox) return;
      const cities = [];
      cards.forEach((c) => { const k = c.dataset.city; if (k && cities.indexOf(k) < 0) cities.push(k); });
      cities.sort((a, b) => (a === 'Online') - (b === 'Online') || a.localeCompare(b));
      const filters = [['all', 'All'], ['month', 'This month'], ['going', 'Going']]
        .concat(pendingDay ? [['day:' + pendingDay, 'On ' + pendingDay]] : [])
        .concat(cities.map((c) => ['city:' + c, c]));
      chipsBox.innerHTML = filters.map((f) =>
        '<button type="button" class="uc-chip uc-ej-chip" data-f="' + esc(f[0]) + '" aria-pressed="false">' + esc(f[1]) + '</button>').join('');
    }
    if (chipsBox) {
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
      if (activeFilter === 'going') return isGoing(card);
      if (activeFilter === 'month') {
        const d = new Date(card.dataset.start), n = new Date();
        return !isNaN(d) && d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
      }
      if (activeFilter.indexOf('day:') === 0) {
        const d = new Date(card.dataset.start);
        return !isNaN(d) && localDay(d) === activeFilter.slice(4);
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
          : activeFilter.indexOf('day:') === 0 ? 'on ' + activeFilter.slice(4)
          : cityName ? 'in ' + cityName : '';
        status.textContent = (activeFilter === 'all' && !query && !pendingCity) ? ''
          : shown + ' event' + (shown === 1 ? '' : 's') + (label ? ' ' + label : '') + (query ? ' matching “' + query + '”' : '');
      }
      if (writeHash) {
        setHashParams({
          city: cityName, q: query,
          day: activeFilter.indexOf('day:') === 0 ? activeFilter.slice(4) : ''
        });
      }
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
    function wireCard(card) {
      const ev = evOf(card);
      paintRsvp(card);
      if (isPast(card)) card.classList.add('is-past');
      const r = card.querySelector('[data-ev-rsvp]');
      if (r) r.addEventListener('click', () => toggleRsvp(card));
      const h = card.querySelector('[data-ev-hello]');
      if (h) { h.addEventListener('click', () => sayHello(card)); h.setAttribute('aria-label', 'Invite someone to ' + ev.title); }
      const d = card.querySelector('[data-ev-details]');
      if (d) { d.addEventListener('click', () => openDetails(card)); d.setAttribute('aria-label', 'Details: ' + ev.title); }
      const ic = card.querySelector('[data-ev-ics]');
      if (ic) ic.addEventListener('click', () => downloadIcs(ev));
      card.querySelectorAll('[data-ev-city]').forEach((b) => {
        b.setAttribute('aria-label', 'Show alumni in ' + ev.city + ' on the map');
        b.addEventListener('click', () => G('map', { city: ev.city }));
      });
      card.querySelectorAll('[data-ev-host]').forEach((b) => {
        b.setAttribute('aria-label', 'Find ' + ev.host + ' in the network');
        b.addEventListener('click', () => G('network', { q: ev.host }));
      });
    }

    /* ---------- Real events ---------- */
    function cardHtml(ev, i) {
      const d = new Date(ev.start);
      const day = isNaN(d) ? '' : pad2(d.getDate());
      const mon = isNaN(d) ? '' : fmtDate(ev.start, undefined, { month: 'short' });
      const when = isNaN(d) ? '' : fmtDate(ev.start, undefined, { weekday: 'short', day: 'numeric', month: 'short' })
        + ' · ' + fmtDate(ev.start, undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
      const hue = HUES[i % HUES.length];
      const cityBtn = ev.city && !/^online$/i.test(ev.city)
        ? '<button type="button" class="uc-ej-link" data-ev-city>' + esc(ev.city) + '</button>' : esc(ev.city);
      return '<article class="uc-row uc-ev" data-uc-event data-real="1" id="event-' + esc(ev.id) + '" data-id="' + esc(ev.id)
        + '" data-city="' + esc(ev.city) + '" data-start="' + esc(ev.start) + '" data-end="' + esc(ev.end)
        + '" data-host="' + esc(ev.host) + '" tabindex="-1">'
        + '<div class="uc-datecirc" style="background:oklch(0.95 0.03 ' + hue + ');"><span class="uc-ev-day">' + esc(day)
        + '</span><span class="uc-eyebrow uc-ev-mon">' + esc(mon) + '</span></div>'
        + '<div class="uc-ev-body"><h3 class="uc-ev-title">' + esc(ev.title) + '</h3>'
        + '<div class="uc-ev-meta"><span>' + esc(when) + '</span>' + (ev.city ? ' · ' + cityBtn : '')
        + (ev.place && ev.place !== ev.city ? ' · ' + esc(ev.place) : '')
        + ' · hosted by <button type="button" class="uc-ej-link" data-ev-host>' + esc(ev.host) + '</button>'
        + ' · <span data-ev-going>' + esc(ev.going) + ' going</span></div>'
        + (ev.desc ? '<p class="uc-ev-desc uc-ev-pre uc-ev-desc--real">' + esc(ev.desc) + '</p>' : '<p class="uc-ev-desc" hidden></p>')
        + '</div>'
        + '<div class="uc-ev-actions">'
        + '<button type="button" class="uc-pill-ghost" data-ev-ics>Add to calendar</button>'
        + '<button type="button" class="uc-pill-ghost" data-ev-details>Details</button>'
        + '<button type="button" class="uc-pill-ink" data-ev-rsvp aria-pressed="false">RSVP</button>'
        + '</div></article>';
    }

    function renderReal(records) {
      realMode = true;
      Object.keys(realById).forEach((k) => delete realById[k]);
      const views = records.map(toView).filter((v) => v.start);
      views.forEach((v) => { realById[v.id] = v; });
      realBox.innerHTML = views.map(cardHtml).join('');
      realBox.hidden = false;
      sampleOnly.forEach((el) => { el.hidden = true; });
      if (firstBox) firstBox.hidden = true;
      if (realNote) realNote.hidden = false;
      cards = Array.from(realBox.querySelectorAll('[data-uc-event]'));
      cards.forEach(wireCard);
      buildChips();
      if (window.Iconify) window.Iconify.scan(realBox);
    }

    function showSamples() {
      realMode = false;
      if (realBox) { realBox.hidden = true; realBox.innerHTML = ''; }
      sampleOnly.forEach((el) => { el.hidden = false; });
      if (realNote) realNote.hidden = true;
      cards = sampleCards.slice();
      buildChips();
    }

    async function loadReal(dayParam) {
      if (!hasApi() || !meUser() || !realBox) return null;
      const start = new Date(); start.setHours(0, 0, 0, 0);
      try {
        const [items] = await Promise.all([
          fetchEvents('start>="' + pbStamp(start) + '"'),
          loadMyRsvps(true)
        ]);
        let all = items;
        if (dayParam) {                       // a past day is not in the upcoming list
          const extra = await eventsOn(dayParam);
          extra.forEach((x) => { if (!all.some((y) => y.id === x.id)) all = all.concat(x); });
          all.sort((a, b) => parseTs(a.start) - parseTs(b.start));
        }
        return all;
      } catch (e) { return null; }
    }

    function showFirstBox(on) {
      if (firstBox) firstBox.hidden = !on;
    }

    async function reload() {
      if (!document.contains(page)) return;
      const recs = await loadReal(pendingDay);
      if (!document.contains(page)) return;
      if (recs && recs.length) { renderReal(recs); showFirstBox(false); }
      else if (recs) { showSamples(); showFirstBox(true); }
      applyFilter(false);
    }

    /* ---------- Static wiring ---------- */
    page.querySelectorAll('[data-ev-suggest]').forEach((b) =>
      b.addEventListener('click', () => suggestDialog(pendingCity || (activeFilter.indexOf('city:') === 0 ? activeFilter.slice(5) : ''))));
    page.querySelectorAll('[data-ev-create]').forEach((b) =>
      b.addEventListener('click', () => {
        const city = pendingCity || (activeFilter.indexOf('city:') === 0 ? activeFilter.slice(5) : '');
        openCreate({ city: /^online$/i.test(city) ? '' : city, date: pendingDay });
      }));
    const clearBtn = page.querySelector('[data-ev-clear]');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      activeFilter = 'all'; pendingCity = ''; pendingDay = ''; query = '';
      if (searchInput) searchInput.value = '';
      buildChips();
      applyFilter(true);
    });
    if (emptyMap) emptyMap.addEventListener('click', () => G('map', { city: emptyMap.dataset.city || '' }));

    const onChanged = (e) => {
      if (!document.contains(page)) { window.removeEventListener('uc:events-changed', onChanged); return; }
      const dt = (e && e.detail) || {};
      if (dt.kind === 'rsvp') {          // RSVP made elsewhere (e.g. the map): repaint that card only
        const card = realMode && byId(dt.id);
        const ev = card && realById[dt.id];
        if (ev && evCache[dt.id]) { ev.going = Number(evCache[dt.id].going_count) || 0; paintRsvp(card); paintGoing(card); }
        return;
      }
      reload();
    };
    window.addEventListener('uc:events-changed', onChanged);

    /* ---------- Deep links ---------- */
    const params = UCP().params ? UCP().params() : new URLSearchParams();
    const pCity = (params.get('city') || '').trim();
    const pQ = (params.get('q') || '').trim();
    const pId = (params.get('id') || '').trim();
    const pDay = (params.get('day') || '').trim();
    if (pQ) { query = pQ; if (searchInput) searchInput.value = pQ; }
    if (DAY_RE.test(pDay)) { pendingDay = pDay; activeFilter = 'day:' + pDay; }

    function applyDeepCity() {
      if (!pCity) return;
      const cityNames = cards.map((c) => c.dataset.city).filter(Boolean);
      const hit = cityNames.find((c) => c.toLowerCase() === pCity.toLowerCase());
      if (hit) { activeFilter = 'city:' + hit; pendingCity = ''; } else pendingCity = pCity;
    }

    function openDeepId() {
      if (!pId) return;
      const card = byId(pId) || byId(slugify(pId));
      if (!card) { toast('That event isn’t listed any more.', 'warn'); return; }
      if (card.hidden) { activeFilter = 'all'; pendingCity = ''; pendingDay = ''; query = ''; if (searchInput) searchInput.value = ''; buildChips(); applyFilter(false); }
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

    // First paint with samples (instant), then swap to real events when the server answers.
    buildChips();
    applyDeepCity();
    applyFilter(false);
    sampleCards.forEach(wireCard);
    if (!hasApi() || !meUser()) { openDeepId(); return; }

    loadReal(pDay && DAY_RE.test(pDay) ? pDay : '').then((recs) => {
      if (!document.contains(page)) return;
      if (recs && recs.length) {
        renderReal(recs);
        pendingCity = ''; applyDeepCity();
      } else if (recs) {
        showFirstBox(true);
      }
      applyFilter(false);
      openDeepId();
    });
  };
})();
