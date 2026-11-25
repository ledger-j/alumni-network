/* UniCircle page module: #map — live member map for signed-in members.
   Deep links: #map?city=<City>&layer=alumni|students&day=YYYY-MM-DD
   Data: user_locations (visible pins, grid-snapped by the server) + users (paged);
   legacy members with only a free-text location are matched to the city table
   and marked "from profile text". No sample data in the signed-in map.
   Events: window.UCEvents (lane M2), always guarded. */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  window.UCPages.map = function (root) {
    const UCP = window.UCP, esc = UCP.esc;
    const el = root.querySelector('#uc-map');
    if (!el) return;
    const panel = root.querySelector('[data-map-panel]');
    const evBox = root.querySelector('[data-map-events]');
    const stats = root.querySelector('[data-map-stats]');
    const myDot = root.querySelector('[data-my-dot]');
    const hideBtn = root.querySelector('[data-me-hide]');
    const strip = root.querySelector('[data-day-strip]');
    const bandCanvas = root.querySelector('[data-map-band]');
    if (bandCanvas && window.UCConstellation) window.UCConstellation.mount(bandCanvas, { count: 60 });

    const me = UCP.user();
    if (!me) {
      el.innerHTML = '<p style="padding:24px;color:var(--uc-muted);">Sign in to see where the circle is.</p>';
      return;
    }
    if (!window.UCMap || !window.L) {
      el.innerHTML = '<p style="padding:24px;color:var(--uc-muted);">The map could not load. Check your connection and reload.</p>';
      return;
    }

    const params = UCP.params ? UCP.params() : new URLSearchParams(location.hash.split('?')[1] || '');
    const UM = window.UCMap;
    let layer = params.get('layer') === 'students' ? 'students' : 'alumni';
    let cells = { alumni: [], students: [] };       // arrays of {key,lat,lng,city,people[]}
    let counts = { alumni: 0, students: 0 };
    let myRow = null;                               // own user_locations row (or null)
    let selKey = null, pick = null, dayEvents = [], evToken = 0, lastUpdate = null, loadErr = false;
    let alive = true;

    // ---------- day strip ----------
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const days = [];
    for (let i = 0; i < 14; i++) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); days.push({ iso: iso(d), d }); }
    let day = days.some((x) => x.iso === params.get('day')) ? params.get('day') : days[0].iso;
    const dayLabel = (isoStr) => {
      const x = days.find((q) => q.iso === isoStr);
      return x ? x.d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : isoStr;
    };
    strip.innerHTML = days.map((x, i) => '<button type="button" class="uc-map-day" data-day="' + esc(x.iso) + '" aria-pressed="false">'
      + '<span>' + (i === 0 ? 'Today' : esc(x.d.toLocaleDateString(undefined, { weekday: 'short' }))) + '</span>'
      + '<b>' + x.d.getDate() + '</b><small>' + esc(x.d.toLocaleDateString(undefined, { month: 'short' })) + '</small></button>').join('');
    const dayBtns = [...strip.querySelectorAll('[data-day]')];
    function paintDays() { dayBtns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.day === day ? 'true' : 'false')); }
    strip.addEventListener('click', (e) => { const b = e.target.closest('[data-day]'); if (b) setDay(b.dataset.day); });
    strip.addEventListener('keydown', (e) => {
      const i = dayBtns.indexOf(document.activeElement);
      if (i < 0) return;
      let n = -1;
      if (e.key === 'ArrowRight') n = Math.min(i + 1, dayBtns.length - 1);
      else if (e.key === 'ArrowLeft') n = Math.max(i - 1, 0);
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = dayBtns.length - 1;
      if (n >= 0) { e.preventDefault(); dayBtns[n].focus(); }
    });

    // ---------- map ----------
    const m = UM.createLive(el, {
      onSelectCell: (c) => { pick = null; m.setPick(null); selKey = c.key; drawCells(); showCell(c); },
      onSelectEvent: (ev) => showEvent(ev),
      onMapClick: (p) => planAt(p),
    });
    if (!m) return;
    setTimeout(() => m.invalidate(), 350);

    // City jump
    const dl = root.querySelector('#uc-map-cities');
    dl.innerHTML = UM.cities().map((c) => '<option value="' + esc(c) + '">').join('');
    const cityInput = root.querySelector('[data-city-input]');
    root.querySelector('[data-city-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = cityInput.value.trim();
      if (v && !m.flyToCity(v)) UCP.toast('No city called “' + v + '” in our list yet. Try a nearby one.', 'warn');
    });
    cityInput.addEventListener('change', () => { if (cityInput.value) m.flyToCity(cityInput.value); });

    // Layer toggle
    const layerBtns = [...root.querySelectorAll('.uc-map-toggle [data-layer]')];
    function setLayer(l, quiet) {
      layer = l; selKey = null;
      layerBtns.forEach((b) => { const on = b.dataset.layer === l; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      drawCells();
      if (!quiet) intro();
      syncHash();
    }
    layerBtns.forEach((b) => b.addEventListener('click', () => setLayer(b.dataset.layer)));

    function syncHash() {
      try {
        const q = new URLSearchParams();
        q.set('layer', layer); q.set('day', day);
        if (cityInput.value) q.set('city', cityInput.value);
        history.replaceState(null, '', '#map?' + q.toString());
      } catch (e) { /* ignore */ }
    }

    // ---------- data ----------
    async function pageAll(path) {
      const out = [];
      let page = 1, total = 1;
      do {
        const sep = path.indexOf('?') >= 0 ? '&' : '?';
        const r = await UCP.api('GET', path + sep + 'perPage=200&page=' + page);
        (r.items || []).forEach((x) => out.push(x));
        total = r.totalPages || 1;
        page++;
      } while (page <= total && page < 200);
      return out;
    }

    async function refresh() {
      if (!alive) return;
      try {
        const [locs, users] = await Promise.all([
          pageAll('/api/collections/user_locations/records?filter=' + encodeURIComponent('(visible=true)') + '&expand=user'),
          pageAll('/api/collections/users/records?fields=' + encodeURIComponent('id,name,degree,mentor,role,location,headline,avatar,collectionId')),
        ]);
        let own = null;
        try {
          const r = await UCP.api('GET', '/api/collections/user_locations/records?filter=' + encodeURIComponent('(user="' + me.id + '")') + '&perPage=1');
          own = (r.items || [])[0] || null;
        } catch (e) { /* own row optional */ }
        if (!alive) return;
        myRow = own;
        build(locs, users);
        loadErr = false; lastUpdate = new Date();
      } catch (e) {
        loadErr = true;
      }
      drawAll();
    }

    function person(u, extra) {
      return Object.assign({ id: u.id, name: u.name || 'Member', headline: u.headline || u.degree || '', mentor: !!u.mentor, rec: u, role: u.role }, extra || {});
    }
    function layerOf(u) { return u && u.role === 'student' ? 'students' : 'alumni'; }

    function build(locs, users) {
      const byId = new Map(users.map((u) => [u.id, u]));
      const map = { alumni: new Map(), students: new Map() };
      const pinned = new Set();
      const add = (l, lat, lng, city, p) => {
        const la = UM.snap(lat), ln = UM.snap(lng), key = la + '|' + ln;
        if (!map[l].has(key)) map[l].set(key, { key, lat: la, lng: ln, city: city || '', people: [] });
        const c = map[l].get(key);
        if (!c.city && city) c.city = city;
        c.people.push(p);
      };
      locs.forEach((r) => {
        const u = byId.get(r.user) || (r.expand && r.expand.user);
        if (!u || !isFinite(r.lat) || !isFinite(r.lng)) return;
        pinned.add(r.user);
        add(layerOf(u), r.lat, r.lng, r.city, person(u));
      });
      users.forEach((u) => {
        if (pinned.has(u.id) || !u.location) return;
        const c = UM.cityCoords(u.location);
        if (c) add(layerOf(u), c.lat, c.lng, c.city, person(u, { legacy: true }));
      });
      cells = { alumni: [...map.alumni.values()], students: [...map.students.values()] };
      counts = {
        alumni: cells.alumni.reduce((n, c) => n + c.people.length, 0),
        students: cells.students.reduce((n, c) => n + c.people.length, 0),
      };
    }

    // ---------- drawing ----------
    function drawCells() {
      cells[layer].forEach((c) => { c.selected = c.key === selKey; });
      m.setCells(cells[layer], layer);
    }
    function drawMe() {
      if (myRow && isFinite(myRow.lat) && isFinite(myRow.lng)) m.setMe({ lat: myRow.lat, lng: myRow.lng, visible: !!myRow.visible });
      else m.setMe(null);
      if (myRow && myRow.visible) {
        myDot.textContent = 'You are on the map' + (myRow.city ? ' near ' + myRow.city : '') + '. Other members see an area of about 5 km.';
      } else if (myRow) {
        myDot.textContent = 'Your dot is hidden. Only you can see it, marked “You (hidden)”.';
      } else {
        myDot.textContent = 'You are not on the map. Switch on “Show me on the map” to appear.';
      }
      hideBtn.hidden = !(myRow && myRow.visible);
    }
    function drawStats() {
      const total = counts.alumni + counts.students;
      const t = lastUpdate ? lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      stats.innerHTML = loadErr && !lastUpdate
        ? '<p class="uc-map-note">Could not load the map. We will retry in a minute.</p>'
        : '<div><b>' + total + '</b><span>' + (total === 1 ? 'member' : 'members') + ' on the map · updated ' + esc(t) + '</span></div>'
          + (loadErr ? '<p class="uc-map-note">Last refresh failed; showing the previous data.</p>' : '');
      root.querySelector('[data-count-alumni]').textContent = '(' + counts.alumni + ')';
      root.querySelector('[data-count-students]').textContent = '(' + counts.students + ')';
    }
    function drawAll() {
      drawCells(); drawMe(); drawStats();
      if (!panel.dataset.touched) intro();
      // keep an open cell fresh
      if (selKey) { const c = cells[layer].find((x) => x.key === selKey); if (c) showCell(c); }
    }

    function intro() {
      if (layer === 'students' && counts.students === 0) {
        panel.innerHTML = '<div class="uc-eyebrow"><i class="uc-map-dot blue"></i>Students</div><p>No students on the map yet.</p>';
      } else if (layer === 'students') {
        panel.innerHTML = '<div class="uc-eyebrow"><i class="uc-map-dot blue"></i>Students</div><p>Blue dots are students. Tap one to see who is there.</p>';
      } else if (counts.alumni === 0) {
        panel.innerHTML = '<div class="uc-eyebrow"><i class="uc-map-dot red"></i>Alumni</div><p>Nobody is on the map yet. Be the first: switch on “Show me on the map”.</p>';
      } else {
        panel.innerHTML = '<div class="uc-eyebrow"><i class="uc-map-dot red"></i>Alumni</div><p>Red dots are alumni, one per area of about 5 km. Bigger dot, more people. Tap one to see who is there.</p>';
      }
    }

    function planButton(spot) {
      return '<button type="button" class="uc-btn-dark uc-map-plan" data-plan>Plan an event on ' + esc(dayLabel(day)) + ' here</button>'
        + (spot.city ? '<p class="uc-map-note">Near ' + esc(spot.city) + '</p>' : '');
    }
    function bindPlan(spot) {
      const b = panel.querySelector('[data-plan]');
      if (b) b.addEventListener('click', () => openCreate(spot));
    }

    function showCell(c) {
      panel.dataset.touched = '1';
      const l = layer;
      const mentors = c.people.filter((p) => p.mentor).length;
      let html = '<div class="uc-eyebrow"><i class="uc-map-dot ' + (l === 'students' ? 'blue' : 'red') + '"></i>' + (l === 'students' ? 'Students' : 'Alumni') + '</div>'
        + '<h3 class="uc-serif">' + esc(c.city || 'This area') + '</h3>'
        + '<p><b>' + c.people.length + '</b> ' + (c.people.length === 1 ? 'member' : 'members') + ' in this area'
        + (mentors ? ' · <b>' + mentors + '</b> open to mentoring' : '') + '</p>'
        + '<ul class="uc-map-people">';
      html += c.people.slice(0, 8).map((p) => {
        const isMe = p.id === me.id;
        const av = window.UC && UC.avatarUrl ? UC.avatarUrl(p.rec, 64) : '';
        return '<li class="uc-map-person-row">'
          + (av ? '<img class="uc-map-av" src="' + esc(av) + '" alt="" width="36" height="36" loading="lazy">' : '')
          + '<div class="uc-map-pinfo"><button type="button" class="uc-map-person" data-q="' + esc(p.name) + '">' + esc(p.name) + (isMe ? ' (you)' : '') + '</button>'
          + (p.mentor ? '<span class="uc-map-chip">mentor</span>' : '') + (p.legacy ? '<span class="uc-map-chip">from profile text</span>' : '')
          + (p.headline ? '<small>' + esc(p.headline) + '</small>' : '') + '</div>'
          + (isMe ? '' : '<div class="uc-map-pbtns"><button type="button" class="uc-map-msg" data-uc-message data-uc-peer="' + esc(p.id) + '" aria-label="Message ' + esc(p.name) + '">Message</button>'
            + '<button type="button" class="uc-map-msg" data-uc-collab data-uc-peer="' + esc(p.id) + '" data-name="' + esc(p.name) + '" aria-label="Collaborate with ' + esc(p.name) + '">Collaborate</button></div>')
          + '</li>';
      }).join('') + '</ul>';
      if (c.people.length > 8) html += '<p class="uc-map-note">and ' + (c.people.length - 8) + ' more. <button type="button" class="uc-map-person" data-go-network>See everyone</button></p>';
      const spot = { lat: c.lat, lng: c.lng, city: c.city };
      html += '<div class="uc-map-actions">' + planButton(spot) + '</div>';
      panel.innerHTML = html;
      bindPlan(spot);
      const gn = panel.querySelector('[data-go-network]');
      if (gn) gn.addEventListener('click', () => UCP.go('network', c.city ? { city: c.city } : {}));
    }

    function showEvent(ev) {
      panel.dataset.touched = '1';
      panel.innerHTML = '<div class="uc-eyebrow"><span class="uc-map-evdot" aria-hidden="true"></span>Event</div>'
        + '<h3 class="uc-serif">' + esc(ev.title || 'Event') + '</h3>' + eventLine(ev)
        + '<div class="uc-map-actions"><button type="button" class="uc-btn-dark" data-rsvp="' + esc(ev.id) + '">RSVP</button></div>';
      panel.querySelector('[data-rsvp]').addEventListener('click', () => doRsvp(ev.id));
    }

    function timeOf(ev) {
      const d = new Date(String(ev.start || '').replace(' ', 'T'));
      return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    function eventLine(ev) {
      const bits = [timeOf(ev), ev.place || ev.city || ''].filter(Boolean).map(esc).join(' · ');
      const g = Number(ev.going_count) || 0;
      return '<p class="uc-map-note">' + bits + (bits ? ' · ' : '') + g + ' going</p>';
    }

    // ---------- planning an event ----------
    function planAt(p) {
      const la = UM.snap(p.lat), ln = UM.snap(p.lng);
      const nc = UM.nearestCity(la, ln);
      const spot = { lat: la, lng: ln, city: nc.km <= 300 ? nc.city : '' };
      pick = spot; selKey = null; drawCells(); m.setPick(spot);
      panel.dataset.touched = '1';
      panel.innerHTML = '<div class="uc-eyebrow">Selected spot</div><h3 class="uc-serif">' + esc(spot.city || 'This area') + '</h3>'
        + '<p>An area of about 5 km. No members are listed here.</p><div class="uc-map-actions">' + planButton(spot) + '</div>';
      bindPlan(spot);
    }
    function openCreate(spot) {
      if (window.UCEvents && typeof window.UCEvents.openCreate === 'function') {
        try { window.UCEvents.openCreate({ date: day, city: spot.city || '', lat: spot.lat, lng: spot.lng }); } catch (e) { UCP.toast('Events are loading', 'warn'); }
      } else UCP.toast('Events are loading', 'warn');
    }
    async function doRsvp(id) {
      if (!(window.UCEvents && typeof window.UCEvents.rsvp === 'function')) return UCP.toast('Events are loading', 'warn');
      try { await window.UCEvents.rsvp(id); } catch (e) { UCP.toast((e && e.message) || 'Could not RSVP.', 'warn'); }
      loadDay();
    }

    // ---------- events of the selected day ----------
    function setDay(d) {
      day = d; paintDays(); syncHash();
      loadDay();
      const b = panel.querySelector('[data-plan]');
      if (b) b.textContent = 'Plan an event on ' + dayLabel(day) + ' here';
    }
    async function loadDay() {
      const tok = ++evToken;
      if (!(window.UCEvents && typeof window.UCEvents.eventsOn === 'function')) {
        dayEvents = []; m.setEvents([]);
        evBox.innerHTML = '<div class="uc-eyebrow">Events on ' + esc(dayLabel(day)) + '</div><p class="uc-map-note">Events are loading</p>';
        if (tok === evToken && alive) setTimeout(() => { if (alive && tok === evToken && window.UCEvents) loadDay(); }, 1500);
        return;
      }
      let list = [];
      try { list = await window.UCEvents.eventsOn(day); } catch (e) { list = []; }
      if (tok !== evToken || !alive) return;
      dayEvents = (Array.isArray(list) ? list : []).map((ev) => {
        let lat = Number(ev.lat), lng = Number(ev.lng);
        if (!(isFinite(lat) && isFinite(lng) && (lat || lng))) {
          const c = UM.cityCoords(ev.city || ev.place || '');
          if (c) { lat = c.lat; lng = c.lng; } else { lat = NaN; lng = NaN; }
        }
        return Object.assign({}, ev, { lat, lng });
      });
      m.setEvents(dayEvents);
      let html = '<div class="uc-eyebrow">Events on ' + esc(dayLabel(day)) + '</div>';
      if (!dayEvents.length) html += '<p class="uc-map-note">Nothing planned yet. Click the map to plan something.</p>';
      else {
        html += '<ul class="uc-map-evlist">' + dayEvents.map((ev) => '<li><div><b>' + esc(ev.title || 'Event') + '</b>' + eventLine(ev) + '</div>'
          + '<button type="button" class="uc-btn-ghost" data-rsvp="' + esc(ev.id) + '">RSVP</button></li>').join('') + '</ul>';
      }
      evBox.innerHTML = html;
      evBox.querySelectorAll('[data-rsvp]').forEach((b) => b.addEventListener('click', () => doRsvp(b.dataset.rsvp)));
    }

    // ---------- panel delegation (Message; collaborate is handled by lane K) ----------
    panel.addEventListener('click', (e) => {
      const q = e.target.closest('[data-q]');
      if (q) return UCP.go('network', { q: q.dataset.q });
      const mb = e.target.closest('[data-uc-message]');
      if (mb && window.UC && UC.openChat) UC.openChat(mb.dataset.ucPeer);
    });

    // ---------- my location dialog ----------
    function round05(x) { return UM.snap(x); }
    function openMeDialog() {
      const state = { lat: null, lng: null, city: '', visible: !!(myRow && myRow.visible) };
      if (myRow && isFinite(myRow.lat)) { state.lat = myRow.lat; state.lng = myRow.lng; state.city = myRow.city || ''; }
      const verified = me.verified !== false;
      const body = '<form onsubmit="return false">'
        + (verified ? '' : '<p class="uc-map-note">Verify your email by signing in with the magic link to appear on the map.</p>')
        + '<label class="uc-map-lbl" for="uc-me-city">City</label>'
        + '<div class="uc-map-ac"><input id="uc-me-city" type="search" role="combobox" aria-expanded="false" aria-controls="uc-me-list" autocomplete="off" maxlength="60" placeholder="Start typing a city…" value="' + esc(state.city) + '">'
        + '<ul id="uc-me-list" role="listbox" class="uc-map-aclist" hidden></ul></div>'
        + '<button type="button" class="uc-btn-ghost uc-map-geo" data-geo>Use my current location</button>'
        + '<p class="uc-map-note">Your browser asks first. The coordinates are rounded to about 5 km in your browser before anything is sent.</p>'
        + '<div class="uc-map-prev" id="uc-me-prev" role="img" aria-label="Preview of the area other members will see"></div>'
        + '<p class="uc-map-note" data-prev-note>Pick a city to preview the area others will see.</p>'
        + '<label class="uc-map-switch"><input type="checkbox" data-vis' + (state.visible ? ' checked' : '') + '> <span>Visible to other members</span></label>'
        + '<p class="uc-map-note">Off by default. You can hide yourself any time. Only a ~5 km area is shown, never an address.</p>'
        + '</form>';
      const close = UCP.dialog({
        title: 'Show me on the map', body,
        actions: [
          { label: 'Save', primary: true, onClick: (cl) => save(state, cl) },
          { label: 'Cancel' },
        ],
      });
      const d = close.el;
      const prev = UM.createPreview(d.querySelector('#uc-me-prev'));
      d.addEventListener('close', () => { if (prev) prev.destroy(); });
      const note = d.querySelector('[data-prev-note]');
      const showPrev = () => {
        if (!prev || state.lat == null) return;
        const r = prev.show(state.lat, state.lng);
        state.lat = r.lat; state.lng = r.lng;
        prev.invalidate();
        note.textContent = 'The red square is the area other members will see (about 5 km).';
      };
      setTimeout(() => { if (prev) prev.invalidate(); showPrev(); }, 120);

      const input = d.querySelector('#uc-me-city'), list = d.querySelector('#uc-me-list');
      const pickCity = (name) => {
        const c = UM.cityCoords(name);
        if (!c) return false;
        input.value = c.city; state.city = c.city; state.lat = round05(c.lat); state.lng = round05(c.lng);
        list.hidden = true; input.setAttribute('aria-expanded', 'false');
        showPrev();
        return true;
      };
      input.addEventListener('input', () => {
        const r = UM.searchCities(input.value, 8);
        list.innerHTML = r.map((x) => '<li role="option"><button type="button" data-c="' + esc(x.city) + '">' + esc(x.city) + '</button></li>').join('');
        list.hidden = !r.length; input.setAttribute('aria-expanded', r.length ? 'true' : 'false');
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); const f = UM.searchCities(input.value, 1)[0]; if (f) pickCity(f.city); }
        if (e.key === 'ArrowDown') { const b = list.querySelector('button'); if (b) { e.preventDefault(); b.focus(); } }
      });
      list.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) pickCity(b.dataset.c); });
      list.addEventListener('keydown', (e) => {
        const bs = [...list.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' && bs[i + 1]) { e.preventDefault(); bs[i + 1].focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); (bs[i - 1] || input).focus(); }
      });
      d.querySelector('[data-vis]').addEventListener('change', (e) => { state.visible = e.target.checked; });
      d.querySelector('[data-geo]').addEventListener('click', () => {
        if (!navigator.geolocation) return UCP.toast('Your browser cannot share a location.', 'warn');
        navigator.geolocation.getCurrentPosition((pos) => {
          state.lat = round05(pos.coords.latitude); state.lng = round05(pos.coords.longitude);
          const nc = UM.nearestCity(state.lat, state.lng);
          state.city = nc.km <= 150 ? nc.city : '';
          input.value = state.city;
          showPrev();
        }, () => UCP.toast('Could not read your location. Pick a city instead.', 'warn'), { timeout: 10000, maximumAge: 600000 });
      });
    }

    function explain(e) {
      const msg = (e && e.message) || 'Could not save.';
      if (/verif/i.test(msg)) return 'Verify your email by signing in with the magic link to appear on the map.';
      if (/24|once|day|move/i.test(msg)) return 'You can move your dot once per day. ' + msg;
      return msg;
    }

    async function save(s, close) {
      if (s.lat == null && !myRow) return UCP.toast('Pick a city first.', 'warn');
      try {
        let own = myRow;
        try {
          const r = await UCP.api('GET', '/api/collections/user_locations/records?filter=' + encodeURIComponent('(user="' + me.id + '")') + '&perPage=1');
          own = (r.items || [])[0] || null;
        } catch (e) { /* use cached */ }
        const base = '/api/collections/user_locations/records';
        if (!own) {
          await UCP.api('POST', base, { user: me.id, lat: s.lat, lng: s.lng, city: s.city, visible: !!s.visible });
        } else {
          const moved = s.lat != null && (Math.abs(round05(own.lat) - s.lat) > 1e-6 || Math.abs(round05(own.lng) - s.lng) > 1e-6 || (own.city || '') !== (s.city || ''));
          await UCP.api('PATCH', base + '/' + own.id, moved ? { lat: s.lat, lng: s.lng, city: s.city, visible: !!s.visible } : { visible: !!s.visible });
        }
        close();
        UCP.toast(s.visible ? 'You are on the map.' : 'Saved. You are hidden from other members.');
        await refresh();
        if (myRow && s.visible) m.flyTo(myRow.lat, myRow.lng, 9);
      } catch (e) { UCP.toast(explain(e), 'warn'); }
    }

    async function hideMe() {
      if (!myRow) return;
      try {
        await UCP.api('PATCH', '/api/collections/user_locations/records/' + myRow.id, { visible: false });
        UCP.toast('You are hidden from the map.');
        await refresh();
      } catch (e) { UCP.toast(explain(e), 'warn'); }
    }
    root.querySelectorAll('[data-me-open],[data-me-open2]').forEach((b) => b.addEventListener('click', openMeDialog));
    hideBtn.addEventListener('click', hideMe);

    // ---------- lifecycle: mount, focus, every 60 s while visible ----------
    function tick() {
      if (!alive) return;
      if (!root.isConnected || !el.isConnected) { stop(); return; }
      if (!document.hidden) refresh();
    }
    const onVis = () => { if (!document.hidden) tick(); };
    const timer = setInterval(tick, 60000);
    function stop() {
      alive = false; clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', tick);
      m.destroy();
    }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', tick);

    // ---------- start ----------
    paintDays();
    setLayer(layer, true);
    intro();
    loadDay();
    (async function init() {
      await refresh();
      const city = params.get('city');
      if (city) { cityInput.value = city; if (!m.flyToCity(city)) UCP.toast('No dot for “' + city + '” yet.', 'warn'); }
      syncHash();
    })();
  };
})();
