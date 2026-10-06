/* UniCircle page module: #map — alumni (red) + student exchange (blue).
   Honours #map?city=<City>&layer=alumni|students.
   Real members come from `users.location` (city level). Until the student
   layer has real data (role/tutorial on profiles), it shows labelled samples. */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  window.UCPages.map = function (root) {
    const UCP = window.UCP, esc = UCP.esc;
    const el = root.querySelector('#uc-map');
    if (!el) return;
    if (!window.UCMap || !window.L) {
      el.innerHTML = '<p style="padding:24px;color:var(--uc-muted);">The map could not load — check your connection and reload.</p>';
      return;
    }
    const params = UCP.params();
    const panel = root.querySelector('[data-map-panel]');
    const stats = root.querySelector('[data-map-stats]');
    const tutWrap = root.querySelector('[data-tutorial-wrap]');
    const tutSel = root.querySelector('[data-tutorial]');
    let layer = params.get('layer') === 'students' ? 'students' : 'alumni';
    let realCount = 0, unplaced = 0, sampleShown = false;

    const m = window.UCMap.create(el, {
      layers: [layer],
      onSelect: select,
      onRender(r) { unplaced = r.unplaced; renderStats(); },
    });
    if (!m) return;
    setTimeout(() => m.invalidate(), 350);   // after the view transition settles

    // City jump list
    const dl = root.querySelector('#uc-map-cities');
    dl.innerHTML = window.UCMap.cities().map((c) => '<option value="' + esc(c) + '">').join('');
    root.querySelector('[data-city-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = root.querySelector('[data-city-input]').value.trim();
      if (!v) return;
      if (!m.flyToCity(v)) UCP.toast('No dot for “' + esc(v) + '” yet — try a nearby city.', 'warn');
    });
    root.querySelector('[data-city-input]').addEventListener('change', (e) => { if (e.target.value) m.flyToCity(e.target.value); });

    // Layer toggle
    const btns = [...root.querySelectorAll('.uc-map-toggle [data-layer]')];
    function setLayer(l) {
      layer = l;
      btns.forEach((b) => { const on = b.dataset.layer === l; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
      tutWrap.hidden = l !== 'students';
      m.setLayers([l]);
      panel.innerHTML = l === 'students'
        ? '<div class="uc-eyebrow"><i class="uc-map-dot blue"></i>Student exchange</div><p>Blue dots are students grouped by course or tutorial. Pick your tutorial group to see who from it is where this term.</p>'
        : '<div class="uc-eyebrow"><i class="uc-map-dot red"></i>Alumni</div><p>Red dots are alumni, one per neighbourhood. Bigger dot, more people. Tap one to see who is there.</p>';
    }
    btns.forEach((b) => b.addEventListener('click', () => setLayer(b.dataset.layer)));
    tutSel.addEventListener('change', () => m.setTutorial(tutSel.value));

    function renderStats() {
      stats.innerHTML = '<div><b>' + realCount + '</b><span>members on the map</span></div>'
        + (unplaced ? '<div><b>' + unplaced + '</b><span>in cities not yet mapped</span></div>' : '')
        + (sampleShown ? '<p class="uc-map-note">Includes sample dots (marked) while the circle fills up.</p>' : '');
    }

    function select(b) {
      const where = (b.area ? b.area + ', ' : '') + b.city;
      const real = b.people.filter((p) => !p.sample);
      const samples = b.people.length - real.length;
      if (b.layer === 'students') {
        panel.innerHTML = '<div class="uc-eyebrow"><i class="uc-map-dot blue"></i>Student exchange</div>'
          + '<h3 class="uc-serif">' + esc(where) + '</h3>'
          + '<p><b>' + b.people.length + '</b> from <b>' + esc(b.tutorial || 'this course') + '</b> here this term'
          + (samples ? ' <span class="uc-map-chip">sample</span>' : '') + '.</p>'
          + '<p class="uc-map-note">Tutorial groups appear here once students add their course to their profile.</p>';
        return;
      }
      const mentors = b.people.filter((p) => p.mentor).length;
      let html = '<div class="uc-eyebrow"><i class="uc-map-dot red"></i>Alumni</div>'
        + '<h3 class="uc-serif">' + esc(where) + '</h3>'
        + '<p><b>' + b.people.length + '</b> ' + (b.people.length === 1 ? 'alumnus' : 'alumni')
        + (mentors ? ' · <b>' + mentors + '</b> open to mentoring' : '')
        + (samples ? ' <span class="uc-map-chip">' + (real.length ? samples + ' sample' : 'sample') + '</span>' : '') + '</p>';
      if (real.length) {
        html += '<ul class="uc-map-people">' + real.slice(0, 8).map((p) =>
          '<li><button type="button" class="uc-map-person" data-q="' + esc(p.name) + '">' + esc(p.name || 'Member')
          + '</button>' + (p.mentor ? '<span class="uc-map-chip">mentor</span>' : '')
          + (p.programme ? '<small>' + esc(p.programme) + '</small>' : '') + '</li>').join('') + '</ul>';
      }
      html += '<div class="uc-map-actions">'
        + '<button type="button" class="uc-btn-dark" data-go="network">People in ' + esc(b.city) + '</button>'
        + (mentors ? '<button type="button" class="uc-btn-ghost" data-go="mentoring">Mentors</button>' : '')
        + '<button type="button" class="uc-btn-ghost" data-go="events">Events</button></div>';
      panel.innerHTML = html;
      panel.querySelectorAll('[data-q]').forEach((x) => x.addEventListener('click', () => UCP.go('network', { q: x.dataset.q })));
      panel.querySelectorAll('[data-go]').forEach((x) => x.addEventListener('click', () => {
        const page = x.dataset.go;
        UCP.go(page, page === 'mentoring' ? { q: b.city } : { city: b.city });
      }));
    }

    // Data: real members (directory is auth-only) + labelled samples if sparse.
    (async function load() {
      let pts = [];
      const me = UCP.user();
      if (me && UCP.online()) {
        try {
          const r = await UCP.api('GET', '/api/collections/users/records?perPage=500&fields=id,name,location,degree,mentor');
          pts = (r.items || []).filter((u) => u.location).map((u) => ({
            layer: 'alumni', city: u.location, id: u.id, name: u.name, programme: u.degree, mentor: !!u.mentor,
          }));
        } catch (e) { /* fall back to samples */ }
        const myCity = me.location && window.UCMap.matchCity(me.location);
        root.querySelector('[data-my-dot]').textContent = me.location
          ? (myCity ? 'You appear as part of the ' + myCity + ' dot — city level only.' : 'Your city “' + me.location + '” isn’t on the map yet; we add cities as members join.')
          : 'Add your city to your profile to appear on the map (city only — never your street).';
      }
      realCount = pts.length;
      const samples = window.UCMap.samplePoints().filter((p) => p.layer === 'students' || realCount < 25);
      sampleShown = samples.length > 0;
      m.setPoints(pts.concat(samples));
      tutSel.innerHTML = '<option value="">All tutorial groups</option>'
        + m.tutorials().map((t) => '<option>' + esc(t) + '</option>').join('');
      setLayer(layer);
      const city = params.get('city');
      if (city && !m.flyToCity(city)) UCP.toast('No dot for “' + esc(city) + '” yet.', 'warn');
    })();
  };
})();
