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
    // Must be set up before the shared form below. A form with [data-step] panes (the closing form,
    // 16 Oct) first gets the same three steps as waitlist-v2.html; other forms are left as they are.
    if (survey) survey.steps(form, done);
    let joined = () => {};
    if (survey && $('.uc-v2-inline-q', form)) joined = survey.inline(form, done, { source });
    else if (survey) survey.handoff(form, done, { source });
    window.UCWaitlist.mount(form, done, {
      source: fallback,
      extra: joined.answers,   // the answers ride along in the same sign-up request
      onDone(body, dup) {
        // Put the new signup on the preview map as their own (local-only) dot.
        if (preview) preview.addPoints([{ layer: body.role === 'student' ? 'students' : 'alumni', city: body.city, area: body.neighbourhood, tutorial: 'Your tutorial', you: true }]);
        // The spot and the answers are saved: say thank you for the answers.
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
  // Links to the waitlist page (nav, hero, footer) keep this visit's channel tag and test settings,
  // the same ones the hero form's hand-off forwards (js/uc-survey-v2.js → handoff).
  $$('a[href^="waitlist-v2.html"]').forEach((a) => {
    const to = new URL(a.getAttribute('href'), location.href);
    ['ref', 'utm_source', 'api', 'survey'].forEach((k) => { if (qs.get(k)) to.searchParams.set(k, qs.get(k)); });
    a.href = to.href;
  });

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

  // ---- hero dots: shared engine (js/uc-constellation.js); warm hue family, no link lines, side margins via css/v2.css ----
  if (window.UCConstellation) {
    window.UCConstellation.mount($('#v2-constellation'), {
      count: 220, linkAlpha: 0, pointer: false, pull: { x: 0.5, y: 0.5 },
      palette: ['oklch(0.62 0.14 25)', 'oklch(0.66 0.14 45)', 'oklch(0.6 0.13 15)', 'oklch(0.68 0.12 70)'],
      wash: 'rgba(250,249,246,0.28)', bg: '#faf9f6',
    });
  }

  // Smooth scrolling only once the page has loaded, so a link that arrives at a
  // chapter (landing-v2.html#about) lands there directly instead of gliding down.
  window.addEventListener('load', () => setTimeout(() => document.documentElement.classList.add('uc-v2-doc'), 300));

  if (window.L) initMap(); else window.addEventListener('load', initMap);
})();
