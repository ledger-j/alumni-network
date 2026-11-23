/* UniCircle — V2 waitlist page (waitlist-v2.html). Copy of js/waitlist.js (map
   preview + constellation unchanged) with the pitch additions: a channel tag per
   visit, the invited-mentor line, and the after-sign-up step (what happens next,
   optional founder video) and Priestley's five questions before the spot is saved
   (js/uc-survey-v2.js). Since 16 Oct the form runs in steps (js/uc-survey-v2.js → steps). */
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  // One tag per channel (?ref=maxime-linkedin, ?ref=assoc-<name>, …) so answers can
  // be read per channel. Same rule as the shared form: ?ref / ?utm_source win.
  const REF = (qs.get('ref') || qs.get('utm_source') || '').slice(0, 60);
  const S = window.UCSurveyV2;
  // Coming from a landing page's hero form: role, email, city and consent are filled in, and the
  // sign-up keeps that form's tag (landing-v2-hero, …) so the channel stays readable.
  const form = document.getElementById('wl');
  const done = document.getElementById('wl-done');
  const handed = S ? S.prefill(form) : null;
  const SOURCE = REF || (handed && handed.source) || 'waitlist-v2';
  const survey = document.getElementById('wl-survey');

  // Personal invites to senior alumni use the same page with a different first line
  // (proposal 1.4; who picks the invitees is still open: [NEEDS]).
  if (REF === 'vip-linkedin') {
    document.getElementById('wl-kicker').textContent = 'You’ve been invited to the founding mentor circle';
  }
  // Only mention the questions when they are actually switched on.
  if (S && S.enabled(survey)) {
    document.querySelectorAll('[data-survey-only]').forEach((el) => { el.hidden = false; });
    document.querySelectorAll('[data-survey-off]').forEach((el) => { el.hidden = true; });
  }
  if (S) S.bindShare(document.querySelector('[data-share-v2]'));

  // The form runs in steps (about you → the questions → save your spot; js/uc-survey-v2.js → steps,
  // shared with the landing page's closing form). Set up first, so its submit check runs before the
  // questions' check and the shared form's save below.
  if (S) S.steps(form, done);

  // Priestley's five questions, rendered into step 2 and answered before the spot is
  // saved (no-op while switched off). Must be set up before the shared form below.
  const joined = S ? S.inline(form, done, { source: SOURCE }) : function () {};

  // Came from a hero form: say what's left (their name) and bring the form into view.
  const handoffNote = document.getElementById('wl-handoff');
  if (handed && handoffNote && S && S.enabled(survey)) {
    handoffNote.hidden = false;
    requestAnimationFrame(() => handoffNote.scrollIntoView({ block: 'center' }));
  }

  // Form logic is shared with the landing hero (V2 copy: js/uc-waitlist-form-v2.js). The answers
  // ride along in the same sign-up request (`extra`; nothing while the questions are off).
  window.UCWaitlist.mount(form, done, {
    source: SOURCE,
    extra: joined.answers,
    onDone(body, dup) {
      // Put the new signup on the preview map as their own (local-only) dot.
      if (preview) {
        preview.addPoints([{ layer: body.role === 'student' ? 'students' : 'alumni', city: body.city, area: body.neighbourhood, tutorial: body.tutorial || 'Your tutorial', you: true }]);
      }
      // Founder video: only once a real clip exists (data-src on #wl-video).
      const video = document.getElementById('wl-video');
      if (video && video.dataset.src) {
        const v = document.createElement('video');
        v.controls = true; v.playsInline = true; v.preload = 'metadata'; v.src = video.dataset.src;
        video.appendChild(v); video.hidden = false;
      }
      // The spot and the answers are saved: say thank you for the answers.
      joined(body, dup);
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
