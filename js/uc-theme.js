/* ==========================================================================
   UniCircle: per-member accent colour ("my own UI colour")
   One number (hue 0-360) re-tints the rail, buttons, focus ring and the
   constellation. Lightness and chroma are FIXED per use, so any hue a member
   picks keeps WCAG AA: text is never accent-coloured, buttons use a dark tone
   (L 0.34) under paper text (contrast > 8:1), halos and lines use mid tones.
   No accent chosen = the default brand look (no attribute on <html>).
   UCTheme.get()            -> hue | null
   UCTheme.set(hue|null)    -> applies, remembers on this device, fires 'uc:theme'
   UCTheme.palette(L)       -> four oklch() strings around the accent (or null)
   UCTheme.presets          -> named hues for the picker
   Server copy lives in the member's own settings (see js/pages/profile.js);
   the device copy makes the colour appear before the profile has loaded.
   ========================================================================== */
(function () {
  'use strict';
  const KEY = 'uc_accent_h';
  const root = document.documentElement;
  const presets = [
    { name: 'Ink', hue: null },
    { name: 'Sky', hue: 235 }, { name: 'Violet', hue: 275 }, { name: 'Orchid', hue: 305 },
    { name: 'Rose', hue: 10 }, { name: 'Ember', hue: 45 }, { name: 'Moss', hue: 145 }, { name: 'Teal', hue: 185 },
  ];
  const clamp = (h) => ((Math.round(Number(h)) % 360) + 360) % 360;
  let hue = null;

  function apply(h) {
    hue = h == null || h === '' || Number.isNaN(Number(h)) ? null : clamp(h);
    if (hue == null) { root.removeAttribute('data-accent'); root.style.removeProperty('--uc-accent-h'); }
    else { root.setAttribute('data-accent', ''); root.style.setProperty('--uc-accent-h', String(hue)); }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', hue == null ? '#3a3934' : 'oklch(0.26 0.03 ' + hue + ')');
  }

  function get() { return hue; }
  function set(h, opts) {
    apply(h);
    try { if (hue == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(hue)); } catch (e) { /* private mode */ }
    if (!opts || opts.silent !== true) document.dispatchEvent(new CustomEvent('uc:theme', { detail: { hue } }));
  }
  function palette(L) {
    if (hue == null) return null;
    const l = L || 0.74, offs = [0, 38, -38, 150];
    return offs.map((o) => 'oklch(' + l + ' 0.14 ' + clamp(hue + o) + ')');
  }

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
  apply(saved);                                 // before first paint of the app shell

  window.UCTheme = { get, set, palette, presets, apply };
})();
