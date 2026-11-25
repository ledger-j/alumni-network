/* UniCircle: page module profile-deep ("In-depth profile" on the profile page).
   Called by profile.js: window.UCPages.profileDeep(root). Renders into
   [data-uc-slot="deep"]. Owner: form over profiles_deep (+ "Structure my text" helper).
   Other member (?id=<id> that is not me): read-only render. */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};
  const UCP = window.UCP;
  const esc = (s) => UCP.esc(s);

  const FIELDS = [
    { k: 'experience', label: 'Experience', max: 2000, rows: 6, hint: 'Roles, employers, what you did.' },
    { k: 'education', label: 'Education', max: 1000, rows: 4, hint: 'Degrees, programmes, years.' },
    { k: 'skills', label: 'Skills', max: 500, rows: 3, hint: 'Comma-separated is fine.' },
    { k: 'sectors', label: 'Sectors', max: 300, rows: 2, hint: 'Industries you know.' },
    { k: 'languages', label: 'Languages', max: 200, rows: 2, hint: 'For example: Dutch (native), English (C1).' },
    { k: 'offer', label: 'What I can offer', max: 500, rows: 3, hint: '' },
    { k: 'seek', label: 'What I am looking for', max: 500, rows: 3, hint: '' }
  ];
  const LINKS = [
    { k: 'link_linkedin', label: 'LinkedIn link' },
    { k: 'link_site', label: 'Website link' }
  ];
  const validId = (s) => /^[a-z0-9]{1,32}$/i.test(String(s || ''));
  const q = (id) => encodeURIComponent('(user="' + id + '")');

  // Remove emails, phone numbers and URLs before text leaves the browser.
  function strip(t) {
    return String(t || '')
      .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, '')
      .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '')
      .replace(/\b(?:linkedin\.com|xing\.com)\/\S+/gi, '')
      .replace(/(?:\+|\b00)?\d[\d\s().\-\/]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '' : m))
      .replace(/[ \t]{2,}/g, ' ');
  }

  function readOnly(row) {
    const parts = FIELDS.map((f) => {
      const v = String(row[f.k] || '').trim();
      if (!v) return '';
      return '<div class="uc-deep-sec"><h3 class="uc-deep-h3">' + esc(f.label) + '</h3><p class="uc-deep-text">' + esc(v) + '</p></div>';
    }).join('');
    const links = LINKS.map((l) => {
      const u = window.UC && window.UC.safeUrl ? window.UC.safeUrl(row[l.k]) : null;
      return u ? '<a class="uc-pf-inline uc-deep-link" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(l.label.replace(' link', '')) + ' <span aria-hidden="true">↗</span></a>' : '';
    }).join('');
    return parts + (links ? '<div class="uc-deep-links">' + links + '</div>' : '');
  }

  async function renderOther(slot, id) {
    let html = '';
    try {
      const res = await UCP.api('GET', '/api/collections/profiles_deep/records?perPage=1&filter=' + q(id));
      const row = res && res.items && res.items[0];
      if (!row) html = '<p class="uc-deep-fine">This member has not added an in-depth profile.</p>';
      else if (row.visibility === 'private') html = '<p class="uc-deep-fine">This member keeps their profile private.</p>';
      else html = readOnly(row) || '<p class="uc-deep-fine">This member has not added an in-depth profile.</p>';
    } catch (e) {
      html = '<p class="uc-deep-fine">This member keeps their profile private.</p>';
    }
    slot.innerHTML = '<div class="uc-card uc-deep"><h2 class="uc-h2" id="uc-deep-title">In-depth profile</h2>' + html + '</div>';
  }

  function formHtml(row) {
    const vis = row && row.visibility === 'private' ? 'private' : 'members';
    const areas = FIELDS.map((f) =>
      '<div class="uc-deep-field"><label for="uc-deep-' + f.k + '" class="uc-mc-label">' + esc(f.label) + '</label>'
      + '<textarea id="uc-deep-' + f.k + '" name="' + f.k + '" rows="' + f.rows + '" maxlength="' + f.max + '"'
      + (f.hint ? ' placeholder="' + esc(f.hint) + '"' : '') + ' data-deep-ta aria-describedby="uc-deep-c-' + f.k + '">' + esc(row ? row[f.k] || '' : '') + '</textarea>'
      + '<span class="uc-deep-count" id="uc-deep-c-' + f.k + '" data-deep-count="' + f.k + '" aria-live="off"></span></div>').join('');
    const links = LINKS.map((l) =>
      '<div class="uc-deep-field"><label for="uc-deep-' + l.k + '" class="uc-mc-label">' + esc(l.label) + '</label>'
      + '<input type="url" id="uc-deep-' + l.k + '" name="' + l.k + '" maxlength="300" placeholder="https://" value="' + esc(row ? row[l.k] || '' : '') + '"></div>').join('');
    return '<p class="uc-deep-note">Do not add health, religion, politics, union membership, sexual orientation or other sensitive data. '
      + 'Visible to signed-in members only, unless you set it to private.</p>'
      + '<details class="uc-deep-helper" data-deep-helper><summary>Structure my text</summary>'
      + '<div class="uc-deep-helper-body">'
      + '<p class="uc-deep-fine">Paste your CV or the About text from LinkedIn. It is sent to Google\'s Gemini model to be structured. Names, email addresses, phone numbers and links are removed first in your browser. UniCircle does not store it; only what you save below is kept.</p>'
      + '<label for="uc-deep-paste" class="uc-mc-label">Your text</label>'
      + '<textarea id="uc-deep-paste" rows="6" maxlength="4000" data-deep-paste aria-describedby="uc-deep-paste-c"></textarea>'
      + '<span class="uc-deep-count" id="uc-deep-paste-c" data-deep-paste-count></span>'
      + '<div class="uc-deep-actions"><button type="button" class="uc-pill-ghost" data-deep-run>Suggest a structure</button>'
      + '<span class="uc-deep-fine" role="status" aria-live="polite" data-deep-helper-note></span></div>'
      + '<div data-deep-diff></div></div></details>'
      + '<form class="uc-deep-form" data-deep-form novalidate>' + areas + '<div class="uc-deep-links-row">' + links + '</div>'
      + '<fieldset class="uc-deep-vis"><legend class="uc-mc-label">Who can see this</legend>'
      + '<label class="uc-deep-radio"><input type="radio" name="visibility" value="members"' + (vis === 'members' ? ' checked' : '') + '> Signed-in members</label>'
      + '<label class="uc-deep-radio"><input type="radio" name="visibility" value="private"' + (vis === 'private' ? ' checked' : '') + '> Only me</label></fieldset>'
      + '<div class="uc-deep-actions"><button type="submit" class="uc-pill-ink" data-deep-save>Save</button>'
      + '<span class="uc-deep-fine" role="status" aria-live="polite" data-deep-note></span></div></form>';
  }

  async function renderOwn(slot, me) {
    let row = null;
    let loadFailed = false;
    try {
      const res = await UCP.api('GET', '/api/collections/profiles_deep/records?perPage=1&filter=' + q(me.id));
      row = res && res.items && res.items[0] || null;
    } catch (e) { loadFailed = true; }

    slot.innerHTML = '<div class="uc-card uc-deep"><h2 class="uc-h2" id="uc-deep-title">In-depth profile</h2>'
      + (loadFailed ? '<p class="uc-deep-fine">Your in-depth profile could not be loaded right now. Try again later.</p>' : formHtml(row))
      + '</div>';
    if (loadFailed) return;

    const form = slot.querySelector('[data-deep-form]');
    const note = slot.querySelector('[data-deep-note]');
    const saveBtn = slot.querySelector('[data-deep-save]');
    let usedImport = !!(row && row.source === 'linkedin_import');
    let recId = row ? row.id : null;

    const updateCounts = () => {
      FIELDS.forEach((f) => {
        const ta = form.elements[f.k];
        const c = slot.querySelector('[data-deep-count="' + f.k + '"]');
        if (ta && c) c.textContent = ta.value.length + ' / ' + f.max;
      });
    };
    form.addEventListener('input', updateCounts);
    updateCounts();

    const paste = slot.querySelector('[data-deep-paste]');
    const pasteC = slot.querySelector('[data-deep-paste-count]');
    const pasteCount = () => { pasteC.textContent = paste.value.length + ' / 4000'; };
    paste.addEventListener('input', pasteCount); pasteCount();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {};
      FIELDS.forEach((f) => { body[f.k] = form.elements[f.k].value.trim().slice(0, f.max); });
      for (const l of LINKS) {
        const v = form.elements[l.k].value.trim();
        if (v) {
          const ok = window.UC && window.UC.safeUrl ? window.UC.safeUrl(v) : null;
          if (!ok) { UCP.toast(l.label + ' must start with http:// or https://', 'warn'); form.elements[l.k].focus(); return; }
        }
        body[l.k] = v;
      }
      const vis = form.querySelector('input[name="visibility"]:checked');
      body.visibility = vis && vis.value === 'private' ? 'private' : 'members';
      body.source = usedImport ? 'linkedin_import' : 'self';
      saveBtn.disabled = true; note.textContent = 'Saving…';
      try {
        let saved;
        if (recId) saved = await UCP.api('PATCH', '/api/collections/profiles_deep/records/' + encodeURIComponent(recId), body);
        else { body.user = me.id; saved = await UCP.api('POST', '/api/collections/profiles_deep/records', body); }
        if (saved && saved.id) recId = saved.id;
        note.textContent = 'Saved.';
        UCP.toast('In-depth profile saved.', 'ok');
      } catch (err) {
        note.textContent = '';
        UCP.toast((err && err.message) || 'Could not save.', 'warn');
      } finally { saveBtn.disabled = false; }
    });

    // --- Structure my text helper ---
    const runBtn = slot.querySelector('[data-deep-run]');
    const hNote = slot.querySelector('[data-deep-helper-note]');
    const diff = slot.querySelector('[data-deep-diff]');
    runBtn.addEventListener('click', async () => {
      const text = strip(paste.value).trim();
      if (text.length < 20) { hNote.textContent = 'Paste a little more text first.'; return; }
      runBtn.disabled = true; hNote.textContent = 'Working…'; diff.innerHTML = '';
      try {
        const out = await UCP.api('POST', '/api/uc/profile/structure', { text: text.slice(0, 4000) });
        hNote.textContent = '';
        showDiff(out || {});
      } catch (err) {
        const st = err && err.status;
        if (st === 404 || st === 501 || st === 0 || st == null) hNote.textContent = 'This helper is not switched on yet.';
        else { hNote.textContent = ''; UCP.toast((err && err.message) || 'The helper could not answer.', 'warn'); }
      } finally { runBtn.disabled = false; }
    });

    function showDiff(out) {
      const rows = FIELDS.filter((f) => typeof out[f.k] === 'string' && out[f.k].trim()).map((f) => {
        const cur = form.elements[f.k].value.trim();
        const sug = out[f.k].trim().slice(0, f.max);
        return { f, cur, sug };
      });
      if (!rows.length) { hNote.textContent = 'No suggestions came back. Try a longer text.'; return; }
      diff.innerHTML = '<p class="uc-deep-fine">Tick what you want to use. Nothing is saved until you press Save.</p>'
        + rows.map((r, i) =>
          '<div class="uc-deep-diffrow"><label class="uc-deep-check"><input type="checkbox" data-deep-pick="' + i + '"> <span>' + esc(r.f.label) + '</span></label>'
          + '<div class="uc-deep-ba"><div><span class="uc-mc-label">Now</span><p class="uc-deep-text">' + (r.cur ? esc(r.cur) : '<em>empty</em>') + '</p></div>'
          + '<div><span class="uc-mc-label">Suggestion</span><p class="uc-deep-text">' + esc(r.sug) + '</p></div></div></div>').join('')
        + '<div class="uc-deep-actions"><button type="button" class="uc-pill-ink" data-deep-apply>Use ticked fields</button></div>';
      diff.querySelector('[data-deep-apply]').addEventListener('click', () => {
        let n = 0;
        diff.querySelectorAll('[data-deep-pick]').forEach((cb) => {
          if (!cb.checked) return;
          const r = rows[Number(cb.dataset.deepPick)];
          if (r) { form.elements[r.f.k].value = r.sug; n++; }
        });
        if (!n) { hNote.textContent = 'Tick at least one field.'; return; }
        usedImport = true;
        updateCounts();
        diff.innerHTML = '';
        hNote.textContent = n + (n === 1 ? ' field' : ' fields') + ' filled in the form below. Press Save to keep them.';
      });
    }
  }

  window.UCPages.profileDeep = async function (root) {
    try {
      const slot = root && root.querySelector('[data-uc-slot="deep"]');
      if (!slot || !UCP) return;
      const me = UCP.user();
      const qid = UCP.params ? UCP.params().get('id') : null;
      if (qid && (!me || qid !== me.id)) {
        if (!validId(qid)) { slot.innerHTML = ''; return; }
        return renderOther(slot, qid);
      }
      if (!me || !validId(me.id)) { slot.innerHTML = ''; return; }
      return renderOwn(slot, me);
    } catch (e) { console.warn('[profile-deep]', e); }
  };
})();
