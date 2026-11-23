/* UniCircle waitlist page — map preview + constellation; the form itself is
   js/uc-waitlist-form.js (shared with the landing hero). */
(function () {
  'use strict';
  // Form logic is shared with the landing hero (js/uc-waitlist-form.js).
  window.UCWaitlist.mount(document.getElementById('wl'), document.getElementById('wl-done'), {
    source: 'waitlist-page',
    onDone(body) {
      // Put the new signup on the preview map as their own (local-only) dot.
      if (preview) {
        preview.addPoints([{ layer: body.role === 'student' ? 'students' : 'alumni', city: body.city, area: body.neighbourhood, tutorial: body.tutorial || 'Your tutorial', you: true }]);
      }
    },
  });

  // ---- map preview ----
  let preview = null;
  function initMap() {
    if (!window.UCMap || !window.L) return;
    const panel = document.getElementById('wl-map-panel');
    preview = window.UCMap.create(document.getElementById('wl-leaflet'), {
      layers: ['alumni'], zoom: 4,
      onSelect(b) {
        const n = b.people.length, mentors = b.people.filter((p) => p.mentor).length;
        const where = (b.area ? b.area + ', ' : '') + b.city;
        panel.innerHTML = b.layer === 'students'
          ? '<div class="uc-eyebrow"><i class="dot blue"></i>Student exchange</div><h3 class="uc-serif">' + esc(where) + '</h3><p><b>' + n + '</b> from <b>' + esc(b.tutorial) + '</b> are here this term.</p><p class="uc-wl-note">In the app you can message the group and plan a study session.</p>'
          : '<div class="uc-eyebrow"><i class="dot red"></i>Alumni</div><h3 class="uc-serif">' + esc(where) + '</h3><p><b>' + n + '</b> ' + (n === 1 ? 'alumnus' : 'alumni') + ' in this neighbourhood' + (mentors ? ', <b>' + mentors + '</b> open to mentoring' : '') + '.</p><p class="uc-wl-note">In the app: see who, filter by programme, ask for a coffee.</p>';
      },
    });
    if (!preview) return;
    preview.setPoints(window.UCMap.samplePoints());
    document.querySelectorAll('.uc-wl-toggle [data-layer]').forEach((b) => b.addEventListener('click', () => {
      const btns = [...document.querySelectorAll('.uc-wl-toggle [data-layer]')];
      btns.forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on); });
      preview.setLayers([b.dataset.layer]);
      panel.innerHTML = b.dataset.layer === 'students'
        ? '<div class="uc-eyebrow"><i class="dot blue"></i>Student exchange</div><p>Blue dots are students, grouped by tutorial. Tap one to see who from your course is in that city.</p>'
        : '<div class="uc-eyebrow"><i class="dot red"></i>Alumni</div><p>Red dots are alumni, one per neighbourhood. Bigger dot, more people.</p>';
    }));
    // Lazy-size fix when the map scrolls into view
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { preview.invalidate(); o.disconnect(); } }).observe(document.getElementById('wl-leaflet'));
    }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---- constellation: shared engine (js/uc-constellation.js), default blue/violet palette ----
  if (window.UCConstellation) {
    window.UCConstellation.mount(document.getElementById('wl-constellation'), {
      count: 160, pointer: false, pull: { x: 0.5, y: 0.5 }, wash: 'rgba(250,249,246,0.28)', bg: '#faf9f6',
    });
  }
  if (window.L) initMap(); else window.addEventListener('load', initMap);
})();
