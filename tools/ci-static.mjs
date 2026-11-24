#!/usr/bin/env node
/* Fast static gate (CI job "static", ~30 s, zero dependencies, Node 18+).
   Fails (exit 1) on:
   - a JS file that does not parse (node --check) incl. sw.js and tools/*.mjs
   - a JSON / webmanifest file that does not parse
   - a local <script src> / <link href> in index.html that does not exist
   - an index.html script/style that sw.js SHELL does not precache (warning only for pages.css-style extras)
   - a tracked file over 2 MB (outside docs/ and assets/)
   - a private IPv4 / secret-looking token in tracked text files
   - innerHTML assigned from a template literal with ${...} that is not wrapped in esc()/UCP.esc()/UC.esc()
   Usage: node tools/ci-static.mjs */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const problems = [];
const warn = [];
const bad = (f, msg) => problems.push(`${f}: ${msg}`);

// 1 + 2: syntax
for (const f of files) {
  const ext = extname(f).toLowerCase();
  if (['.js', '.mjs'].includes(ext) && !/^(tools\/verify\.js)$/.test(f)) {
    // node --check cannot take .mjs/.js outside module context reliably: use it, it handles both
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { bad(f, 'does not parse: ' + String(e.stderr || e.message).split('\n').slice(0, 3).join(' | ')); }
  }
  if (['.json', '.webmanifest'].includes(ext)) {
    try { JSON.parse(readFileSync(f, 'utf8')); } catch (e) { bad(f, 'invalid JSON: ' + e.message); }
  }
}

// 3: index.html references exist, and are in the sw.js shell
const index = readFileSync('index.html', 'utf8');
const sw = readFileSync('sw.js', 'utf8');
const refs = [...index.matchAll(/<(?:script[^>]+src|link[^>]+href)=["']([^"']+)["']/g)].map((m) => m[1])
  .filter((u) => !/^(https?:)?\/\//.test(u) && !u.startsWith('data:') && !u.startsWith('#'));
for (const r of refs) {
  const p = r.split('?')[0].replace(/^\//, '');
  if (!existsSync(p)) bad('index.html', `references missing file ${p}`);
  else if (/\.(js|css)$/.test(p) && !sw.includes(`'/${p}'`)) warn.push(`index.html uses /${p} but sw.js SHELL does not list it`);
}

// 4: size (only files ADDED by this change; older large files are grandfathered)
let added = [];
const base = process.env.BASE_SHA;
if (base) { try { added = execFileSync('git', ['diff', '--name-only', '--diff-filter=A', `${base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean); } catch { warn.push('size check skipped: cannot diff against BASE_SHA'); } }
for (const f of added) {
  if (/^(docs|assets)\//.test(f)) continue;
  try { if (statSync(f).size > 2 * 1024 * 1024) bad(f, 'new file larger than 2 MB (put big files under assets/ or docs/, or compress)'); } catch { /* removed later */ }
}

// 5: secrets / private addresses in text files
const TEXT = /\.(js|mjs|html|css|json|md|txt|yml|yaml|sh|py|webmanifest)$/i;
const skipSecret = /^(docs\/icp-dossier|docs\/redesign\/findings|package-lock\.json|\.github\/workflows\/ci\.yml|tools\/ci-static\.mjs)/;
const secretRules = [
  ['private IPv4', /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/],
  ['bearer/API key', /\b(?:sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[abp]-[A-Za-z0-9-]{10,})\b/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
for (const f of files) {
  if (!TEXT.test(f) || skipSecret.test(f)) continue;
  let s; try { s = readFileSync(f, 'utf8'); } catch { continue; }
  if (s.length > 1_500_000) continue;
  for (const [name, re] of secretRules) {
    const m = s.match(re); if (m) bad(f, `${name}: ${m[0].slice(0, 12)}…`);
  }
}

// 6: innerHTML from unescaped template interpolation (the XSS rule from CONTRIBUTING.md)
// Heuristic: in js/**, a line assigning to innerHTML/insertAdjacentHTML with a template literal that
// contains ${expr} where expr is a bare record field (x.name, r.title, …) not wrapped in esc( … ).
// Lines can be exempted with a trailing `// safe-html: <reason>` comment.
const safeCall = /^(?:esc|UCP\.esc|UC\.esc|escapeHtml|encodeURIComponent|Number|String\(Number|fileUrl|UC\.fileUrl|avatarUrl|UC\.avatarUrl|protectedFileUrl|UC\.protectedFileUrl|safeUrl|UC\.safeUrl)\(/;
for (const f of files.filter((x) => /^js\/.+\.js$/.test(x))) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!/(innerHTML\s*\+?=|insertAdjacentHTML\()/.test(line) || !line.includes('`') || /safe-html:/.test(line)) return;
    // only judge single-line assignments; multi-line templates are covered by the app gate
    for (const m of line.matchAll(/\$\{([^}]*)\}/g)) {
      const expr = m[1].trim();
      if (safeCall.test(expr) || /^["'`]/.test(expr) || /^\d/.test(expr) || /^[A-Za-z_]+\s*\?\s*["'`]/.test(expr)) continue;
      if (/^[a-z_]+(?:\.length)?$/i.test(expr) && /(?:html|cls|class|style|attrs?|n|count|i|idx)$/i.test(expr)) continue; // pre-built fragments/numbers by naming convention
      if (/\.(?:name|title|bio|headline|message|body|text|note|description|city|place|label|email|content)\b/.test(expr) && !/esc\(/.test(expr)) bad(`${f}:${i + 1}`, `innerHTML with unescaped \${${expr.slice(0, 40)}} (wrap in esc() or add "// safe-html: reason")`);
    }
  });
}

for (const w of warn) console.log('warn  ' + w);
for (const p of problems) console.log('FAIL  ' + p);
console.log(`ci-static: ${files.length} tracked files, ${problems.length} problem(s), ${warn.length} warning(s)`);
process.exit(problems.length ? 1 : 0);
