/* UniCircle waitlist form (window.UCWaitlist) — shared by the landing hero and
   waitlist.html. Posts to the PocketBase `waitlist` collection.

     UCWaitlist.mount(form, done, { source, onDone(body, dup) })

   The form may contain any subset of these fields — missing ones are skipped:
     [data-role] tabs (alumnus | student | university_staff), name, email*, institution,
     city*, neighbourhood, programme / programme_s, grad_year, tutorial,
     interests (checkboxes), consent*, [data-for="<role>"] blocks shown per role,
     .uc-err (error line), .uc-wl-submit (button). In `done`: [data-done-msg].
   API base: ?api=… (remembered) → localStorage uc_api_base → https://api.unicircle.eu
   Channel tracking: ?ref=… / ?utm_source=… overrides opts.source. */
(function () {
  'use strict';

  function apiBase() {
    let api = 'https://api.unicircle.eu';
    try {
      const q = new URLSearchParams(location.search).get('api');
      if (q) localStorage.setItem('uc_api_base', q);
      api = localStorage.getItem('uc_api_base') || api;
    } catch (e) { /* storage blocked */ }
    return api.replace(/\/$/, '');
  }

  function mount(form, done, opts) {
    if (!form || form.dataset.wlMounted) return;
    form.dataset.wlMounted = '1';
    opts = opts || {};
    const qs = new URLSearchParams(location.search);
    const SOURCE = (qs.get('ref') || qs.get('utm_source') || opts.source || 'waitlist').slice(0, 60);
    const err = form.querySelector('.uc-err');
    const btn = form.querySelector('.uc-wl-submit');
    const btnLabel = btn ? btn.textContent : '';
    const f = form.elements;
    const val = (n) => (f[n] && f[n].value ? f[n].value.trim() : '');
    const tick = (v, on) => { const c = form.querySelector('input[name=interests][value=' + v + ']'); if (c) c.checked = on; };
    let role = (form.querySelector('[data-role].active') || {}).dataset?.role || 'alumnus';

    function setRole(r) {
      role = r;
      form.querySelectorAll('[data-role]').forEach((b) => {
        const on = b.dataset.role === r;
        b.classList.toggle('active', on); b.setAttribute('aria-checked', on);
      });
      form.querySelectorAll('[data-for]').forEach((el) => {
        const show = el.dataset.for.split(' ').includes(r);
        el.hidden = !show;
        if (!show) el.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = false; });
      });
      if (r === 'student') { tick('find_a_mentor', true); tick('student_exchange', true); }
      else if (r === 'alumnus') tick('mentor_others', true);
    }
    form.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => setRole(b.dataset.role)));
    const group = form.querySelector('[role=radiogroup]');
    if (group) group.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const tabs = [...form.querySelectorAll('[data-role]')];
      const i = tabs.findIndex((t) => t.dataset.role === role);
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      setRole(next.dataset.role); next.focus();
    });

    const showErr = (msg) => { if (err) { err.textContent = msg; err.hidden = false; } };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (err) err.hidden = true;
      const email = val('email'), city = val('city');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { f.email.focus(); return showErr('Please enter a valid email address.'); }
      if (f.city && !city) { f.city.focus(); return showErr('Which city are you in? City is enough — no street needed.'); }
      if (f.consent && !f.consent.checked) { f.consent.focus(); return showErr('Please tick the box so we can email you when your spot opens.'); }

      let interests = [...form.querySelectorAll('input[name=interests]:checked')].map((c) => c.value);
      if (!form.querySelector('input[name=interests]')) {
        // Compact forms without interest chips: infer the obvious ones from the role.
        interests = role === 'student' ? ['find_a_mentor', 'student_exchange'] : role === 'alumnus' ? ['mentor_others', 'alumni_map'] : ['alumni_map'];
      }
      const body = {
        email, role, city,
        name: val('name'),
        institution: val('institution'),
        neighbourhood: val('neighbourhood'),
        programme: role === 'student' ? (val('programme_s') || val('programme')) : val('programme'),
        grad_year: role === 'alumnus' ? val('grad_year') : '',
        tutorial: role === 'student' ? val('tutorial') : '',
        interests,
        consent: true,
        source: SOURCE,
      };
      if (body.grad_year && !/^\d{4}$/.test(body.grad_year)) { f.grad_year.focus(); return showErr('Graduation year should look like 2018.'); }

      if (btn) { btn.disabled = true; btn.textContent = 'Joining…'; }
      try {
        const res = await fetch(apiBase() + '/api/collections/waitlist/records', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        const dup = res.status === 400 && data.data && data.data.email && /unique/i.test(data.data.email.code || '');
        if (res.ok || dup) finish(body, dup);
        else if (res.status === 404) showErr('The waitlist opens in a moment — please try again shortly, or email hello@unicircle.eu.');
        else showErr((data && data.message) || 'Something went wrong. Please try again.');
      } catch (x) {
        showErr('Could not reach UniCircle — check your connection and try again.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
      }
    });

    function finish(body, dup) {
      if (done) {
        form.hidden = true; done.hidden = false;
        const first = (body.name || '').split(/\s+/)[0];
        const msg = done.querySelector('[data-done-msg]');
        if (msg) msg.textContent = dup
          ? 'You were already on the list — we’ll email you as soon as your spot opens.'
          : (first ? first + ', w' : 'W') + 'e’ll email you as soon as your spot opens in ' + body.city + '.';
        done.focus();
        const share = done.querySelector('[data-share]');
        if (share) share.addEventListener('click', async () => {
          const url = location.origin + '/waitlist.html?ref=friend';
          try {
            if (navigator.share) await navigator.share({ title: 'UniCircle', text: 'Join me on the UniCircle waitlist', url });
            else { await navigator.clipboard.writeText(url); share.textContent = 'Link copied ✓'; }
          } catch (e) { /* share cancelled */ }
        });
      }
      if (opts.onDone) opts.onDone(body, dup);
    }

    setRole(role);
  }

  window.UCWaitlist = { mount };
})();
