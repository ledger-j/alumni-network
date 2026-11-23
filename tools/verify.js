// Deterministic defect probe for /design-workflow step 5.
// Run inside the page via mcp__playwright__browser_evaluate (function form) or the
// built-in browser's javascript_tool. Returns JSON; `defects.length === 0` is the only
// green. Model judgement is layered ON TOP of this, never instead of it.
() => {
  const defects = [];
  const vw = document.documentElement.clientWidth;
  const add = (kind, el, detail) => defects.push({
    kind,
    where: el ? (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '')) : 'page',
    detail,
  });

  // 1. Horizontal page scroll
  if (document.documentElement.scrollWidth > vw + 1) add('h-scroll', null, `scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);

  const all = [...document.body.querySelectorAll('*')];
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // 2. Element bleeding past the viewport
    // (Project fix: items inside a horizontally scrolling container, e.g. the mobile tab bar, are contained, not page overflow.)
    const contained = n => { for (let a = n.parentElement; a && a !== document.body; a = a.parentElement) { const c = getComputedStyle(a); if (/auto|scroll|hidden|clip/.test(c.overflowX) && a.getBoundingClientRect().right <= vw + 1) return true; } return false; };
    if (r.right > vw + 1 && cs.position !== 'fixed' && !contained(el)) add('overflow-x', el, `right ${Math.round(r.right)} > ${vw}`);
    // 3. Clipped text (overflow hidden + content larger than box)
    if (r.width > 1 && r.height > 1 && /hidden|clip/.test(cs.overflow) && el.childElementCount === 0 && el.textContent.trim() && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && cs.textOverflow !== 'ellipsis' && !cs.webkitLineClamp?.match(/\d/)) add('clipped-text', el, el.textContent.trim().slice(0, 40));
    // 4. Tap targets on mobile
    if (vw < 600 && el.matches('a,button,[role=button],input,select,textarea') && (r.width < 24 || r.height < 24)) add('tap-target', el, `${Math.round(r.width)}x${Math.round(r.height)}`);
  }

  // 5. Broken images
  for (const img of document.images) if (img.complete && img.naturalWidth === 0) add('broken-img', img, img.currentSrc || img.src);
  // 6. Images without alt
  for (const img of document.images) if (!img.hasAttribute('alt')) add('img-no-alt', img, img.src.split('/').pop());

  // 7. Text contrast (WCAG AA, solid backgrounds only; skips gradients/images)
  // Any CSS colour (rgb, oklch, color-mix, named) -> [r,g,b,a] via a 1x1 canvas.
  // (Project fix: the original number-parser read oklch(0.9 0.06 275) as rgb 0.9/0.06/275.)
  const _cv = document.createElement('canvas'); _cv.width = _cv.height = 1;
  const _cx = _cv.getContext('2d', { willReadFrequently: true });
  const rgb = s => { _cx.clearRect(0, 0, 1, 1); _cx.fillStyle = '#000'; _cx.fillStyle = s; _cx.fillRect(0, 0, 1, 1); const d = _cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = ([r, g, b]) => { const f = c => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = el => { for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none') return null; const c = rgb(cs.backgroundColor); if (c.length && (c[3] ?? 1) > 0.9) return c; } return [255, 255, 255]; };
  for (const el of all) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const bg = bgOf(el); if (!bg) continue;
    const L1 = lum(rgb(cs.color)), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) add('contrast', el, `${ratio.toFixed(2)}:1 "${el.textContent.trim().slice(0, 30)}"`);
  }

  // 8. Motion rules (Emil): long transitions, default `ease`, reduced-motion unhandled
  const sheetsText = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
  for (const el of all) {
    const cs = getComputedStyle(el);
    const durs = cs.transitionDuration.split(',').map(d => parseFloat(d) * (d.includes('ms') ? 1 : 1000));
    if (cs.transitionProperty !== 'none' && durs.some(d => d > 300) && !el.matches('[data-dw-long-motion]')) add('motion-slow', el, cs.transitionDuration);
  }
  if (/transition|animation/.test(sheetsText) && !/prefers-reduced-motion/.test(sheetsText)) add('no-reduced-motion', null, 'animations present without a prefers-reduced-motion rule');

  // dedupe by kind+where, cap per kind (cap is reported, not silent)
  const seen = new Set(), out = [], perKind = {}, dropped = {};
  for (const d of defects) { const k = d.kind + d.where; if (seen.has(k)) continue; seen.add(k); perKind[d.kind] = (perKind[d.kind] || 0) + 1; if (perKind[d.kind] > 15) { dropped[d.kind] = (dropped[d.kind] || 0) + 1; continue; } out.push(d); }
  return { viewport: vw, defects: out, dropped, green: defects.length === 0 };
}
