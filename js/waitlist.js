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

  // ---- constellation (same field as the landing hero, lighter) ----
  function constellation(canvas, count) {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const pal = ['oklch(0.62 0.14 235)', 'oklch(0.62 0.14 275)', 'oklch(0.62 0.14 305)', 'oklch(0.62 0.14 25)'];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    let ps = [];
    const size = () => {
      const was = W;
      W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // First real layout after a hidden/zero-size start: spread the swarm over the new area.
      if (was < 200 && W >= 200) ps.forEach((p) => { p.x = Math.random() * W; p.y = Math.random() * H; });
    };
    size(); window.addEventListener('resize', size);
    ps = Array.from({ length: count }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: Math.random() - .5, vy: Math.random() - .5, s: Math.random() * 3 + 1.2, c: pal[(Math.random() * pal.length) | 0], a: Math.random() * .35 + .3, o: Math.random() * 6.28 }));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = (t) => {
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(250,249,246,0.28)'; ctx.fillRect(0, 0, W, H);
      for (const p of ps) {
        const a = Math.sin(p.y * .004 + t * .0004 + p.o) + Math.cos(p.x * .003 - t * .0003);
        p.vx += Math.cos(a) * .03; p.vy += Math.sin(a) * .03;
        const dx = W / 2 - p.x, dy = H * .5 - p.y, d = Math.hypot(dx, dy) || 1;
        p.vx += dx / d * .006; p.vy += dy / d * .006; p.vx *= .96; p.vy *= .96; p.x += p.vx; p.y += p.vy;
        ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.roundRect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2, p.s * .7); ctx.fill();
      }
      if (!reduced) requestAnimationFrame(step);
    };
    ctx.fillStyle = '#faf9f6'; ctx.fillRect(0, 0, W, H);
    requestAnimationFrame(step);
  }

  constellation(document.getElementById('wl-constellation'), 220);
  if (window.L) initMap(); else window.addEventListener('load', initMap);
})();
