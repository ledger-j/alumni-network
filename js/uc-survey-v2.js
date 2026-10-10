/* UniCircle — V2 waitlist questions (window.UCSurveyV2), shared by waitlist-v2.html,
   landing-v2.html (Brunson order) and landing-value-first-v2.html. Daniel Priestley's five qualification
   questions (each with "Other", plus an optional sixth) are answered BEFORE the spot is
   saved: the shared form (js/uc-waitlist-form.js, unchanged) saves the sign-up only once
   they are, then the answers go in one POST to the PocketBase `waitlist_survey`
   collection (schema: backend/waitlist_survey_schema.py).

     <div class="uc-v2-survey" data-survey="off" hidden></div>   (inside the success card)
     <div class="uc-v2-inline-q" hidden></div>                    (inside a form with the questions)
     const joined = UCSurveyV2.inline(form, done, { source });   // BEFORE UCWaitlist.mount
     UCWaitlist.mount(form, done, { onDone(body, dup) { joined(body, dup); } });
     UCSurveyV2.handoff(heroForm, heroDone, { source })          // hero form → waitlist-v2.html
     UCSurveyV2.prefill(form)       // on waitlist-v2.html, before inline(): details from the hero
     UCSurveyV2.bindShare(button)   // "Copy invite link" → the page you are on

   Off on the public site until the backend collection exists (the form then works
   exactly like V1): set data-survey="on" on the element. Always on for local previews
   and with ?survey=1. Answers are sent as short codes (e.g. obstacle: "no_reply") so
   they can be counted; `tried` is a ", " list.
   API base: same rule as js/uc-waitlist-form.js (?api=… → localStorage → live). */
