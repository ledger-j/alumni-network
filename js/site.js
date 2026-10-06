/* ==========================================================================
   UniCircle — public in-depth pages (map.html, mentoring.html, …)
   One source for the frame: nav, closing waitlist card and footer are rendered
   into placeholders so every page stays identical.

   Page contract:
     <body data-page="map" data-source="page-map">
       <div data-site-nav></div>
       …page content (use classes from css/site.css)…
       <div data-site-cta data-title="Optional heading"></div>
       <div data-site-footer></div>
   Scripts: js/uc-waitlist-form.js then js/site.js (both defer).
   ========================================================================== */
(function () {
  'use strict';

  const PAGES = [
    ['map', 'The map', 'map.html'],
    ['mentoring', 'Mentoring', 'mentoring.html'],
    ['exchange', 'Student exchange', 'student-exchange.html'],
    ['universities', 'For universities', 'universities.html'],
    ['about', 'About', 'about.html'],
  ];
  const page = document.body.dataset.page || '';
  const source = document.body.dataset.source || ('page-' + page);

  // ---- nav ----
  const nav = document.querySelector('[data-site-nav]');
  if (nav) {
    nav.outerHTML = '<header class="uc-s-navwrap"><nav class="uc-navpill uc-s-nav" aria-label="Main">'
      + '<a class="uc-s-brand" href="index.html"><img src="assets/img/logo-circle.jpg" alt=""><span>UniCircle</span></a>'
      + '<button type="button" class="uc-s-burger" aria-expanded="false" aria-controls="uc-s-links" aria-label="Menu"><span></span><span></span></button>'
      + '<div class="uc-s-links" id="uc-s-links">'
      + PAGES.map((p) => '<a href="' + p[2] + '"' + (p[0] === page ? ' aria-current="page"' : '') + '>' + p[1] + '</a>').join('')
      + '</div>'
      + '<div class="uc-s-actions"><a class="uc-s-signin" href="index.html">Sign in</a>'
      + '<a class="uc-btn-dark" href="#join">Join the waitlist</a></div>'
      + '</nav></header>';
    const burger = document.querySelector('.uc-s-burger');
    const links = document.getElementById('uc-s-links');
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') !== 'true';
      burger.setAttribute('aria-expanded', open);
      links.classList.toggle('open', open);
    });
  }

  // ---- closing waitlist card ----
  const cta = document.querySelector('[data-site-cta]');
  if (cta) {
    const title = cta.dataset.title || 'Be first in the circle.';
    cta.outerHTML = '<section class="uc-s-cta" id="join"><div class="uc-s-cta-inner">'
      + '<div class="uc-s-cta-copy"><div class="uc-eyebrow">Waitlist · opening in waves</div>'
      + '<h2 class="uc-serif">' + title + '</h2>'
      + '<p>We open city by city. Tell us who you are and where you are — that’s all we need to put you on the map when your city opens.</p></div>'
      + '<div class="uc-login-card uc-s-wl">'
      + '<form id="site-wl" class="uc-form" novalidate>'
      + '<div class="uc-eyebrow" style="text-align:left;">I am</div>'
      + '<div class="uc-tabs" role="radiogroup" aria-label="I am">'
      + '<button type="button" class="uc-tab active" data-role="alumnus" role="radio" aria-checked="true">Alumnus</button>'
      + '<button type="button" class="uc-tab" data-role="student" role="radio" aria-checked="false">Student</button>'
      + '<button type="button" class="uc-tab" data-role="university_staff" role="radio" aria-checked="false">University</button></div>'
      + '<input name="email" type="email" placeholder="Email address" autocomplete="email" required class="uc-input-pill">'
      + '<input name="city" type="text" placeholder="City (for the map)" autocomplete="address-level2" required class="uc-input-pill" maxlength="80">'
      + '<label class="uc-s-consent"><input type="checkbox" name="consent" required><span>Email me when my spot opens. Unsubscribe any time. <a href="privacy.html">Privacy</a></span></label>'
      + '<button class="uc-btn-dark uc-wl-submit" type="submit">Join the waitlist →</button>'
      + '<p class="uc-err" role="alert" hidden></p></form>'
      + '<div class="uc-s-done" id="site-wl-done" hidden tabindex="-1"><div class="uc-s-done-mark" aria-hidden="true">✓</div>'
      + '<h3 class="uc-serif">You’re in the circle.</h3><p data-done-msg></p>'
      + '<button type="button" class="uc-btn-ghost" data-share>Copy invite link</button></div>'
      + '</div></div></section>';
    if (window.UCWaitlist) {
      window.UCWaitlist.mount(document.getElementById('site-wl'), document.getElementById('site-wl-done'), { source });
    }
  }

  // ---- footer ----
  const foot = document.querySelector('[data-site-footer]');
  if (foot) {
    foot.outerHTML = '<footer class="uc-footer-dark uc-s-footer"><div class="uc-s-footer-inner">'
      + '<div class="uc-s-footer-top"><a class="uc-s-brand uc-s-brand--light" href="index.html"><img src="assets/img/logo-circle.jpg" alt=""><span class="uc-serif">UniCircle</span></a>'
      + '<nav class="uc-s-footer-links" aria-label="Footer">' + PAGES.map((p) => '<a href="' + p[2] + '">' + p[1] + '</a>').join('')
      + '<a href="waitlist.html">Waitlist</a></nav></div>'
      + '<div class="uc-s-rule"></div>'
      + '<div class="uc-s-footer-bottom"><span>© 2026 UniCircle · unicircle.eu · a Beyond Borders Marketing Consultancy project</span>'
      + '<span><a href="privacy.html">Privacy</a> · <a href="mailto:hello@unicircle.eu">Contact</a> · <a href="index.html">Sign in</a></span></div>'
      + '</div></footer>';
  }

  // Smooth-scroll in-page anchors (nav "Join the waitlist" → #join), focus the form.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const el = document.getElementById(a.getAttribute('href').slice(1));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (a.getAttribute('href') === '#join') setTimeout(() => el.querySelector('input[name=email]')?.focus({ preventScroll: true }), 500);
    document.getElementById('uc-s-links')?.classList.remove('open');
  });

  // Reveal-on-scroll for .uc-s-reveal blocks (respects reduced motion).
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('.uc-s-reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.uc-s-reveal').forEach((el) => el.classList.add('in'));
  }
})();
