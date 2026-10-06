#!/usr/bin/env node
// UniCircle QA crawler — Track A (dead links / missing assets).
//
// A static-analysis crawler for the UniCircle SPA. It BFS-crawls same-origin
// *text* resources (HTML/JS/CSS), statically extracts every URL/asset/route/
// API path they reference (including the SPA's `routes` map and the `?v=`
// cache-busted component fetches that a plain HTTP crawler would miss because
// they only appear at runtime), then GETs every unique URL and reports the
// non-200s grouped by where they were referenced.
//
// Writes NOTHING to the backend. Read-only. stdlib/Node-builtins only.
//
//   node tools/qa-crawler.mjs                # crawl https://unicircle.eu
//   node tools/qa-crawler.mjs https://staging.example.com
//   node tools/qa-crawler.mjs --json         # machine-readable output
//
// Exit code: 0 if no broken same-origin resources, 1 otherwise (CI-friendly).

const ROOT = (process.argv.find((a) => a.startsWith('http')) || 'https://unicircle.eu').replace(/\/$/, '');
const JSON_OUT = process.argv.includes('--json');
const ORIGIN = new URL(ROOT).origin;

const seenPages = new Set();       // text resources we've already scanned
const refs = new Map();            // url -> Set(referrers)
const queue = [];                  // text resources to scan (same-origin HTML/JS/CSS)
const docs = new Map();            // url -> raw text (HTML/JS only; for the UX pass)

function addRef(url, from) {
  if (!refs.has(url)) refs.set(url, new Set());
  refs.get(url).add(from);
}

