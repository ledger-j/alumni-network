#!/usr/bin/env node
/* Fails (exit 1) when docs/icp-dossier/** contains personal contact data: e-mail addresses
   (except the project's own hello@unicircle.eu), phone-number-like digit runs, or LinkedIn
   profile links. Dossiers name organisations and public roles only (docs/redesign/objections.md P10).
   Usage: node tools/check-icp-privacy.mjs [dir=docs/icp-dossier] */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || 'docs/icp-dossier';
const rules = [
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/g, (m) => /^hello@unicircle\.eu$/i.test(m)],
  ['linkedin-profile', /linkedin\.com\/(in|pub)\/[^\s)"'<]+/gi, () => false],
  // international or national phone numbers: a leading + or 0 followed by 8+ digits with optional separators
  ['phone', /(?<![\w./-])(\+\d{1,3}|0\d)[\s().-]?(\d[\s().-]?){7,12}\d(?![\w-])/g, () => false],
];
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : /\.(md|html|json|csv|txt)$/i.test(n) && files.push(p); } })(root);

let bad = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const [kind, re, allow] of rules) {
      for (const m of line.matchAll(re)) {
        if (allow(m[0])) continue;
        bad++; console.log(`${f}:${i + 1}: ${kind}: ${m[0].slice(0, 60)}`);
      }
    }
  });
}
console.log(`checked ${files.length} files; ${bad} personal-data hit(s)`);
process.exit(bad ? 1 : 0);
