/* UniCircle — student-exchange.html: illustrative map preview.
   Blue = students grouped by tutorial; optional red = alumni, limited to the
   cities where the selected tutorial group is. Sample data only (UCMap.samplePoints). */
(function () {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function where(b) { return (b.area ? b.area + ', ' : '') + b.city; }

  function init() {
    const el = document.getElementById('ex-leaflet');
    const panel = document.getElementById('ex-panel');
    const select = document.getElementById('ex-tutorial');
    const alumniBtn = document.getElementById('ex-alumni');
    const summary = document.getElementById('ex-summary');
    const groupList = document.getElementById('ex-groups');
    if (!el || !window.UCMap || !window.L) {
      if (summary) summary.textContent = 'The map preview could not load. The steps below explain how it works.';
      return;
    }

    const all = window.UCMap.samplePoints();
    const students = all.filter((p) => p.layer === 'students');
    const alumni = all.filter((p) => p.layer === 'alumni');
    let tutorial = '';
    let showAlumni = false;
    let lastBuckets = [];
    let fit = false;
    const startZoom = el.clientWidth < 520 ? 3 : 4;

    const map = window.UCMap.create(el, {
      layers: ['students'], zoom: startZoom, center: [49.5, 9],
      onSelect: select_,
      onRender(r) {
        lastBuckets = r.buckets;
        const sb = r.buckets.filter((b) => b.layer === 'students');
        const nStudents = sb.reduce((s, b) => s + b.people.length, 0);
        const cities = new Set(sb.map((b) => b.city));
        const nAlumni = r.buckets.filter((b) => b.layer === 'alumni').reduce((s, b) => s + b.people.length, 0);
        summary.textContent = 'Showing ' + nStudents + ' sample student' + (nStudents === 1 ? '' : 's') + ' in ' + cities.size + (cities.size === 1 ? ' city' : ' cities')
          + (showAlumni ? ' and ' + nAlumni + ' sample alumni in those cities.' : '.');
        groupList.innerHTML = sb
          .sort((a, b) => a.city.localeCompare(b.city))
          .map((b) => '<button type="button" class="uc-chip" data-i="' + r.buckets.indexOf(b) + '">' + esc(where(b)) + ' · ' + b.people.length + '</button>')
          .join(' ');
        if (fit && sb.length) {
          fit = false;
          map.map.fitBounds(sb.map((b) => [b.lat, b.lng]), { padding: [40, 40], maxZoom: 6 });
        }
      },
    });
    if (!map) return;

    // Alumni are only shown in the cities where the (selected) tutorial group has students.
    function rebuild() {
      const pool = tutorial ? students.filter((p) => p.tutorial === tutorial) : students;
      const cities = new Set(pool.map((p) => p.city));
      map.setPoints(students.concat(showAlumni ? alumni.filter((p) => cities.has(p.city)) : []));
    }

    function select_(b) {
      const n = b.people.length;
      if (b.layer === 'students') {
        const others = lastBuckets.filter((x) => x.layer === 'students' && x.city === b.city && x !== b);
        const nearbyAlumni = alumni.filter((p) => p.city === b.city);
        const mentors = nearbyAlumni.filter((p) => p.mentor).length;
        panel.innerHTML = '<div class="uc-eyebrow"><span class="uc-s-dot blue" aria-hidden="true"></span>Student exchange · sample</div>'
          + '<h3>' + n + ' from ' + esc(b.tutorial) + '</h3>'
          + '<p>in <b>' + esc(where(b)) + '</b> this term.</p>'
          + (others.length ? '<p style="margin-top:10px;">One district over: ' + others.map((o) => o.people.length + ' from ' + esc(o.tutorial) + ' in ' + esc(o.area || o.city)).join('; ') + '.</p>' : '')
          + '<p style="margin-top:10px;">' + (nearbyAlumni.length
            ? '<span class="uc-s-dot red" aria-hidden="true"></span>' + nearbyAlumni.length + ' sample alumni live in ' + esc(b.city) + (mentors ? ', ' + mentors + ' open to mentoring' : '') + '.'
            : 'No sample alumni in ' + esc(b.city) + ' yet.') + '</p>'
          + '<p class="uc-s-note">In the app: message the group, plan a study session, swap flat tips.</p>';
      } else {
        const mentors = b.people.filter((p) => p.mentor).length;
        panel.innerHTML = '<div class="uc-eyebrow"><span class="uc-s-dot red" aria-hidden="true"></span>Alumni · sample</div>'
          + '<h3>' + n + ' ' + (n === 1 ? 'alumnus' : 'alumni') + '</h3>'
          + '<p>in <b>' + esc(where(b)) + '</b>' + (mentors ? ', ' + mentors + ' open to mentoring' : '') + '.</p>'
          + '<p class="uc-s-note">In the app: ask about neighbourhoods, landlords or the local job market.</p>';
      }
    }

    // Tutorial filter
    map.setPoints(students);
    map.tutorials().forEach((t) => {
      const o = document.createElement('option');
      o.value = t; o.textContent = t;
      select.appendChild(o);
    });
    select.addEventListener('change', () => {
      tutorial = select.value;
      map.setTutorial(tutorial);
      fit = true;
      rebuild();
      if (!tutorial) map.map.setView([49.5, 9], startZoom);
      panel.innerHTML = '<div class="uc-eyebrow"><span class="uc-s-dot blue" aria-hidden="true"></span>' + (tutorial ? esc(tutorial) : 'All tutorial groups') + '</div>'
        + '<p>' + (tutorial ? 'These are the cities this group is spread across this term. Tap a dot to see who is where.' : 'Every blue dot is a tutorial group in a neighbourhood. Tap one to see who is there.') + '</p>';
    });

    // Alumni toggle
    alumniBtn.addEventListener('click', () => {
      showAlumni = !showAlumni;
      alumniBtn.setAttribute('aria-pressed', String(showAlumni));
      alumniBtn.classList.toggle('active', showAlumni);
      alumniBtn.textContent = showAlumni ? 'Hide alumni in these cities' : 'Also show alumni in these cities';
      map.setLayers(showAlumni ? ['students', 'alumni'] : ['students']);
      rebuild();
    });

    // Keyboard / screen-reader alternative to clicking dots
    groupList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-i]');
      if (!btn) return;
      const b = lastBuckets[Number(btn.dataset.i)];
      if (b) { select_(b); map.map.setView([b.lat, b.lng], 9); }
    });

    // Leaflet needs a size recalculation once the map is actually visible.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { map.invalidate(); o.disconnect(); } }).observe(el);
    } else {
      map.invalidate();
    }
  }

  if (window.L) init(); else window.addEventListener('load', init);
})();