// Resolve a raw href/src against a base, dropping the un-checkable ones.
// `base` is already the correct document/file base chosen by the caller
// (browsers resolve fetch()/innerHTML-relative URLs against the PAGE, not the
// script/fragment that contains them — so JS and injected HTML pass ROOT here).
function resolve(raw, base) {
  if (!raw) return null;
  raw = raw.trim().replace(/^['"`]|['"`]$/g, '');
  if (!raw) return null;
  if (/^(data:|mailto:|tel:|javascript:|#)/i.test(raw)) return null;
  // Unexpanded template-literal fragments (`${...}`, or its %7B..%7D encoding)
  // are not real URLs — skip anything still carrying interpolation syntax.
  if (/[$`{}]|%7[bBdD]/.test(raw)) return null;
  let u;
  try { u = new URL(raw, base); } catch { return null; }
  // Bare origins (preconnect / dns-prefetch targets) aren't fetchable resources.
  if (u.pathname === '/' && !u.search) return null;
  return u.href;
}

const TEXT_EXT = /\.(html?|js|mjs|css)(\?|#|$)/i;
const isSameOrigin = (u) => { try { return new URL(u).origin === ORIGIN; } catch { return false; } };
const isText = (u) => TEXT_EXT.test(u);

const apiCalls = new Set();  // /api/... paths — runtime calls, not dead-link candidates

// Extract candidate URLs from a text blob. `kind` is 'css' | 'js' | 'html'.
// CSS url() resolves against the stylesheet's own URL; JS fetches and injected
// HTML fragments resolve against the document root (browser semantics).
function extract(text, fileUrl, kind) {
  const found = new Set();
  const cssBase = fileUrl;          // url() is relative to the .css file
  const docBase = ROOT + '/';       // fetch()/innerHTML are relative to the page
  const push = (m, base) => { const u = resolve(m, base); if (u) found.add(u); };

  // Record API paths separately (they're POST/param calls, checked via /api/health only).
  for (const m of text.matchAll(/["'`](\/api\/[^"'`\s${}]+)["'`]/g)) apiCalls.add(m[1]);

  if (kind === 'css') {
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) push(m[1], cssBase);
    return found;
  }
  // HTML attributes: href / src / poster (quoted)
  for (const m of text.matchAll(/\b(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi)) push(m[1], docBase);
  // JS/HTML string literals that look like local assets or SPA route fragments
  for (const m of text.matchAll(/["'`]([^"'`\s]+?\.(?:html?|js|mjs|css|png|jpe?g|gif|svg|webp|ico|woff2?|json))(\?[^"'`\s]*)?["'`]/gi)) push(m[1] + (m[2] || ''), docBase);
  return found;
}

async function check(url) {
  const started = Date.now();
  try {
    // GET (not HEAD — some static/CDN hosts and PocketBase mishandle HEAD).
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'UniCircle-QA-Crawler' } });
    return { url, status: res.status, ok: res.ok, ms: Date.now() - started, ctype: res.headers.get('content-type') || '' };
  } catch (e) {
    return { url, status: 0, ok: false, ms: Date.now() - started, error: String(e.message || e) };
  }
}

async function scanText(url, from) {
  if (seenPages.has(url)) return;
  seenPages.add(url);
  let res;
  try {
    res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'UniCircle-QA-Crawler' } });
  } catch (e) { return; }
  if (!res.ok) return;
  const text = await res.text();
  const kind = /\.css(\?|#|$)/i.test(url) ? 'css' : /\.(m?js)(\?|#|$)/i.test(url) ? 'js' : 'html';
  if (kind !== 'css') docs.set(url, text);   // HTML + JS carry the markup/templates the UX pass inspects
  for (const u of extract(text, url, kind)) {
    addRef(u, from ? `${shorten(from)} → ${shorten(url)}` : shorten(url));
    if (isSameOrigin(u) && isText(u) && !seenPages.has(stripHash(u))) queue.push({ url: stripHash(u), from: url });
  }
}

const stripHash = (u) => u.split('#')[0];
const shorten = (u) => u.replace(ROOT, '').replace(ORIGIN, '') || '/';
const squash = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 90);

// Static UX / a11y heuristics over the assembled markup (HTML fragments + the
// HTML templates embedded as JS strings). Warnings, not hard failures — tuned
// for near-zero false positives. Findings are deduped with an occurrence count.
function uxAudit() {
  const allText = [...docs.values()].join('\n');
  const allIds = new Set();
  for (const m of allText.matchAll(/\bid\s*=\s*["']([^"'${}]+)["']/g)) allIds.add(m[1]);
  const components = new Set();               // SPA route targets that actually exist
  for (const u of refs.keys()) { const m = u.match(/\/components\/([\w-]+)\.html/); if (m) components.add(m[1]); }
  const navPages = new Set();                 // every data-page value = a valid SPA hash-route
  for (const m of allText.matchAll(/data-page\s*=\s*["']([\w-]+)["']/gi)) navPages.add(m[1]);

  const altMap = new Map();                   // snippet -> {where, count}
  const anchors = new Map();                  // id -> {where, count}
  const nav = new Map();                      // page -> {where, count}
  const bump = (map, key, where) => { const e = map.get(key) || { where, count: 0 }; e.count++; map.set(key, e); };

  for (const [url, text] of docs) {
    const where = shorten(url);
    for (const m of text.matchAll(/<img\b[^>]*>/gi)) {
      if (!/\balt\s*=/i.test(m[0])) bump(altMap, squash(m[0]), where);
    }
    for (const m of text.matchAll(/href\s*=\s*["']#([\w-]+)["']/gi)) {
      // Skip SPA hash-routes (handled by the JS router via location.hash), which
      // match a component/nav name — they are navigation, not in-page anchors.
      if (components.has(m[1]) || navPages.has(m[1])) continue;
      if (!allIds.has(m[1])) bump(anchors, m[1], where);
    }
    for (const m of text.matchAll(/data-page\s*=\s*["']([\w-]+)["']/gi)) {
      if (!components.has(m[1])) bump(nav, m[1], where);
    }
  }
  return { altMap, anchors, nav };
}

async function main() {
  // Seed: the entry document + the two SPA scripts (their `routes`/asset
  // literals are the real map of what the app loads at runtime).
  queue.push({ url: `${ROOT}/`, from: null });
  queue.push({ url: `${ROOT}/index.html`, from: null });

  // BFS over text resources to build the full reference graph.
  while (queue.length) {
    const { url, from } = queue.shift();
    await scanText(stripHash(url), from);
  }

  // Check every referenced URL once.
  const urls = [...refs.keys()].sort();
  const results = [];
  const CONC = 8;
  for (let i = 0; i < urls.length; i += CONC) {
    results.push(...await Promise.all(urls.slice(i, i + CONC).map(check)));
  }

  // API liveness: probe the health endpoint on the api. sub-origin (the SPA's
  // real backend base), since /api/* calls don't live on the page origin.
  const apiBase = ORIGIN.replace('://', '://api.');
  const apiHealth = await check(`${apiBase}/api/health`);

  const broken = results.filter((r) => !r.ok);
  const sameBroken = broken.filter((r) => isSameOrigin(r.url));
  const extBroken = broken.filter((r) => !isSameOrigin(r.url));

  if (JSON_OUT) {
    console.log(JSON.stringify({ root: ROOT, checked: results.length, scanned: seenPages.size,
      broken: broken.map((r) => ({ ...r, referrers: [...(refs.get(r.url) || [])] })) }, null, 2));
  } else {
    const line = '─'.repeat(64);
    console.log(`\nUniCircle QA crawl — ${ROOT}`);
    console.log(`${line}\nText resources scanned : ${seenPages.size}`);
    console.log(`Unique URLs checked    : ${results.length}`);
    console.log(`Broken (same-origin)   : ${sameBroken.length}`);
    console.log(`Broken (external)      : ${extBroken.length}\n${line}`);
    const report = (title, list) => {
      if (!list.length) { console.log(`\n✔ ${title}: none`); return; }
      console.log(`\n✖ ${title}:`);
      for (const r of list.sort((a, b) => a.url.localeCompare(b.url))) {
        console.log(`  [${r.status || 'ERR'}] ${shorten(r.url)}${r.error ? '  (' + r.error + ')' : ''}`);
        for (const ref of refs.get(r.url) || []) console.log(`         ↳ referenced by ${ref}`);
      }
    };
    report('SAME-ORIGIN broken (fix these)', sameBroken);
    report('EXTERNAL broken (CDNs / third-party)', extBroken);
    console.log(`\n🔌 Backend: ${apiBase}/api/health → [${apiHealth.status || 'ERR'}] ${apiHealth.ok ? 'healthy' : 'UNREACHABLE'}`);
    console.log(`   ${apiCalls.size} distinct /api/ call paths referenced by the SPA (runtime; not link-checked).`);

    // UX / a11y warnings (heuristic — do not affect exit code).
    const ux = uxAudit();
    const totalUx = ux.altMap.size + ux.anchors.size + ux.nav.size;
    console.log(`\n${line}\nUX / a11y warnings (heuristic): ${totalUx}\n${line}`);
    if (ux.altMap.size) {
      console.log(`\n⚠ <img> without alt text (${ux.altMap.size} distinct):`);
      for (const [snip, e] of ux.altMap) console.log(`  ×${e.count}  ${snip}\n         ↳ in ${e.where}`);
    }
    if (ux.anchors.size) {
      console.log(`\n⚠ in-page anchors to a missing id (${ux.anchors.size}):`);
      for (const [id, e] of ux.anchors) console.log(`  ×${e.count}  href="#${id}"  ↳ in ${e.where}`);
    }
    if (ux.nav.size) {
      console.log(`\n⚠ nav data-page targets with no matching component route (${ux.nav.size}):`);
      for (const [page, e] of ux.nav) console.log(`  ×${e.count}  data-page="${page}"  ↳ in ${e.where}`);
    }
    if (!totalUx) console.log(`\n✔ no UX/a11y heuristics tripped`);
    // Slowest 5 OK resources — early smell test for perf.
    const slow = results.filter((r) => r.ok).sort((a, b) => b.ms - a.ms).slice(0, 5);
    console.log(`\n⏱ Slowest OK resources:`);
    for (const r of slow) console.log(`  ${String(r.ms).padStart(5)}ms  ${shorten(r.url)}`);
    console.log('');
  }
  process.exit(sameBroken.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
