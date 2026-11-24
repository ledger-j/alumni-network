#!/usr/bin/env node
/* CI app gate: headless Chromium opens every route of the SPA at 1440 and 390 px against the mock backend
   and runs tools/verify.js (the deterministic defect probe) in the page.
   Requires: app on http://127.0.0.1:5173, tools/mock-pb.mjs on :8099, `playwright` resolvable (NODE_PATH).
   Ship-blockers (exit 1): h-scroll, overflow-x, contrast, tap-target, broken-img, img-no-alt, console errors.
   Reported only: clipped-text, motion-slow, no-reduced-motion. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const APP = process.env.APP || 'http://127.0.0.1:5173';
const API = process.env.API || 'http://127.0.0.1:8099';
const routes = ['feed', 'network', 'events', 'jobs', 'mentoring', 'profile', 'pbl-hub', 'map'];
const sizes = [[1440, 900], [390, 844]];
const BLOCK = new Set(['h-scroll', 'overflow-x', 'contrast', 'tap-target', 'broken-img', 'img-no-alt']);
const probe = readFileSync(new URL('./verify.js', import.meta.url), 'utf8');

const login = await (await fetch(`${API}/mock/login?user=u1`, { method: 'POST' })).json();
const browser = await chromium.launch();
let blockers = 0, notes = 0;

for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  await ctx.addInitScript(({ api, auth }) => {
    localStorage.setItem('uc_api_base', api);
    localStorage.setItem('uc_auth', JSON.stringify(auth));
  }, { api: API, auth: { token: login.token, user: login.record } });
  for (const r of routes) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_FAILED|net::/.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); });
    await page.goto(`${APP}/index.html#${r}`, { waitUntil: 'load' });
    await page.waitForSelector('#page-root > *, main > *', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(900); // route view-transition + first render settle (known flake otherwise)
    const res = await page.evaluate(`(${probe.trim().replace(/;$/, '')})()`);
    const hard = res.defects.filter((d) => BLOCK.has(d.kind));
    const soft = res.defects.filter((d) => !BLOCK.has(d.kind));
    const tag = `${r}@${w}`;
    if (hard.length || errors.length) {
      blockers += hard.length + errors.length;
      console.log(`FAIL ${tag}`);
      hard.forEach((d) => console.log(`   ${d.kind} ${d.where} ${d.detail}`));
      errors.forEach((e) => console.log('   ' + e));
    } else console.log(`ok   ${tag}`);
    soft.forEach((d) => { notes++; console.log(`   note ${d.kind} ${d.where} ${d.detail}`); });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`app-gate: ${blockers} blocker(s), ${notes} note(s)`);
process.exit(blockers ? 1 : 0);
