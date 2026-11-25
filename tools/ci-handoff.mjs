#!/usr/bin/env node
/* Forcing function: a pull request that changes backend/ or deploy/ must also touch docs/team/HANDOFF.md,
   so the next Claude session or teammate learns what changed and what is still unverified.
   Usage: node tools/ci-handoff.mjs <base-sha> */
import { execFileSync } from 'node:child_process';
const base = process.argv[2];
if (!base) { console.log('handoff: no base sha, skipped'); process.exit(0); }
const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean);
const sensitive = changed.filter((f) => /^(backend|deploy)\//.test(f));
if (sensitive.length && !changed.includes('docs/team/HANDOFF.md')) {
  console.log(`FAIL ${sensitive.length} file(s) under backend/ or deploy/ changed but docs/team/HANDOFF.md was not updated:`);
  sensitive.slice(0, 10).forEach((f) => console.log('   ' + f));
  console.log('Add a dated entry at the top of docs/team/HANDOFF.md (who, branch/PR, what changed, what is unverified, what needs a human).');
  process.exit(1);
}
console.log('handoff: ok');
