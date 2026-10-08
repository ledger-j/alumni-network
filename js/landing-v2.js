/* UniCircle — V2 one-page landing (landing-v2.html).
   The whole public site as one long page: nav links scroll to chapters instead of
   opening separate pages. The form (js/uc-waitlist-form.js) and the map
   (js/uc-map.js) are the shared V1 modules, loaded unchanged. Priestley's five
   questions (before the spot is saved) and the invite link come from js/uc-survey-v2.js. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  // ↑ or ↓ depending on where #id sits relative to el (the two landing pages order chapters differently).
  const arrowTo = (id, el) => {
    const t = document.getElementById(id);
    return t && (t.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ? '↑' : '↓';
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- waitlist forms (hero: quick · closing: full) ----
  let preview = null;
  const survey = window.UCSurveyV2; // js/uc-survey-v2.js; the page still works if it failed to load
  const qs = new URLSearchParams(location.search);
  // Same rule as the shared form, so the answers carry the same channel tag as the sign-up.
  const sourceFor = (fallback) => (qs.get('ref') || qs.get('utm_source') || fallback).slice(0, 60);

  function mountForm(form, done, fallback) {
    if (!form || !done) return;
    const source = sourceFor(fallback);
    const surveyEl = $('.uc-v2-survey', done);
    // The "five questions" note only shows while the questions are switched on.
    if (survey && survey.enabled(surveyEl)) {
      $$('[data-survey-only]').forEach((el) => { el.hidden = false; });
      $$('[data-survey-off]').forEach((el) => { el.hidden = true; });
    }
    if (!window.UCWaitlist) return;
    // Priestley's questions before the spot is saved (no-op while switched off): shown right
    // in the form when it has a .uc-v2-inline-q box (closing form); the short hero form
    // instead takes the visitor to waitlist-v2.html, details filled in, to answer them there.
    // Must be set up before the shared form below.
    let joined = () => {};
    if (survey && $('.uc-v2-inline-q', form)) joined = survey.inline(form, done, { source });
    else if (survey) survey.handoff(form, done, { source });
    window.UCWaitlist.mount(form, done, {
      source: fallback,
      onDone(body, dup) {
        // Put the new signup on the preview map as their own (local-only) dot.
        if (preview) preview.addPoints([{ layer: body.role === 'student' ? 'students' : 'alumni', city: body.city, area: body.neighbourhood, tutorial: 'Your tutorial', you: true }]);
        // The spot is saved: store the answers given before it next to it.
        joined(body, dup);
      },
    });
  }
  // Sign-ups are tagged per page and form (landing-v2-hero, landing-brunson-v2-join, …).
  const page = location.pathname.split('/').pop().replace(/\.html$/, '') || 'landing-v2';
  mountForm($('#v2-wl-hero'), $('#v2-wl-hero-done'), page + '-hero');
  mountForm($('#v2-wl-join'), $('#v2-wl-join-done'), page + '-join');
  // Invite link → this page (the shared form's own share button points at waitlist.html).
  if (survey) $$('[data-share-v2]').forEach((b) => survey.bindShare(b));

  // ---- nav: burger, close on tap, highlight the chapter in view ----
  const burger = $('.uc-s-burger');
  const links = $('#uc-s-links');
  if (burger && links) {
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') !== 'true';
      burger.setAttribute('aria-expanded', open);
      links.classList.toggle('open', open);
    });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    if (links) links.classList.remove('open');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    if (a.dataset.showLayer) setLayer(a.dataset.showLayer);
    if (a.getAttribute('href') === '#join') setTimeout(() => $('#join input[name=email]')?.focus({ preventScroll: true }), 700);
  });
  if ('IntersectionObserver' in window && links) {
    const navLinks = $$('a[href^="#"]', links);
    const spy = new IntersectionObserver((es) => es.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => {
        if (a.getAttribute('href') === '#' + en.target.id) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    }), { rootMargin: '-45% 0px -50% 0px' });
    // Every section is watched; the ones without a nav link (hero, moments, privacy, offer,
    // questions, closing form) clear the highlight when you reach them.
    $$('main > section').forEach((el) => spy.observe(el));
  }

  // ---- proof variant: the quote only shows on landing-v2.html?quote=1 ----
  if (qs.get('quote') === '1') $$('[data-variant="quote"]').forEach((el) => { el.hidden = false; });

  // ---- reveal on scroll (respects reduced motion) ----
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -10% 0px' });
    $$('.uc-s-reveal').forEach((el) => io.observe(el));
  } else {
    $$('.uc-s-reveal').forEach((el) => el.classList.add('in'));
  }

  // ---- map preview (sample data): alumni / students / both ----
  const layerBtns = $$('#v2-map-layers [data-layer]');
  function setLayer(name) {
    layerBtns.forEach((x) => { const on = x.dataset.layer === name; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on); });
    if (preview) preview.setLayers(name === 'both' ? ['alumni', 'students'] : [name]);
  }
  layerBtns.forEach((b) => b.addEventListener('click', () => setLayer(b.dataset.layer)));

  function initMap() {
    const el = $('#v2-map');
    const panel = $('#v2-map-panel');
    if (!el || !window.UCMap || !window.L) return;
    preview = window.UCMap.create(el, {
      layers: ['alumni'], zoom: el.clientWidth < 520 ? 3 : 4,
      onSelect(b) {
        const n = b.people.length;
        const where = (b.area ? b.area + ', ' : '') + b.city;
        if (b.layer === 'students') {
          panel.innerHTML = '<div class="uc-eyebrow"><span class="uc-s-dot blue"></span>Students · sample</div>'
            + '<h3 class="uc-serif">' + esc(where) + '</h3>'
            + '<p><b>' + n + '</b> from <b>' + esc(b.tutorial) + '</b> here this term.</p>'
            + '<p style="margin-top:10px;"><a href="#exchange">When it helps ' + arrowTo('exchange', panel) + '</a></p>';
        } else {
          const mentors = b.people.filter((p) => p.mentor).length;
          panel.innerHTML = '<div class="uc-eyebrow"><span class="uc-s-dot red"></span>Alumni · sample</div>'
            + '<h3 class="uc-serif">' + esc(where) + '</h3>'
            + '<p><b>' + n + '</b> ' + (n === 1 ? 'alumnus' : 'alumni') + ' in this neighbourhood'
            + (mentors ? ', <b>' + mentors + '</b> open to mentoring' : '') + '.</p>'
            + (mentors ? '<p style="margin-top:10px;"><a href="#mentoring">How mentoring works ' + arrowTo('mentoring', panel) + '</a></p>' : '');
        }
      },
    });
    if (!preview) return;
    preview.setPoints(window.UCMap.samplePoints());
    // Leaflet needs a size recalculation once the map is actually visible.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { preview.invalidate(); o.disconnect(); } }).observe(el);
    }
  }

  // ---- hero dots (same field as the V1 heroes; css/v2.css keeps it in the side margins) ----
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
      if (W) {
        ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(250,249,246,0.28)'; ctx.fillRect(0, 0, W, H);
        for (const p of ps) {
          const a = Math.sin(p.y * .004 + t * .0004 + p.o) + Math.cos(p.x * .003 - t * .0003);
          p.vx += Math.cos(a) * .03; p.vy += Math.sin(a) * .03;
          const dx = W / 2 - p.x, dy = H * .5 - p.y, d = Math.hypot(dx, dy) || 1;
          p.vx += dx / d * .006; p.vy += dy / d * .006; p.vx *= .96; p.vy *= .96; p.x += p.vx; p.y += p.vy;
          ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.roundRect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2, p.s * .7); ctx.fill();
        }
      }
      if (!reduced) requestAnimationFrame(step);
    };
    ctx.fillStyle = '#faf9f6'; ctx.fillRect(0, 0, W, H);
    requestAnimationFrame(step);
  }

  // Smooth scrolling only once the page has loaded, so a link that arrives at a
  // chapter (landing-v2.html#about) lands there directly instead of gliding down.
  window.addEventListener('load', () => setTimeout(() => document.documentElement.classList.add('uc-v2-doc'), 300));

  constellation($('#v2-constellation'), 220);
  if (window.L) initMap(); else window.addEventListener('load', initMap);
})();