(function () {
  'use strict';

  // Priestley's five, per role: situation · desired outcome · biggest obstacle · past attempts ·
  // budget (here: what each group can give). Team decisions the copy assumes: D3 (answers help
  // decide which circles open first), D5 (students get the commitment question, not
  // willingness-to-pay). Budget is follow-through (students), time (alumni), money (universities).
  const QUESTIONS = {
    student: [
      { key: 'situation', q: 'Which best describes you right now?', options: [['bachelor_first', 'First-year bachelor'], ['bachelor_later', 'Later-year bachelor'], ['master', 'Master'], ['exchange', 'On exchange'], ['graduating', 'Graduating this year']] },
      { key: 'goal', q: 'What do you most want from alumni?', options: [['sector', 'Get into a specific sector or company'], ['path', 'Choose my master or career path'], ['city', 'Settle into a new city'], ['mentor', 'Find a long-term mentor'], ['network_abroad', 'Build a network in another country']] },
      { key: 'obstacle', q: 'What stops you today?', options: [['dont_know_who', 'I don’t know who to ask'], ['no_reply', 'My messages get no reply'], ['dont_know_what', 'I don’t know what to ask'], ['out_of_reach', 'Senior alumni feel out of reach'], ['no_time', 'No time to network']] },
      { key: 'tried', many: true, q: 'What have you already tried?', options: [['linkedin', 'LinkedIn search and messages'], ['career_services', 'Career services'], ['association_events', 'Study-association events'], ['professors_friends', 'Asking professors or friends'], ['nothing', 'Nothing yet']] },
      { key: 'commitment', q: 'What would you do in return for a 20-minute call with the right alumnus?', options: [['prepare', 'Prepare 3 sharp questions'], ['follow_up', 'Send a thank-you and an update later'], ['pay_forward', 'Help a younger student the same way'], ['nothing', 'Nothing, I’d just want the call']] },
    ],
    alumnus: [
      { key: 'situation', q: 'When did you graduate?', options: [['under_5', 'Under 5 years ago'], ['5_15', '5–15 years ago'], ['over_15', '15+ years ago']], extra: { key: 'sector', placeholder: 'Your sector (optional)' } },
      { key: 'goal', q: 'Why would you join?', options: [['give_back', 'Give back to students'], ['recruit', 'Spot and recruit talent'], ['reconnect', 'Reconnect with my year'], ['city_network', 'Grow my network in my city'], ['cofounders', 'Find partners or co-founders']] },
      { key: 'obstacle', q: 'What stops you from helping students today?', options: [['cold_requests', 'Too many cold requests'], ['no_small_doses', 'No easy way to help in small doses'], ['lost_touch', 'Lost touch with the university'], ['linkedin_noisy', 'LinkedIn is too noisy']] },
      { key: 'tried', many: true, q: 'What have you already tried?', options: [['association_events', 'Alumni-association events'], ['linkedin_groups', 'LinkedIn groups'], ['faculty_mentoring', 'A faculty mentoring programme'], ['nothing', 'Nothing yet']] },
      { key: 'commitment', q: 'How much time could you give?', options: [['quarterly', 'One call a quarter'], ['monthly', 'One a month'], ['2_3_monthly', 'Two or three a month'], ['more', 'More']] },
    ],
    university_staff: [
      { key: 'situation', q: 'What’s your role?', options: [['alumni_office', 'Alumni office'], ['career_services', 'Career services'], ['faculty', 'Faculty'], ['other', 'Other']] },
      { key: 'goal', q: 'What would you want from UniCircle?', options: [['engaged_alumni', 'Engaged alumni'], ['own_data', 'Data you own'], ['mentoring_scale', 'Mentoring at scale'], ['employability', 'Student employability']] },
      { key: 'obstacle', text: true, q: 'What do you use today, and where does it fall short?' },
      { key: 'tried', text: true, q: 'Which tools do you use, or have you tried?' },
      { key: 'commitment', q: 'Is there a yearly budget for alumni engagement tools?', options: [['none', 'None'], ['under_5k', 'Under €5k'], ['5_20k', '€5–20k'], ['over_20k', 'Over €20k'], ['unknown', 'I don’t know']] },
    ],
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function apiBase() {
    let api = 'https://api.unicircle.eu';
    try {
      const q = new URLSearchParams(location.search).get('api');
      if (q) localStorage.setItem('uc_api_base', q);
      api = localStorage.getItem('uc_api_base') || api;
    } catch (e) { /* storage blocked */ }
    return api.replace(/\/$/, '');
  }

  // On: data-survey="on", or ?survey=1, or a local preview (localhost / 127.0.0.1), so the
  // team sees the questions when reviewing locally while the public page keeps them off
  // until the backend collection exists.
  function enabled(el) {
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    return !!el && (el.dataset.survey === 'on' || local || new URLSearchParams(location.search).get('survey') === '1');
  }

  // The shared form's own checks, so the questions only open for a sign-up it would accept.
  // Anything else falls through and js/uc-waitlist-form.js shows its usual error.
  function looksValid(form) {
    const f = form.elements;
    const v = (n) => (f[n] && f[n].value ? f[n].value.trim() : '');
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email')) && (!f.city || !!v('city'))
      && (!f.consent || f.consent.checked) && (!v('grad_year') || /^\d{4}$/.test(v('grad_year')));
  }

  const has = (a, s) => { const v = a[s.key]; return Array.isArray(v) ? v.length > 0 : !!v; };

  // Every tap question ends with "Other", which opens a short "in your words" box
  // (Priestley: the answers should give us people's exact language).
  const OTHER = ['other', 'Other'];
  const chipsOf = (s) => (s.options.some((o) => o[0] === OTHER[0]) ? s.options : s.options.concat([OTHER]));
  const picked = (s, a, v) => (s.many ? (a[s.key] || []).includes(v) : a[s.key] === v);

  // One question's answer field: chips (one or many), or free text; plus the optional extra input.
  function field(s, a) {
    const v = a[s.key];
    if (s.text) {
      return '<textarea name="' + s.key + '" rows="3" maxlength="300" placeholder="A sentence is enough" aria-label="' + esc(s.q) + '">' + esc(v || '') + '</textarea>';
    }
    return (s.many ? '<p class="uc-v2-survey-hint">Pick all that apply.</p>' : '')
      + '<div class="uc-v2-chips" role="group" aria-label="' + esc(s.q) + '">'
      + chipsOf(s).map((o) => '<button type="button" class="uc-v2-chip" data-v="' + o[0] + '" aria-pressed="' + picked(s, a, o[0]) + '">' + esc(o[1]) + '</button>').join('')
      + '</div>'
      + '<input type="text" class="uc-input-pill uc-v2-survey-other" name="' + s.key + '_other" maxlength="120" placeholder="In your words" aria-label="Other: in your words"'
      + ' value="' + esc(a[s.key + '_other'] || '') + '"' + (picked(s, a, OTHER[0]) ? '' : ' hidden') + '>'
      + (s.extra ? '<input type="text" class="uc-input-pill uc-v2-survey-extra" name="' + s.extra.key + '" maxlength="80" placeholder="' + esc(s.extra.placeholder) + '" value="' + esc(a[s.extra.key] || '') + '">' : '');
  }

  // A chip tap: one answer, or a set where "Nothing yet" stands alone. Updates the chips and the
  // "Other" box in `scope`.
  function pick(s, a, v, scope) {
    if (s.many) {
      let set = new Set(a[s.key] || []);
      if (set.has(v)) set.delete(v);
      else if (v === 'nothing') set = new Set(['nothing']);
      else { set.add(v); set.delete('nothing'); }
      a[s.key] = [...set];
    } else {
      a[s.key] = v;
    }
    scope.querySelectorAll('.uc-v2-chip').forEach((c) => c.setAttribute('aria-pressed', picked(s, a, c.dataset.v)));
    const box = scope.querySelector('.uc-v2-survey-other');
    if (box) {
      const open = picked(s, a, OTHER[0]);
      box.hidden = !open;
      if (open && v === OTHER[0]) box.focus({ preventScroll: true });
    }
  }

  // "other" goes out as "other: <their words>" when they typed something.
  function payloadFor(body, steps, a, source) {
    const p = { email: body.email, role: body.role, city: body.city || '', source: (source || '').slice(0, 60), sector: a.sector || '', note: a.note || '' };
    steps.forEach((s) => {
      const own = (a[s.key + '_other'] || '').trim();
      const v = [].concat(a[s.key] || []).map((x) => (x === OTHER[0] && own ? OTHER[0] + ': ' + own : x));
      p[s.key] = v.join(', ');
    });
    return p;
  }

  // The short hero form on the landing pages: "Join the waitlist" checks the details, then
  // takes the visitor to the waitlist page, where the questions are, with role, email, city and
  // consent already filled in. The details travel in sessionStorage (same site, this tab only),
  // never in the URL. Nothing is saved until they answer and join there. Must run before
  // UCWaitlist.mount. While the questions are switched off this does nothing: the hero form
  // saves the spot itself, like V1.
  const PREFILL = 'uc_v2_prefill';
  function handoff(form, done, opts) {
    const flag = done && done.querySelector('.uc-v2-survey');
    if (!form || !enabled(flag)) return;
    opts = opts || {};
    form.addEventListener('submit', (e) => {
      if (!looksValid(form)) return;      // the shared form shows its own error
      e.preventDefault();
      e.stopImmediatePropagation();
      const f = form.elements;
      const data = {
        role: (form.querySelector('[data-role].active') || {}).dataset?.role || 'student',
        email: f.email.value.trim(), city: f.city ? f.city.value.trim() : '',
        consent: !!(f.consent && f.consent.checked), source: opts.source || '',
      };
      try { sessionStorage.setItem(PREFILL, JSON.stringify(data)); } catch (x) { /* blocked: they re-type */ }
      const here = new URLSearchParams(location.search);
      const next = new URL(opts.to || 'waitlist-v2.html', location.href);
      ['api', 'ref', 'utm_source', 'survey'].forEach((k) => { if (here.get(k)) next.searchParams.set(k, here.get(k)); });
      location.href = next.href;
    }, true);
  }

  // On the waitlist page: fill the form with what the hero form passed on (once), and return it
  // ({ role, email, city, consent, source }) or null. Call BEFORE inline() and UCWaitlist.mount,
  // so both start from the chosen role.
  function prefill(form) {
    let data = null;
    try { data = JSON.parse(sessionStorage.getItem(PREFILL) || 'null'); sessionStorage.removeItem(PREFILL); } catch (x) { return null; }
    if (!form || !data || !data.email) return null;
    const f = form.elements;
    form.querySelectorAll('[data-role]').forEach((b) => {
      const on = b.dataset.role === data.role;
      b.classList.toggle('active', on); b.setAttribute('aria-checked', on);
    });
    if (f.email) f.email.value = data.email;
    if (f.city) f.city.value = data.city || '';
    if (f.consent) f.consent.checked = !!data.consent;
    return data;
  }

  // All the questions shown inside the form itself (the closing form on the one-pager):
  // answered on the page, saved with the spot on "Join the waitlist". Needs an empty
  // <div class="uc-v2-inline-q" hidden></div> in the form. Must run before UCWaitlist.mount.
  function inline(form, done, opts) {
    const flag = done && done.querySelector('.uc-v2-survey');
    const box = form && form.querySelector('.uc-v2-inline-q');
    if (!box || !enabled(flag)) return function () {};
    opts = opts || {};
    const byRole = {};      // answers kept per role, so switching tabs back and forth loses nothing
    let role = '';
    const roleNow = () => (form.querySelector('[data-role].active') || {}).dataset?.role;
    const steps = () => QUESTIONS[role] || [];
    const answers = () => byRole[role] || (byRole[role] = {});

    function keep() {
      box.querySelectorAll('textarea[name], input[name]').forEach((f) => { answers()[f.name] = f.value.trim(); });
    }
    function render() {
      keep();
      role = roleNow();
      const a = answers();
      box.innerHTML = steps().map((s, n) => '<div class="uc-v2-iq" data-key="' + s.key + '">'
          + '<h3 class="uc-v2-survey-q">' + (n + 1) + '. ' + esc(s.q) + '</h3>' + field(s, a) + '</div>').join('')
        + '<div class="uc-v2-iq"><h3 class="uc-v2-survey-q">' + (steps().length + 1) + '. Anything else you want us to know? <span class="uc-v2-opt">Optional</span></h3>'
        + '<textarea name="note" rows="2" maxlength="1000" aria-label="Anything else you want us to know?">' + esc(a.note || '') + '</textarea></div>';
      box.hidden = !steps().length;
    }
    // Re-render when the role tab changes (click or arrow keys, both handled by the shared form).
    const tabs = form.querySelector('[role=radiogroup]');
    if (tabs) new MutationObserver(() => { if (roleNow() !== role) render(); }).observe(tabs, { subtree: true, attributes: true, attributeFilter: ['class'] });

    box.addEventListener('click', (e) => {
      const chip = e.target.closest('.uc-v2-chip');
      const q = chip && chip.closest('[data-key]');
      if (!q) return;
      const s = steps().find((x) => x.key === q.dataset.key);
      pick(s, answers(), chip.dataset.v, q);
      q.classList.remove('uc-v2-iq--missing');
    });
    box.addEventListener('input', (e) => { const q = e.target.closest('[data-key]'); if (q) q.classList.remove('uc-v2-iq--missing'); });

    form.addEventListener('submit', (e) => {
      if (!looksValid(form)) return;      // the shared form shows its own error
      keep();
      const missing = steps().filter((s) => !has(answers(), s));
      box.querySelectorAll('[data-key]').forEach((q) => q.classList.toggle('uc-v2-iq--missing', missing.some((s) => s.key === q.dataset.key)));
      if (!missing.length) return;        // all answered: the shared form saves the spot
      e.preventDefault();
      e.stopImmediatePropagation();
      const n = steps().indexOf(missing[0]) + 1;
      const err = form.querySelector('.uc-err');
      if (err) { err.textContent = 'Please answer question ' + n + (missing.length > 1 ? ' (and ' + (missing.length - 1) + ' more)' : '') + ' to secure your spot.'; err.hidden = false; }
      const first = box.querySelector('.uc-v2-iq--missing');
      first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      (first.querySelector('button, textarea') || first).focus({ preventScroll: true });
    }, true);

    render();
    return function joined(body) {
      save(flag, payloadFor(body, QUESTIONS[body.role] || [], byRole[body.role] || {}, opts.source));
    };
  }

  async function save(el, payload) {
    const show = (html) => { el.innerHTML = html; el.hidden = false; };
    try {
      const res = await fetch(apiBase() + '/api/collections/waitlist_survey/records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      const dup = res.status === 400 && data.data && data.data.email && /unique/i.test(data.data.email.code || '');
      if (res.ok || dup) {
        return show('<div class="uc-eyebrow">Your answers</div><p class="uc-v2-survey-thanks">'
          + (dup ? 'We already had your answers from before. Thank you.' : 'Saved with your spot. Thank you: they help us decide which circles open first.') + '</p>');
      }
      if (res.status === 404) return show('<p class="uc-v2-survey-thanks">Your spot is saved. Your answers couldn’t be yet: the questions aren’t open on our side.</p>');
    } catch (x) { /* offline: offer a retry below */ }
    show('<p class="uc-err">Your spot is saved, but your answers didn’t reach us.</p>'
      + '<div class="uc-v2-survey-nav"><button type="button" class="uc-btn-dark" data-retry>Send my answers again</button></div>');
    el.querySelector('[data-retry]').addEventListener('click', () => save(el, payload), { once: true });
  }

  function bindShare(btn) {
    if (!btn || btn.dataset.shareBound) return;
    btn.dataset.shareBound = '1';
    btn.addEventListener('click', async () => {
      const url = location.origin + location.pathname + '?ref=friend';
      try {
        if (navigator.share) await navigator.share({ title: 'UniCircle', text: 'Join me on the UniCircle waitlist', url });
        else { await navigator.clipboard.writeText(url); btn.textContent = 'Link copied ✓'; }
      } catch (e) { /* share cancelled */ }
    });
  }

  window.UCSurveyV2 = { enabled, inline, handoff, prefill, bindShare };
})();
