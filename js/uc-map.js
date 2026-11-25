/* ==========================================================================
   UniCircle map (window.UCMap) — shared by the waitlist page and #map.

   Privacy model: a dot is a NEIGHBOURHOOD (or a city, when no neighbourhood is
   given), never an address. People in the same neighbourhood are merged into
   ONE dot with a count, and the map cannot zoom past district level
   (maxZoom 11), so streets are never resolvable.

   Layers:  alumni   → red dots   (where alumni are)
            students → blue dots  (student exchange: who from your tutorial is where)

   Points:  { layer, city, area?, tutorial?, programme?, mentor?, sample?, id?, name? }
   Coordinates come from the CITY table below (+ a small deterministic offset per
   neighbourhood so districts separate) — no geocoding service, no GPS.
   Requires Leaflet (window.L) loaded first.
   ========================================================================== */
(function () {
  'use strict';

  // City → [lat, lng] (city centre). Extend freely; keys are matched case-insensitively
  // against the start of a free-text location ("Berlin, Germany" → Berlin).
  const CITY = {
    Amsterdam: [52.3676, 4.9041], Rotterdam: [51.9244, 4.4777], 'The Hague': [52.0705, 4.3007],
    Utrecht: [52.0907, 5.1214], Eindhoven: [51.4416, 5.4697], Groningen: [53.2194, 6.5665],
    Leiden: [52.1601, 4.4970], Nijmegen: [51.8126, 5.8372], Tilburg: [51.5555, 5.0913],
    Maastricht: [50.8514, 5.6910], Brussels: [50.8503, 4.3517], Antwerp: [51.2194, 4.4025],
    Ghent: [51.0543, 3.7174], Leuven: [50.8798, 4.7005], Liège: [50.6326, 5.5797],
    Luxembourg: [49.6116, 6.1319], Paris: [48.8566, 2.3522], Lyon: [45.7640, 4.8357],
    Lille: [50.6292, 3.0573], London: [51.5072, -0.1276], Manchester: [53.4808, -2.2426],
    Edinburgh: [55.9533, -3.1883], Dublin: [53.3498, -6.2603], Berlin: [52.5200, 13.4050],
    Munich: [48.1351, 11.5820], Hamburg: [53.5511, 9.9937], Frankfurt: [50.1109, 8.6821],
    Cologne: [50.9375, 6.9603], Düsseldorf: [51.2277, 6.7735], Aachen: [50.7753, 6.0839],
    Stuttgart: [48.7758, 9.1829], Heidelberg: [49.3988, 8.6724], Vienna: [48.2082, 16.3738],
    Zurich: [47.3769, 8.5417], Geneva: [46.2044, 6.1432], Basel: [47.5596, 7.5886],
    Milan: [45.4642, 9.1900], Rome: [41.9028, 12.4964], Bologna: [44.4949, 11.3426],
    Madrid: [40.4168, -3.7038], Barcelona: [41.3874, 2.1686], Valencia: [39.4699, -0.3763],
    Lisbon: [38.7223, -9.1393], Porto: [41.1579, -8.6291], Copenhagen: [55.6761, 12.5683],
    Stockholm: [59.3293, 18.0686], Oslo: [59.9139, 10.7522], Helsinki: [60.1699, 24.9384],
    Warsaw: [52.2297, 21.0122], Kraków: [50.0647, 19.9450], Prague: [50.0755, 14.4378],
    Budapest: [47.4979, 19.0402], Athens: [37.9838, 23.7275], Vilnius: [54.6872, 25.2797],
    Riga: [56.9496, 24.1052], Tallinn: [59.4370, 24.7536], Bucharest: [44.4268, 26.1025],
    Istanbul: [41.0082, 28.9784], 'New York': [40.7128, -74.0060], Boston: [42.3601, -71.0589],
    'San Francisco': [37.7749, -122.4194], Toronto: [43.6532, -79.3832], Singapore: [1.3521, 103.8198],
    'Hong Kong': [22.3193, 114.1694], Dubai: [25.2048, 55.2708], Sydney: [-33.8688, 151.2093],
    Tokyo: [35.6762, 139.6503], Shanghai: [31.2304, 121.4737], 'São Paulo': [-23.5558, -46.6396],
  };
  const ALIASES = { 'den haag': 'The Hague', 'münchen': 'Munich', 'köln': 'Cologne', 'wien': 'Vienna',
    'zürich': 'Zurich', 'bruxelles': 'Brussels', 'brussel': 'Brussels', 'antwerpen': 'Antwerp',
    'gent': 'Ghent', 'lisboa': 'Lisbon', 'praha': 'Prague', 'nyc': 'New York', 'krakow': 'Kraków',
    'dusseldorf': 'Düsseldorf', 'liege': 'Liège', 'milano': 'Milan', 'roma': 'Rome' };

  function matchCity(location) {
    if (!location) return null;
    const s = String(location).trim().toLowerCase();
    for (const a in ALIASES) if (s.startsWith(a)) return ALIASES[a];
    let best = null;
    for (const c in CITY) {
      const k = c.toLowerCase();
      if (s === k || s.startsWith(k + ',') || s.startsWith(k + ' ') || s.startsWith(k + '-') || s.includes(', ' + k) || s === k) {
        if (!best || k.length > best.length) best = c;
      }
    }
    return best;
  }

  // Deterministic small offset (≤ ~3 km) so neighbourhoods of one city separate.
  function hash(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function offset(city, area) {
    if (!area) return [0, 0];
    const h = hash(city + '|' + area.toLowerCase());
    const ang = (h % 360) * Math.PI / 180, r = 0.008 + ((h >>> 9) % 100) / 100 * 0.018;
    return [Math.sin(ang) * r, Math.cos(ang) * r * 1.5];
  }

  const COLORS = { alumni: '#d64541', students: '#2f6fdb' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // Group points into one bucket per layer + city + neighbourhood (+ tutorial for students).
  function bucketize(points) {
    const map = new Map();
    let unplaced = 0;
    for (const p of points) {
      const city = CITY[p.city] ? p.city : matchCity(p.city);
      if (!city) { unplaced++; continue; }
      const area = (p.area || '').trim();
      const key = [p.layer, city, area.toLowerCase(), p.layer === 'students' ? (p.tutorial || '') : ''].join('|');
      if (!map.has(key)) {
        const c = CITY[city], o = offset(city, area || (p.layer === 'students' ? p.tutorial : ''));
        map.set(key, { layer: p.layer, city, area, tutorial: p.tutorial || '', lat: c[0] + o[0], lng: c[1] + o[1], people: [] });
      }
      map.get(key).people.push(p);
    }
    return { buckets: [...map.values()], unplaced };
  }

  function create(el, opts) {
    opts = opts || {};
    if (!window.L || !el) return null;
    const map = L.map(el, {
      zoomControl: true, scrollWheelZoom: false, minZoom: 3, maxZoom: 11, worldCopyJump: true,
      attributionControl: true,
    }).setView(opts.center || [50.5, 8], opts.zoom || 4);
    // OpenStreetMap standard tiles (no key; fine for low volume under the OSM
    // tile usage policy). Muted with a CSS filter to sit on the paper palette.
    // At scale, switch to a keyed provider (e.g. MapTiler/Stadia) — URL only.
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 11,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const tc = tiles.getContainer && tiles.getContainer();
    if (tc) tc.style.filter = 'grayscale(0.9) sepia(0.12) brightness(1.04) contrast(0.92)';
    // Wheel-zoom only after a click, so the page scroll isn't hijacked.
    map.once('focus', () => map.scrollWheelZoom.enable());

    const groups = { alumni: L.layerGroup(), students: L.layerGroup() };
    let points = [], visible = new Set(opts.layers || ['alumni']), tutorial = '';

    function render() {
      groups.alumni.clearLayers(); groups.students.clearLayers();
      const pts = points.filter((p) => visible.has(p.layer) && (!tutorial || p.layer !== 'students' || p.tutorial === tutorial));
      const { buckets, unplaced } = bucketize(pts);
      for (const b of buckets) {
        const n = b.people.length;
        const m = L.circleMarker([b.lat, b.lng], {
          radius: Math.min(6 + Math.sqrt(n) * 3, 22), color: '#fff', weight: 2,
          fillColor: COLORS[b.layer], fillOpacity: 0.88,
        });
        const where = (b.area ? b.area + ', ' : '') + b.city;
        m.bindTooltip(esc(where) + ' · ' + n + (b.layer === 'students' ? (n === 1 ? ' student' : ' students') : (n === 1 ? ' alumnus' : ' alumni')), { direction: 'top', offset: [0, -6] });
        m.on('click', () => opts.onSelect && opts.onSelect(b));
        m.addTo(groups[b.layer]);
      }
      for (const k in groups) { if (visible.has(k)) groups[k].addTo(map); else groups[k].remove(); }
      if (opts.onRender) opts.onRender({ buckets, unplaced });
    }

    return {
      map,
      setPoints(p) { points = p || []; render(); },
      addPoints(p) { points = points.concat(p || []); render(); },
      setLayers(list) { visible = new Set(list); render(); },
      setTutorial(t) { tutorial = t || ''; render(); },
      tutorials() { return [...new Set(points.filter((p) => p.layer === 'students' && p.tutorial).map((p) => p.tutorial))].sort(); },
      flyToCity(name, zoom) {
        const c = CITY[name] ? name : matchCity(name);
        if (c) map.flyTo(CITY[c], zoom || 10, { duration: 0.8 });
        return c;
      },
      invalidate() { setTimeout(() => map.invalidateSize(), 50); },
    };
  }

  // ---- Illustrative sample data (always labelled "sample" in the UI) ----
  const SAMPLE_ALUMNI = [
    ['Amsterdam', 'Zuid', 6, 3], ['Amsterdam', 'De Pijp', 3, 1], ['Amsterdam', 'Oost', 2, 0],
    ['Rotterdam', 'Kralingen', 2, 1], ['The Hague', 'Statenkwartier', 2, 1], ['Utrecht', 'Wittevrouwen', 2, 1],
    ['Brussels', 'Ixelles', 4, 2], ['Brussels', 'Etterbeek', 2, 0], ['Antwerp', 'Zurenborg', 2, 1],
    ['London', 'Shoreditch', 4, 2], ['London', 'Canary Wharf', 3, 1], ['London', 'Islington', 2, 1],
    ['Paris', 'Le Marais', 3, 1], ['Paris', 'Batignolles', 2, 0], ['Berlin', 'Kreuzberg', 3, 2],
    ['Berlin', 'Prenzlauer Berg', 2, 1], ['Munich', 'Schwabing', 3, 1], ['Frankfurt', 'Westend', 3, 1],
    ['Hamburg', 'Eimsbüttel', 2, 0], ['Cologne', 'Ehrenfeld', 2, 1], ['Zurich', 'Kreis 4', 2, 1],
    ['Vienna', 'Neubau', 2, 1], ['Milan', 'Brera', 2, 0], ['Madrid', 'Malasaña', 2, 1],
    ['Barcelona', 'Gràcia', 3, 1], ['Lisbon', 'Príncipe Real', 3, 2], ['Copenhagen', 'Vesterbro', 2, 1],
    ['Stockholm', 'Södermalm', 2, 0], ['Dublin', 'Portobello', 2, 1], ['Luxembourg', 'Kirchberg', 3, 1],
    ['Warsaw', 'Mokotów', 1, 0], ['Prague', 'Vinohrady', 1, 1], ['New York', 'Brooklyn', 2, 1],
    ['Singapore', 'Tanjong Pagar', 2, 1], ['Dubai', 'DIFC', 1, 0],
  ];
  const SAMPLE_STUDENTS = [
    ['Leuven', 'Heverlee', 'FIN-2041 · Tutorial 07', 4], ['Leuven', 'Centrum', 'MKT-1102 · Tutorial 03', 3],
    ['Barcelona', 'Eixample', 'FIN-2041 · Tutorial 07', 3], ['Barcelona', 'Gràcia', 'ECO-2210 · Tutorial 12', 2],
    ['Lisbon', 'Alvalade', 'FIN-2041 · Tutorial 07', 2], ['Lisbon', 'Arroios', 'MKT-1102 · Tutorial 03', 2],
    ['Copenhagen', 'Frederiksberg', 'ECO-2210 · Tutorial 12', 3], ['Vienna', 'Wieden', 'FIN-2041 · Tutorial 07', 2],
    ['Madrid', 'Moncloa', 'MKT-1102 · Tutorial 03', 3], ['Milan', 'Città Studi', 'ECO-2210 · Tutorial 12', 2],
    ['Amsterdam', 'Science Park', 'DS-3001 · Tutorial 02', 3], ['Berlin', 'Mitte', 'DS-3001 · Tutorial 02', 2],
    ['Prague', 'Dejvice', 'ECO-2210 · Tutorial 12', 1], ['Stockholm', 'Norrmalm', 'DS-3001 · Tutorial 02', 2],
  ];
  function samplePoints() {
    const out = [];
    SAMPLE_ALUMNI.forEach(([city, area, n, mentors]) => {
      for (let i = 0; i < n; i++) out.push({ layer: 'alumni', city, area, mentor: i < mentors, sample: true });
    });
    SAMPLE_STUDENTS.forEach(([city, area, tutorial, n]) => {
      for (let i = 0; i < n; i++) out.push({ layer: 'students', city, area, tutorial, sample: true });
    });
    return out;
  }

  // ---- Helpers for the live (signed-in) map ----------------------------------
  const GRID = 0.05;                       // the server snaps lat/lng to this grid
  function snap(x) { return Number((Math.round(Number(x) / GRID) * GRID).toFixed(2)); }
  function cityCoords(name) { const c = CITY[name] ? name : matchCity(name); return c ? { city: c, lat: CITY[c][0], lng: CITY[c][1] } : null; }
  function searchCities(q, limit) {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return [];
    const out = [], seen = new Set();
    const push = (city) => { if (!seen.has(city)) { seen.add(city); out.push({ city }); } };
    Object.keys(CITY).sort().forEach((c) => { if (c.toLowerCase().startsWith(s)) push(c); });
    for (const a in ALIASES) if (a.startsWith(s)) push(ALIASES[a]);
    Object.keys(CITY).sort().forEach((c) => { if (c.toLowerCase().includes(s)) push(c); });
    return out.slice(0, limit || 8);
  }
  function nearestCity(lat, lng) {
    let best = null, bd = Infinity;
    const rad = Math.PI / 180;
    for (const c in CITY) {
      const dLat = (CITY[c][0] - lat) * rad, dLng = (CITY[c][1] - lng) * rad;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(CITY[c][0] * rad) * Math.sin(dLng / 2) ** 2;
      const d = 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
      if (d < bd) { bd = d; best = c; }
    }
    return { city: best, km: bd };
  }

  const SVG_CAL = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" d="M2.5 4.5h11v9h-11zM2.5 7.5h11M5.5 2.5v3M10.5 2.5v3"/></svg>';
  const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const TILE_FILTER = 'grayscale(0.9) sepia(0.12) brightness(1.04) contrast(0.92)';

  // Live map: grid-cell cluster markers, event markers, a "you" marker, a pick marker.
  function createLive(el, opts) {
    opts = opts || {};
    if (!window.L || !el) return null;
    const map = L.map(el, { zoomControl: true, scrollWheelZoom: false, minZoom: 3, maxZoom: 11, worldCopyJump: true })
      .setView(opts.center || [50.5, 8], opts.zoom || 4);
    const tiles = L.tileLayer(TILE, { maxZoom: 11, attribution: ATTR }).addTo(map);
    const tc = tiles.getContainer && tiles.getContainer();
    if (tc) tc.style.filter = TILE_FILTER;
    map.once('focus', () => map.scrollWheelZoom.enable());
    const gCells = L.layerGroup().addTo(map), gEvents = L.layerGroup().addTo(map);
    let meMarker = null, pickRect = null;
    map.on('click', (e) => { if (opts.onMapClick) opts.onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }); });

    return {
      map,
      setCells(cells, layer) {
        gCells.clearLayers();
        cells.forEach((c) => {
          const n = c.people.length;
          const size = Math.round(Math.min(28 + Math.sqrt(n) * 7, 58));
          const cls = layer === 'students' ? 'uc-mk-students' : 'uc-mk-alumni';
          const icon = L.divIcon({
            className: 'uc-mk-wrap', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
            html: '<span class="uc-mk ' + cls + (c.selected ? ' is-sel' : '') + '" style="width:' + size + 'px;height:' + size + 'px">' + n + '</span>',
          });
          const m = L.marker([c.lat, c.lng], { icon, keyboard: true, title: (c.city || 'Area') + ': ' + n + ' member' + (n === 1 ? '' : 's'), riseOnHover: true });
          m.on('click', () => opts.onSelectCell && opts.onSelectCell(c));
          m.addTo(gCells);
        });
      },
      setEvents(list) {
        gEvents.clearLayers();
        const used = new Map();
        list.forEach((ev) => {
          if (!isFinite(ev.lat) || !isFinite(ev.lng)) return;
          const k = ev.lat.toFixed(2) + '|' + ev.lng.toFixed(2), i = used.get(k) || 0;
          used.set(k, i + 1);
          const lat = ev.lat + (i ? Math.sin(i * 2.4) * 0.012 * Math.ceil(i / 6) : 0);
          const lng = ev.lng + (i ? Math.cos(i * 2.4) * 0.018 * Math.ceil(i / 6) : 0);
          const icon = L.divIcon({ className: 'uc-mk-wrap', iconSize: [30, 30], iconAnchor: [15, 15], html: '<span class="uc-mk-ev">' + SVG_CAL + '</span>' });
          const m = L.marker([lat, lng], { icon, keyboard: true, title: String(ev.title || 'Event'), zIndexOffset: 500 });
          m.on('click', () => opts.onSelectEvent && opts.onSelectEvent(ev));
          m.addTo(gEvents);
        });
      },
      setMe(me) {
        if (meMarker) { meMarker.remove(); meMarker = null; }
        if (!me) return;
        const icon = L.divIcon({
          className: 'uc-mk-wrap', iconSize: [44, 44], iconAnchor: [22, 22],
          html: '<span class="uc-mk-me' + (me.visible ? '' : ' is-hidden') + '"><i></i><b>You' + (me.visible ? '' : ' (hidden)') + '</b></span>',
        });
        meMarker = L.marker([me.lat, me.lng], { icon, keyboard: false, interactive: false, zIndexOffset: 1000 }).addTo(map);
      },
      setPick(p) {
        if (pickRect) { pickRect.remove(); pickRect = null; }
        if (!p) return;
        pickRect = L.rectangle([[p.lat - GRID / 2, p.lng - GRID / 2], [p.lat + GRID / 2, p.lng + GRID / 2]],
          { color: '#2b2a26', weight: 2, dashArray: '5 5', fillOpacity: 0.08, interactive: false }).addTo(map);
      },
      flyTo(lat, lng, zoom) { map.flyTo([lat, lng], zoom || 9, { duration: 0.8 }); },
      flyToCity(name, zoom) { const c = cityCoords(name); if (c) map.flyTo([c.lat, c.lng], zoom || 10, { duration: 0.8 }); return c ? c.city : null; },
      invalidate() { setTimeout(() => map.invalidateSize(), 50); },
      destroy() { try { map.remove(); } catch (e) { /* already gone */ } },
    };
  }

  // Small preview for the "show me on the map" dialog: shows the ~5 km cell others will see.
  function createPreview(el) {
    if (!window.L || !el) return null;
    const map = L.map(el, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, minZoom: 3, maxZoom: 11 })
      .setView([50.5, 8], 4);
    const t = L.tileLayer(TILE, { maxZoom: 11, attribution: ATTR }).addTo(map);
    const tc = t.getContainer && t.getContainer();
    if (tc) tc.style.filter = TILE_FILTER;
    let rect = null;
    return {
      map,
      show(lat, lng) {
        const la = snap(lat), ln = snap(lng);
        if (rect) rect.remove();
        rect = L.rectangle([[la - GRID / 2, ln - GRID / 2], [la + GRID / 2, ln + GRID / 2]], { color: '#d64541', weight: 2, fillColor: '#d64541', fillOpacity: 0.3, interactive: false }).addTo(map);
        map.setView([la, ln], 9, { animate: false });
        return { lat: la, lng: ln };
      },
      invalidate() { setTimeout(() => map.invalidateSize(), 80); },
      destroy() { try { map.remove(); } catch (e) { /* already gone */ } },
    };
  }

  window.UCMap = { create, matchCity, cities: () => Object.keys(CITY).sort(), samplePoints, COLORS,
    GRID, snap, cityCoords, searchCities, nearestCity, createLive, createPreview, esc };
})();
