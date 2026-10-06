/* UniCircle page module: #jobs — see js/pages/_shared.js for the contract.

   Job listings are curated SAMPLES in components/jobs.html (no jobs/applications
   collections in the backend). Honest, per-viewer behaviour only:
     - Apply dialog      → signed-out: sign-in gate; signed-in: cover note saved on
                           this device + "Ask the poster" (real chat only when the
                           listing carries a real data-poster user id)
     - Save job          → UCP.store('jobs_saved')
     - Company / city    → #network?q=<company> / #map?city=<city>
     - Filters           → location (city | remote) / type / work mode / saved
     - Supporter tiers   → amount selection; CTA explains payments are not live and
                           offers "Notify me" (UCP.store) — never simulates a payment
     - Post a job        → prefilled mailto:hello@unicircle.eu
   Hash params honoured: #jobs?id=<slug>  #jobs?city=<City>|remote  #jobs?type=…  #jobs?q=…
   Hashes emitted:       #network?q=<company>  #map?city=<City>
                         #jobs?… (replaceState for filters, no re-render) */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  const SAVED_KEY = 'jobs_saved';
  const NOTES_KEY = 'jobs_notes';
  const AMOUNT_KEY = 'supporter_amount';
  const NOTIFY_KEY = 'supporter_notify';
  const CONTACT = 'hello@unicircle.eu';

  const UCP = () => window.UCP || {};
  const esc = (s) => (UCP().esc ? UCP().esc(s) : String(s == null ? '' : s));
  const toast = (m, k) => UCP().toast && UCP().toast(m, k);
  const store = (k, v) => (UCP().store ? UCP().store(k, v) : (v === undefined ? null : v));
  const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const readList = (k) => { const v = store(k); return Array.isArray(v) ? v : []; };
  const readMap = (k) => { const v = store(k); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };

  function setHashParams(params) {
    const qs = new URLSearchParams();
    Object.keys(params).forEach((k) => { if (params[k]) qs.set(k, params[k]); });
    try { history.replaceState(null, '', '#jobs' + (qs.toString() ? '?' + qs.toString() : '')); } catch (e) { /* ignore */ }
  }

  function openMailto(subject, body) {
    const a = document.createElement('a');
    a.href = 'mailto:' + CONTACT + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    document.body.appendChild(a); a.click(); a.remove();
  }
  const lastDialog = () => { const all = document.querySelectorAll('dialog.uc-dialog'); return all[all.length - 1] || null; };

  function postJobDialog() {
    const D = UCP().dialog;
    if (!D) return;
    const u = UCP().user ? UCP().user() : null;
    D({
      title: 'Post a job',
      body: '<p style="margin:0 0 12px;">Self-serve job posting isn’t live yet. Fill in the basics and we’ll open a pre-filled email to '
        + '<b>' + esc(CONTACT) + '</b> in your mail app — nothing is sent until you press send there.</p>'
        + '<div class="uc-ej-form">'
        + '<label class="uc-ej-field"><span>Role title</span><input type="text" name="jp-title" maxlength="120" placeholder="e.g. Junior Credit Analyst"></label>'
        + '<label class="uc-ej-field"><span>Company</span><input type="text" name="jp-company" maxlength="120"></label>'
        + '<div class="uc-ej-form-2">'
        + '<label class="uc-ej-field"><span>City (or “Remote”)</span><input type="text" name="jp-city" maxlength="60"></label>'
        + '<label class="uc-ej-field"><span>Type</span><select name="jp-type"><option>Permanent</option><option>Internship</option><option>Part-time</option><option>Contract</option></select></label>'
        + '</div>'
        + '<label class="uc-ej-field"><span>Link to the full ad (optional)</span><input type="url" name="jp-link" maxlength="300" placeholder="https://"></label>'
        + '<label class="uc-ej-field"><span>Who should apply?</span><textarea name="jp-notes" rows="3" maxlength="1500"></textarea></label>'
        + '</div>',
      actions: [
        { label: 'Cancel' },
        {
          label: 'Open email', primary: true,
          onClick: (close, d) => {
            const v = (n) => ((d.querySelector('[name="' + n + '"]') || {}).value || '').trim();
            if (!v('jp-title')) { const f = d.querySelector('[name="jp-title"]'); f && f.focus(); toast('Add a role title first.', 'warn'); return; }
            openMailto('Job for the circle: ' + v('jp-title') + (v('jp-company') ? ' at ' + v('jp-company') : ''), [
              'Role: ' + v('jp-title'),
              'Company: ' + (v('jp-company') || '—'),
              'Location: ' + (v('jp-city') || '—'),
              'Type: ' + (v('jp-type') || '—'),
              'Link: ' + (v('jp-link') || '—'),
              '', v('jp-notes'), '',
              u && u.name ? '— ' + u.name + (u.email ? ' (' + u.email + ')' : '') : ''
            ].join('\n'));
            close();
          }
        }
      ]
    });
  }

  window.UCPages['jobs'] = function (root) {
    if (!root) return;
    const page = root.querySelector('.uc-jobs-page') || root;
    const G = (p, params) => UCP().go && UCP().go(p, params);
    const jobs = Array.from(page.querySelectorAll('[data-uc-job]'));

    const jobOf = (card) => ({
      id: card.dataset.id || slugify((card.querySelector('.uc-job-title') || {}).textContent),
      title: ((card.querySelector('.uc-job-title') || {}).textContent || 'this role').replace(/\s+/g, ' ').trim(),
      company: card.dataset.company || '',
      city: card.dataset.city || '',
      type: card.dataset.type || '',
      mode: card.dataset.mode || '',
      poster: (card.dataset.poster || '').trim(),
      desc: ((card.querySelector('.uc-job-desc') || {}).textContent || '').trim()
    });
    jobs.forEach((c) => { if (!c.dataset.id) c.dataset.id = jobOf(c).id; c.setAttribute('tabindex', '-1'); });

    /* ---------- Saved ---------- */
    let saved = readList(SAVED_KEY);
    let notes = readMap(NOTES_KEY);
    function paintSave(card) {
      const b = card.querySelector('[data-job-save]');
      if (!b) return;
      const j = jobOf(card);
      const on = saved.indexOf(j.id) >= 0;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', (on ? 'Unsave ' : 'Save ') + j.title);
      b.title = on ? 'Saved — click to remove' : 'Save job';
      b.classList.toggle('is-on', on);
      const ic = b.querySelector('.iconify, svg');
      const icon = on ? 'ph:bookmark-simple-fill' : 'ph:bookmark-simple-bold';
      if (ic) {
        const span = document.createElement('span');
        span.className = 'iconify'; span.setAttribute('data-icon', icon); span.setAttribute('aria-hidden', 'true');
        ic.replaceWith(span);
        if (window.Iconify) window.Iconify.scan(b);
      }
    }
    function paintApply(card) {
      const b = card.querySelector('[data-job-apply]');
      if (!b) return;
      const j = jobOf(card);
      const hasNote = !!(notes[j.id] && notes[j.id].text);
      b.textContent = hasNote ? 'Note saved' : 'Apply';
      b.setAttribute('aria-label', (hasNote ? 'Edit your saved cover note for ' : 'Apply: ') + j.title);
    }
    function toggleSave(card) {
      const j = jobOf(card);
      const on = saved.indexOf(j.id) >= 0;
      saved = on ? saved.filter((x) => x !== j.id) : saved.concat(j.id);
      store(SAVED_KEY, saved);
      paintSave(card);
      toast(on ? 'Removed <b>' + esc(j.title) + '</b> from saved jobs.' : 'Saved <b>' + esc(j.title) + '</b> — on this device.');
      if (filt.saved) applyFilter(false);
    }

    /* ---------- Apply ---------- */
    function openApply(card) {
      const D = UCP().dialog;
      if (!D) return;
      const j = jobOf(card);
      const user = UCP().user ? UCP().user() : null;
      const where = j.city || (j.mode === 'remote' ? 'Remote' : '');
      const head = '<p class="uc-ej-sample-note">Sample listing — fictional employer, shown to illustrate jobs on UniCircle.</p>'
        + '<p style="margin:0 0 4px;"><b>' + esc(j.company) + '</b>' + (where ? ' · ' + esc(where) : '') + (j.type ? ' · ' + esc(j.type) : '') + '</p>'
        + (j.desc ? '<p style="margin:0 0 12px;">' + esc(j.desc) + '</p>' : '');

      if (!user) {
        D({
          title: 'Apply: ' + j.title,
          body: head + '<p style="margin:0;">Sign in to apply — your UniCircle profile is your CV.</p>',
          actions: [
            { label: 'Cancel' },
            { label: 'Sign in', primary: true, onClick: (close) => { close(); if (window.UC && window.UC.openAuth) window.UC.openAuth('signin'); } }
          ]
        });
        return;
      }

      const prev = (notes[j.id] && notes[j.id].text) || '';
      D({
        title: 'Apply: ' + j.title,
        body: head
          + '<label class="uc-ej-field"><span>Cover note</span>'
          + '<textarea name="job-note" rows="5" maxlength="3000" placeholder="Why are you a great fit for this role?">' + esc(prev) + '</textarea></label>'
          + '<p class="uc-ej-hint">Applications through UniCircle aren’t live yet, so nothing is sent to an employer. '
          + 'Your note is saved on this device so it’s ready when they are.</p>'
          + '<div class="uc-ej-callout" data-ask-out hidden></div>',
        actions: [
          { label: 'Ask the poster', onClick: (c, d) => askPoster(j, c, d) },
          {
            label: 'Save cover note', primary: true,
            onClick: (c, d) => {
              const t = ((d.querySelector('[name="job-note"]') || {}).value || '').trim();
              if (t) notes[j.id] = { text: t, at: new Date().toISOString() }; else delete notes[j.id];
              store(NOTES_KEY, notes);
              paintApply(card);
              toast(t ? 'Cover note saved on this device for <b>' + esc(j.title) + '</b>. Nothing was sent.' : 'Cover note cleared.');
              c();
            }
          }
        ]
      });
      const d = lastDialog();
      const ta = d && d.querySelector('[name="job-note"]');
      if (ta) setTimeout(() => ta.focus(), 30);
    }

    function askPoster(j, close, d) {
      if (j.poster) {
        close();
        if (window.UC && window.UC.openChat) window.UC.openChat(j.poster);
        return;
      }
      const out = d && d.querySelector('[data-ask-out]');
      const html = '<b>No one to message on this one.</b><br>This is a sample listing with a fictional employer, so there is no real poster behind it. '
        + '<button type="button" class="uc-ej-link" data-ask-net>Look for alumni at companies like it</button> in the network instead.';
      if (out) {
        out.innerHTML = html;
        out.hidden = false;
        const b = out.querySelector('[data-ask-net]');
        if (b) { b.addEventListener('click', () => { close(); G('network', { q: j.company }); }); b.focus(); }
      } else {
        toast('This is a sample listing — there is no real poster to message.', 'warn');
      }
    }

    /* ---------- Filters ---------- */
    const status = page.querySelector('[data-job-status]');
    const empty = page.querySelector('[data-job-empty]');
    const selLoc = page.querySelector('[data-jf="loc"]');
    const selType = page.querySelector('[data-jf="type"]');
    const selMode = page.querySelector('[data-jf="mode"]');
    const savedChip = page.querySelector('[data-jf-saved]');
    const searchInput = page.querySelector('[data-uc-search] input');
    const filt = { loc: '', type: '', mode: '', saved: false, q: '' };

    const uniq = (arr) => arr.filter((x, i) => x && arr.indexOf(x) === i).sort((a, b) => a.localeCompare(b));
    const cities = uniq(jobs.map((c) => c.dataset.city || ''));
    const types = uniq(jobs.map((c) => c.dataset.type || ''));
    const addOpts = (sel, vals) => { if (sel) vals.forEach((v) => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); }); };
    addOpts(selLoc, cities);
    addOpts(selType, types);

    function matches(card) {
      const j = jobOf(card);
      if (filt.loc === 'remote' ? j.mode !== 'remote' : (filt.loc && j.city !== filt.loc)) return false;
      if (filt.type && j.type !== filt.type) return false;
      if (filt.mode && j.mode !== filt.mode) return false;
      if (filt.saved && saved.indexOf(j.id) < 0) return false;
      if (filt.q) {
        const hay = (j.title + ' ' + j.company + ' ' + j.city + ' ' + j.type + ' ' + j.mode + ' ' + j.desc).toLowerCase();
        if (hay.indexOf(filt.q.toLowerCase()) < 0) return false;
      }
      return true;
    }
    function applyFilter(writeHash) {
      let shown = 0;
      jobs.forEach((c) => { const ok = matches(c); c.hidden = !ok; if (ok) shown++; });
      if (empty) empty.hidden = shown > 0;
      if (savedChip) { savedChip.setAttribute('aria-pressed', filt.saved ? 'true' : 'false'); savedChip.classList.toggle('active', filt.saved); }
      const any = filt.loc || filt.type || filt.mode || filt.saved || filt.q;
      if (status) status.textContent = any ? shown + ' role' + (shown === 1 ? '' : 's') + ' shown' + (filt.q ? ' matching “' + filt.q + '”' : '') : '';
      if (writeHash) setHashParams({ city: filt.loc, type: filt.type, mode: filt.mode, q: filt.q });
    }
    [[selLoc, 'loc'], [selType, 'type'], [selMode, 'mode']].forEach((p) => {
      if (p[0]) p[0].addEventListener('change', () => { filt[p[1]] = p[0].value; applyFilter(true); });
    });
    if (savedChip) savedChip.addEventListener('click', () => { filt.saved = !filt.saved; applyFilter(false); });
    const clearBtn = page.querySelector('[data-job-clear]');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      filt.loc = filt.type = filt.mode = filt.q = ''; filt.saved = false;
      [selLoc, selType, selMode].forEach((s) => { if (s) s.value = ''; });
      if (searchInput) searchInput.value = '';
      applyFilter(true);
    });

    // Header search filters roles locally (capture beats the shell's #network jump).
    const form = page.querySelector('[data-uc-search]');
    if (form) {
      page.addEventListener('submit', (e) => {
        if (e.target !== form) return;
        e.preventDefault(); e.stopPropagation();
        filt.q = (searchInput && searchInput.value || '').trim();
        applyFilter(true);
      }, true);
      if (searchInput) searchInput.addEventListener('input', () => { filt.q = searchInput.value.trim(); applyFilter(false); });
    }

    /* ---------- Per-job wiring ---------- */
    jobs.forEach((card) => {
      const j = jobOf(card);
      paintSave(card);
      paintApply(card);
      const s = card.querySelector('[data-job-save]');
      if (s) s.addEventListener('click', () => toggleSave(card));
      const a = card.querySelector('[data-job-apply]');
      if (a) a.addEventListener('click', () => openApply(card));
      card.querySelectorAll('[data-job-company]').forEach((b) => {
        b.setAttribute('aria-label', 'Find alumni at ' + j.company + ' in the network');
        b.addEventListener('click', () => G('network', { q: j.company }));
      });
      card.querySelectorAll('[data-job-city]').forEach((b) => {
        if (!j.city) return;
        b.setAttribute('aria-label', 'Show alumni in ' + j.city + ' on the map');
        b.addEventListener('click', () => G('map', { city: j.city }));
      });
    });
    page.querySelectorAll('[data-job-post]').forEach((b) => b.addEventListener('click', postJobDialog));

    /* ---------- Supporter tier (payments NOT live) ---------- */
    const sup = page.querySelector('[data-supporter]');
    if (sup) {
      const amountBtns = Array.from(sup.querySelectorAll('[data-amount]'));
      const other = sup.querySelector('[data-amount-other]');
      const cta = sup.querySelector('[data-supporter-cta]');
      let amount = Number(store(AMOUNT_KEY)) || 10;
      const paint = () => {
        const preset = amountBtns.some((b) => Number(b.dataset.amount) === amount);
        amountBtns.forEach((b) => {
          const on = preset && Number(b.dataset.amount) === amount;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.classList.toggle('uc-pill-paper', on);
          b.classList.toggle('uc-pill-outline-paper', !on);
        });
        if (other) other.value = preset ? '' : String(amount);
        if (cta) {
          const n = store(NOTIFY_KEY);
          cta.textContent = n ? 'On the notify list · €' + amount : 'Become a supporter · €' + amount;
        }
      };
      amountBtns.forEach((b) => b.addEventListener('click', () => { amount = Number(b.dataset.amount); store(AMOUNT_KEY, amount); paint(); }));
      if (other) other.addEventListener('input', () => {
        const v = Math.round(Number(other.value));
        if (v >= 1 && v <= 1000) {
          amount = v; store(AMOUNT_KEY, amount);
          amountBtns.forEach((b) => { b.setAttribute('aria-pressed', 'false'); b.classList.remove('uc-pill-paper'); b.classList.add('uc-pill-outline-paper'); });
          if (cta) cta.textContent = (store(NOTIFY_KEY) ? 'On the notify list · €' : 'Become a supporter · €') + amount;
        }
      });
      if (cta) cta.addEventListener('click', () => {
        const D = UCP().dialog;
        if (!D) return;
        const already = store(NOTIFY_KEY);
        D({
          title: 'Supporter payments aren’t live yet',
          body: '<p style="margin:0 0 10px;">Thank you for wanting to chip in <b>€' + esc(amount) + '</b>. '
            + 'We haven’t switched on payments, so nothing will be charged and we won’t ask for card details here.</p>'
            + '<p style="margin:0 0 10px;">Tap <b>Notify me</b> to keep your choice on this device (it isn’t sent anywhere). '
            + 'To hear by email when contributions open, write to <a href="mailto:' + esc(CONTACT) + '?subject=' + encodeURIComponent('Supporter waitlist') + '">' + esc(CONTACT) + '</a>.</p>'
            + (already ? '<p class="uc-ej-hint" style="margin:0;">You’re already on the notify list on this device (€' + esc(already.amount) + ').</p>' : ''),
          actions: [
            already
              ? { label: 'Remove me', onClick: (c) => { store(NOTIFY_KEY, null); paint(); toast('Removed from the supporter notify list on this device.'); c(); } }
              : { label: 'Not now' },
            {
              label: 'Notify me', primary: true,
              onClick: (c) => {
                store(NOTIFY_KEY, { amount: amount, at: new Date().toISOString() });
                paint();
                toast('Noted on this device — no payment taken and nothing sent.');
                c();
              }
            }
          ]
        });
      });
      paint();
    }

    /* ---------- Deep links ---------- */
    const params = UCP().params ? UCP().params() : new URLSearchParams();
    const pCity = (params.get('city') || '').trim();
    const pType = (params.get('type') || '').trim();
    const pMode = (params.get('mode') || params.get('remote') && 'remote' || '').trim();
    const pQ = (params.get('q') || '').trim();
    const pId = (params.get('id') || '').trim();
    const pick = (list, v) => list.find((x) => x.toLowerCase() === v.toLowerCase()) || '';
    if (pCity) filt.loc = /^remote$/i.test(pCity) ? 'remote' : pick(cities, pCity);
    if (pType) filt.type = pick(types, pType);
    if (pMode) filt.mode = pick(['remote', 'hybrid', 'onsite'], pMode);
    if (pQ) { filt.q = pQ; if (searchInput) searchInput.value = pQ; }
    if (selLoc) selLoc.value = filt.loc;
    if (selType) selType.value = filt.type;
    if (selMode) selMode.value = filt.mode;
    if (pCity && !filt.loc) toast('No sample roles in ' + esc(pCity) + ' — showing all locations.', 'warn');
    applyFilter(false);

    if (pId) {
      const card = jobs.find((c) => c.dataset.id === pId || c.dataset.id === slugify(pId));
      if (!card) {
        toast('That job isn’t listed any more.', 'warn');
      } else {
        if (card.hidden) {
          filt.loc = filt.type = filt.mode = filt.q = ''; filt.saved = false;
          [selLoc, selType, selMode].forEach((s) => { if (s) s.value = ''; });
          if (searchInput) searchInput.value = '';
          applyFilter(false);
        }
        setTimeout(() => {
          if (!document.contains(card)) return;
          const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
          card.classList.add('is-highlight');
          setTimeout(() => card.classList.remove('is-highlight'), 2600);
          openApply(card);
        }, 120);
      }
    }
  };
})();
