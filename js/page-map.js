/* map.html — interactive preview (sample data) with alumni / students / both layers. */
(function () {
  'use strict';
  const el = document.getElementById('map-demo');
  const panel = document.getElementById('map-panel');
  if (!el || !window.UCMap || !window.L) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const m = window.UCMap.create(el, {
    layers: ['alumni'], zoom: 4,
    onSelect(b) {
      const n = b.people.length;
      const where = (b.area ? b.area + ', ' : '') + b.city;
      if (b.layer === 'students') {
        panel.innerHTML = '<div class="uc-eyebrow"><span class="uc-s-dot blue"></span>Students</div>'
          + '<h3 class="uc-serif" style="font-weight:400;font-size:28px;margin:10px 0 6px;">' + esc(where) + '</h3>'
          + '<p><b>' + n + '</b> from <b>' + esc(b.tutorial) + '</b> here this term.</p>'
          + '<p style="margin-top:10px;"><a href="student-exchange.html" style="text-decoration:underline;">How student exchange works →</a></p>';
      } else {
        const mentors = b.people.filter((p) => p.mentor).length;
        panel.innerHTML = '<div class="uc-eyebrow"><span class="uc-s-dot red"></span>Alumni</div>'
          + '<h3 class="uc-serif" style="font-weight:400;font-size:28px;margin:10px 0 6px;">' + esc(where) + '</h3>'
          + '<p><b>' + n + '</b> ' + (n === 1 ? 'alumnus' : 'alumni') + ' in this neighbourhood'
          + (mentors ? ', <b>' + mentors + '</b> open to mentoring' : '') + '.</p>'
          + (mentors ? '<p style="margin-top:10px;"><a href="mentoring.html" style="text-decoration:underline;">How mentoring works →</a></p>' : '');
      }
    },
  });
  if (!m) return;
  m.setPoints(window.UCMap.samplePoints());

  const btns = [...document.querySelectorAll('[data-layer]')];
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on); });
    m.setLayers(b.dataset.layer === 'both' ? ['alumni', 'students'] : [b.dataset.layer]);
  }));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { m.invalidate(); o.disconnect(); } }).observe(el);
  }
})();
