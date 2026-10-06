/* UniCircle waitlist page — form → PocketBase `waitlist` collection, map preview.
   API base: ?api=… (remembered) → localStorage uc_api_base → https://api.unicircle.eu
   Channel tracking: ?ref=… or ?utm_source=… is stored as `source` on the row. */
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  let API = 'https://api.unicircle.eu';
  try {
    if (qs.get('api')) localStorage.setItem('uc_api_base', qs.get('api'));
    API = (localStorage.getItem('uc_api_base') || API).replace(/\/$/, '');
  } catch (e) { /* storage blocked: use default */ }
  const SOURCE = (qs.get('ref') || qs.get('utm_source') || 'waitlist-page').slice(0, 60);

  const form = document.getElementById('wl');
  const done = document.getElementById('wl-done');
  const err = form.querySelector('.uc-err');
  let role = 'alumnus';

  // ---- role tabs: show the fields + interests that fit the role ----
  function setRole(r) {
    role = r;
    form.querySelectorAll('[data-role]').forEach((b) => {
      const on = b.dataset.role === r;
      b.classList.toggle('active', on); b.setAttribute('aria-checked', on);
    });
    form.querySelectorAll('[data-for]').forEach((el) => {
      const show = el.dataset.for === r;
      el.hidden = !show;
      if (!show) el.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = false; });
    });
    if (r === 'student') {
      form.querySelector('input[value=find_a_mentor]').checked = true;
      form.querySelector('input[value=student_exchange]').checked = true;
    } else if (r === 'alumnus') {
      form.querySelector('input[value=mentor_others]').checked = true;
    }
  }
  form.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => setRole(b.dataset.role)));
  // Arrow-key support for the radiogroup
  form.querySelector('[role=radiogroup]').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = [...form.querySelectorAll('[data-role]')];
    const i = tabs.findIndex((t) => t.dataset.role === role);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    setRole(next.dataset.role); next.focus();
  });

  function showErr(msg) { err.textContent = msg; err.hidden = false; }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const f = form.elements;
    const email = f.email.value.trim();
    const city = f.city.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { f.email.focus(); return showErr('Please enter a valid email address.'); }
    if (!city) { f.city.focus(); return showErr('Which city are you in? City is enough — no street needed.'); }
    if (!f.consent.checked) { f.consent.focus(); return showErr('Please tick the box so we can email you when your spot opens.'); }

    const body = {
      email, role, city,
      name: f.name.value.trim(),
      institution: f.institution.value.trim(),
      neighbourhood: f.neighbourhood.value.trim(),
      programme: (role === 'student' ? f.programme_s.value : f.programme.value).trim(),
      grad_year: role === 'alumnus' ? f.grad_year.value.trim() : '',
      tutorial: role === 'student' ? f.tutorial.value.trim() : '',
      interests: [...form.querySelectorAll('input[name=interests]:checked')].map((c) => c.value),
      consent: true,
      source: SOURCE,
    };
    if (body.grad_year && !/^\d{4}$/.test(body.grad_year)) { f.grad_year.focus(); return showErr('Graduation year should look like 2018.'); }

    const btn = form.querySelector('.uc-wl-submit');
    btn.disabled = true; btn.textContent = 'Joining…';
    try {
      const res = await fetch(API + '/api/collections/waitlist/records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      const dup = res.status === 400 && data.data && data.data.email && /unique/i.test(data.data.email.code || '');
      if (res.ok || dup) {
        finish(body, dup);
      } else if (res.status === 404) {
        showErr('The waitlist opens in a moment — please try again shortly, or email hello@unicircle.eu.');
      } else {
        showErr((data && data.message) || 'Something went wrong. Please try again.');
      }
    } catch (x) {
      showErr('Could not reach UniCircle — check your connection and try again.');
    } finally {
      btn.disabled = false; btn.textContent = 'Join the waitlist →';
    }
  });

  function finish(body, dup) {
    form.hidden = true; done.hidden = false;
    const first = (body.name || '').split(/\s+/)[0];
    document.getElementById('wl-done-msg').textContent = dup
      ? 'You were already on the list — we’ll email you as soon as your spot opens.'
      : (first ? first + ', w' : 'W') + 'e’ll email you as soon as your spot opens in ' + body.city + '.';
    done.focus();
    // Put the new signup on the preview map as their own (local-only) dot.
    if (preview) {
      preview.addPoints([{ layer: body.role === 'student' ? 'students' : 'alumni', city: body.city, area: body.neighbourhood, tutorial: body.tutorial || 'Your tutorial', you: true }]);
    }
  }

  document.getElementById('wl-share').addEventListener('click', async () => {
    const url = location.origin + location.pathname + '?ref=friend';
    try {
      if (navigator.share) await navigator.share({ title: 'UniCircle', text: 'Join me on the UniCircle waitlist', url });
      else { await navigator.clipboard.writeText(url); document.getElementById('wl-share').textContent = 'Link copied ✓'; }
    } catch (e) { /* user cancelled share */ }
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

  setRole('alumnus');
  constellation(document.getElementById('wl-constellation'), 220);
  if (window.L) initMap(); else window.addEventListener('load', initMap);
})();
