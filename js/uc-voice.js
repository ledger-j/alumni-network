/* UniCircle "Jev" assistant v1: talk to the app by voice or text.

   Pipeline (same for speech and typed text):
     utterance -> local intent match (voice/intents.json; normalize, accent-strip, regex)
               -> perform the action (allow-list only) -> speak the line from voice/responses.json
     no local match -> POST /api/uc/jev {text, lang} (backend/pb_hooks/uc_jev.pb.js) -> speak `say`;
               an action Jev returns runs ONLY if it is in intents.json allowedActions.
   Signed-in members only (window.UC.state.user). Speech recognition uses the browser's own
   service (window.SpeechRecognition / webkitSpeechRecognition); without it the panel still
   takes typed text. Speaking uses speechSynthesis and respects the mute toggle (localStorage).
   Shortcut: V (ignored while typing). Test hooks: window.UCVoice.handle(text), .open().
   The matcher is pure and also loads in Node (tools/voice-intents.test.mjs).            */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ pure matcher
  function normalize(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  const reCache = new Map();
  function patternRe(p) {
    if (!reCache.has(p)) reCache.set(p, new RegExp('^' + normalizePattern(p).replace('{q}', '(.+)') + '$'));
    return reCache.get(p);
  }
  // Patterns are already plain lower-case words + ( | )? groups; accents are stripped too.
  function normalizePattern(p) {
    return String(p).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
  }
  function stripFillers(t, fillers) {
    const list = (fillers || []).map(normalize).filter(Boolean).sort((a, b) => b.length - a.length);
    let changed = true;
    while (changed && t) {
      changed = false;
      for (const f of list) {
        if (t === f) continue;
        if (t.startsWith(f + ' ')) { t = t.slice(f.length + 1); changed = true; }
        if (t.endsWith(' ' + f)) { t = t.slice(0, -(f.length + 1)); changed = true; }
      }
    }
    return t;
  }
  // Returns {id, action, lang, slots} or null. `prefer` = language tried first.
  function match(text, intents, prefer) {
    if (!intents || !Array.isArray(intents.intents)) return null;
    const norm = normalize(text);
    if (!norm) return null;
    const langs = (intents.languages || ['en']).slice().sort((a, b) => (a === prefer ? -1 : b === prefer ? 1 : 0));
    for (const lang of langs) {
      const stripped = stripFillers(norm, intents.fillers && intents.fillers[lang]);
      const cands = stripped === norm ? [norm] : [norm, stripped];
      for (const it of intents.intents) {
        for (const p of (it.patterns && it.patterns[lang]) || []) {
          let m = null;
          for (const t of cands) { m = patternRe(p).exec(t); if (m) break; }
          if (!m) continue;
          const slots = {};
          if (p.indexOf('{q}') >= 0) slots.q = slotFromOriginal(text, m[m.length - 1]);
          return { id: it.id, action: it.action, lang: lang, slots: slots };
        }
      }
    }
    return null;
  }
  // The slot is always the tail of the utterance: give back the member's own spelling
  // (Munchen stays München) when the word count lines up, else the normalized words.
  function slotFromOriginal(text, normQ) {
    const nq = String(normQ || '').trim();
    const words = String(text).trim().replace(/[.!?,;:]+$/, '').split(/\s+/);
    const n = nq.split(' ').length;
    const tail = words.slice(-n).join(' ');
    return normalize(tail) === nq ? tail : nq;
  }
  // "search:network:berlin" (Jev form) -> {action:'search:network', slots:{q:'berlin'}}; null if not allowed.
  function allowed(action, intents) {
    if (typeof action !== 'string' || !action) return null;
    let base = action.trim(), slots = {};
    if (base.indexOf('search:network:') === 0) { slots.q = base.slice(15).trim(); base = 'search:network'; }
    const list = (intents && intents.allowedActions) || [];
    return list.indexOf(base) >= 0 ? { action: base, slots: slots } : null;
  }
  const core = { normalize: normalize, match: match, allowed: allowed };

  if (typeof root.document === 'undefined') {           // Node: export the matcher only
    if (typeof module === 'object' && module.exports) module.exports = core;
    return;
  }

  // ------------------------------------------------------------------ browser
  const doc = root.document;
  const ROUTES = ['feed', 'network', 'map', 'mentoring', 'events', 'pbl-hub', 'jobs', 'profile'];
  const MUTE_KEY = 'uc_jev_mute';
  let INTENTS = null, RESP = null, loading = null;
  let rec = null, listening = false, panel = null;

  const user = () => (root.UC && root.UC.state && root.UC.state.user) || null;
  const lang2 = () => {
    const l = String((root.navigator && root.navigator.language) || 'en').slice(0, 2).toLowerCase();
    return l === 'nl' || l === 'de' ? l : 'en';
  };
  const bcp47 = (l) => ({ nl: 'nl-NL', de: 'de-DE' })[l] || 'en-GB';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const muted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; } };
  const setMuted = (v) => { try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch (e) { /* ignore */ } };
  const SR = root.SpeechRecognition || root.webkitSpeechRecognition || null;

  function load() {
    if (INTENTS && RESP) return Promise.resolve();
    if (!loading) {
      const get = (u) => fetch(u, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      loading = Promise.all([get('voice/intents.json?v=1'), get('voice/responses.json?v=1')])
        .then((a) => { INTENTS = a[0]; RESP = a[1]; })
        .catch((e) => { loading = null; throw e; });
    }
    return loading;
  }
  function line(key, lang, slots) {
    const l = lang || lang2();
    const src = (RESP && ((RESP.intents && RESP.intents[key]) || (RESP.system && RESP.system[key]))) || {};
    const s = src[l] || src.en || '';
    return s.replace('{q}', (slots && slots.q) || '');
  }
  function speak(text, lang) {
    if (!text || muted() || !root.speechSynthesis || !root.SpeechSynthesisUtterance) return;
    try {
      root.speechSynthesis.cancel();
      const u = new root.SpeechSynthesisUtterance(text);
      u.lang = bcp47(lang || lang2());
      root.speechSynthesis.speak(u);
    } catch (e) { /* speaking is a bonus */ }
  }

  // ------------------------------------------------------------------ actions
  function routeExists(r) {
    return ROUTES.indexOf(r) >= 0 || !!(root.UCPages && root.UCPages[r])
      || !!doc.querySelector('.uc-rail [data-route="' + r + '"]');
  }
  function whenEl(sel, ms) {
    return new Promise((res) => {
      const end = Date.now() + (ms || 4000);
      (function poll() {
        const el = doc.querySelector(sel);
        if (el && !el.hidden) return res(el);
        if (Date.now() > end) return res(null);
        setTimeout(poll, 120);
      })();
    });
  }
  // Runs an allow-listed action. Returns false when the action cannot run here.
  function perform(action, slots) {
    const a = allowed(action, INTENTS);
    if (!a) return false;
    slots = Object.assign({}, a.slots, slots || {});
    const [kind, arg] = a.action.split(':');
    if (kind === 'go') {
      if (!routeExists(arg)) return false;
      root.location.hash = '#' + arg;
      return true;
    }
    if (a.action === 'open:messages') { if (root.UC && root.UC.openChat) root.UC.openChat(); return true; }
    if (a.action === 'open:jev') { open(); return true; }
    if (a.action === 'help') { open(); return true; }
    if (a.action === 'search:network') {
      const q = String(slots.q || '').trim().slice(0, 80);
      root.location.hash = '#network' + (q ? '?q=' + encodeURIComponent(q) : '');
      return true;
    }
    if (kind === 'profile') {
      const sel = arg === 'change-cover' ? '[data-pf-cover-change]' : '[data-pf-photo-change]';
      const activation = !!(root.navigator && root.navigator.userActivation && root.navigator.userActivation.isActive);
      if (!/^#profile/.test(root.location.hash)) root.location.hash = '#profile';
      whenEl(sel).then((btn) => {
        if (!btn) return;
        btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
        // A file picker needs a fresh user gesture: click when we still have one (typed text),
        // otherwise point at the button so one press opens it.
        if (activation && root.navigator.userActivation.isActive) { btn.click(); return; }
        btn.classList.add('uc-jev-point');
        btn.focus({ preventScroll: true });
        setTimeout(() => btn.classList.remove('uc-jev-point'), 2400);
      });
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ pipeline
  async function handle(text) {
    text = String(text || '').trim().slice(0, 1000);
    if (!text) return { source: 'none', say: '' };
    try { await load(); } catch (e) { say(line('error'), 'en', 'err'); return { source: 'none', say: '' }; }
    if (!user()) { const s = line('signed-out'); say(s); return { source: 'none', say: s }; }
    log(text, 'me');
    const m = match(text, INTENTS, lang2());
    if (m) {
      const ok = perform(m.action, m.slots);
      const s = ok ? line(m.id, m.lang, m.slots) : line('not-here', m.lang);
      say(s, m.lang);
      return { source: 'local', intent: m.id, action: m.action, slots: m.slots, done: ok, say: s };
    }
    setBusy(true);
    try {
      const r = await root.UC.api('POST', '/api/uc/jev', { text: text, lang: lang2() });
      const s = String((r && r.say) || line('fallback'));
      const a = allowed(r && r.action, INTENTS);
      const ok = a ? perform(a.action, a.slots) : false;
      say(s);
      return { source: 'jev', action: a ? a.action : null, done: ok, say: s };
    } catch (err) {
      const st = err && err.status;
      const key = (st === 501 || st === 404) ? 'jev-off' : st === 429 ? 'busy' : st === 401 ? 'signed-out' : 'error';
      const out = line(key);
      say(out, null, key === 'error' ? 'err' : '');
      return { source: 'none', error: st || 'network', say: out };
    } finally { setBusy(false); }
  }

  // ------------------------------------------------------------------ panel UI
  const MIC = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>';
  function build() {
    if (panel && doc.body.contains(panel)) return panel;
    panel = doc.createElement('section');
    panel.className = 'uc-jev';
    panel.id = 'uc-jev';
    panel.setAttribute('aria-label', 'Jev assistant');
    panel.hidden = true;
    panel.innerHTML =
      '<header class="uc-jev-head"><span class="uc-jev-dot" aria-hidden="true"></span><h2 class="uc-jev-title">Jev</h2>'
      + '<button type="button" class="uc-jev-mute" aria-pressed="false" title="Mute spoken answers">Sound on</button>'
      + '<button type="button" class="uc-jev-x" aria-label="Close Jev">×</button></header>'
      + '<div class="uc-jev-log" role="log" aria-live="polite"></div>'
      + '<p class="uc-jev-interim" aria-hidden="true"></p>'
      + '<form class="uc-jev-form" novalidate>'
      + '<label class="uc-jev-sr" for="uc-jev-in">Ask Jev or give a command</label>'
      + '<input id="uc-jev-in" type="text" maxlength="1000" autocomplete="off" placeholder="Try: go to the map">'
      + '<button type="button" class="uc-jev-mic" aria-pressed="false" aria-label="Speak to Jev">' + MIC + '</button>'
      + '<button type="submit" class="uc-jev-send">Send</button></form>'
      + '<p class="uc-jev-fine">Commands run in your browser. Other questions go to Jev (Google Gemini) without emails, phone numbers or links. <a href="privacy.html#jev">Privacy</a></p>';
    doc.body.appendChild(panel);
    const muteBtn = panel.querySelector('.uc-jev-mute');
    const syncMute = () => { const m = muted(); muteBtn.setAttribute('aria-pressed', String(m)); muteBtn.textContent = m ? 'Muted' : 'Sound on'; };
    syncMute();
    muteBtn.addEventListener('click', () => { setMuted(!muted()); syncMute(); if (muted() && root.speechSynthesis) root.speechSynthesis.cancel(); });
    panel.querySelector('.uc-jev-x').addEventListener('click', close);
    panel.querySelector('.uc-jev-mic').addEventListener('click', toggleListen);
    panel.querySelector('.uc-jev-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = panel.querySelector('#uc-jev-in');
      const v = inp.value; inp.value = '';
      handle(v);
    });
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    return panel;
  }
  function log(text, who) {
    const p = build();
    const box = p.querySelector('.uc-jev-log');
    const el = doc.createElement('p');
    el.className = 'uc-jev-msg uc-jev-' + (who || 'jev');
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 30) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }
  function say(text, lang, cls) {
    if (!text) return;
    log(text, cls === 'err' ? 'err' : 'jev');
    speak(text, lang);
  }
  function setBusy(b) { const p = build(); p.classList.toggle('is-busy', !!b); }
  function interim(t) { const p = build(); p.querySelector('.uc-jev-interim').textContent = t || ''; }
  function open(focusInput) {
    const p = build();
    const wasHidden = p.hidden;
    p.hidden = false;
    if (wasHidden && !p.querySelector('.uc-jev-log').children.length) {
      load().then(() => log(line('open_jev'), 'jev')).catch(() => {});
    }
    if (focusInput !== false) p.querySelector('#uc-jev-in').focus();
    return p;
  }
  function close() {
    stopListen();
    if (panel) panel.hidden = true;
    const b = doc.getElementById('uc-rail-jev');
    if (b) b.focus();
  }
  function setPressed(v) {
    doc.querySelectorAll('#uc-rail-jev, .uc-jev-mic').forEach((b) => {
      b.setAttribute('aria-pressed', String(!!v));
      b.classList.toggle('is-on', !!v);
    });
  }
  function stopListen() {
    if (rec) { try { rec.abort(); } catch (e) { /* ignore */ } }
    listening = false; setPressed(false); interim('');
  }
  function toggleListen() {
    if (!user()) return;
    if (listening) { stopListen(); return; }
    open(false);
    if (!SR) {
      load().then(() => say(line('not-supported'))).catch(() => {});
      panel.querySelector('#uc-jev-in').focus();
      return;
    }
    if (root.speechSynthesis) root.speechSynthesis.cancel();
    rec = new SR();
    rec.lang = bcp47(lang2());
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e) => {
      let fin = '', tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript; else tmp += r[0].transcript;
      }
      interim(tmp || fin);
      if (fin) { interim(''); handle(fin); }
    };
    rec.onerror = (e) => {
      const err = e && e.error;
      if (err === 'not-allowed' || err === 'service-not-allowed') load().then(() => say(line('not-supported'))).catch(() => {});
      stopListen();
    };
    rec.onend = () => { listening = false; setPressed(false); interim(''); };
    try {
      rec.start(); listening = true; setPressed(true);
      load().then(() => interim(line('listening'))).catch(() => {});
    } catch (e) { stopListen(); }
  }

  // Rail button (rendered by js/app.js railHtml) + shortcut V.
  doc.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('#uc-rail-jev');
    if (!b) return;
    e.preventDefault();
    if (!user()) return;
    if (!SR) { open(); load().then(() => { if (!panel.dataset.ns) { panel.dataset.ns = '1'; say(line('not-supported')); } }).catch(() => {}); return; }
    toggleListen();
  });
  doc.addEventListener('keydown', (e) => {
    if (e.key !== 'v' && e.key !== 'V') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target;
    const tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (doc.querySelector('dialog[open]')) return;
    if (!user()) return;
    e.preventDefault();
    if (!SR) { open(); return; }
    toggleListen();
  });

  root.UCVoice = { handle: handle, open: open, close: close, match: (t) => load().then(() => match(t, INTENTS, lang2())), _core: core };
})(typeof window !== 'undefined' ? window : globalThis);
