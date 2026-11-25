# UniCircle: contract for every Claude session and teammate

Read this, then `docs/team/HANDOFF.md` (newest first) and `docs/team/DECISIONS.md`, before you change anything.
When you finish, add one entry to HANDOFF.md.

## What this is
UniCircle (unicircle.eu): alumni network. Plain HTML/CSS/vanilla JS, no build step. Hash router `js/app.js`,
page modules `window.UCPages[route]` in `js/pages/`, backend = PocketBase 0.39.4 (`backend/`, hooks in `backend/pb_hooks/`).
The live site is on All-Inkl (KAS); the API is `api.unicircle.eu` on the Hetzner LMS box. Git is not the live site.

## Hard rules
1. **Never push to `uc-next`.** Work on `claude/<lane>-<topic>` (people: `<name>/<topic>`), open a PR titled `UNICI-nn: what`
   (Plane issue). It merges itself when `ci` is green. `backend/`, `deploy/`, `.github/`, `sw.js`, `CNAME`, `CLAUDE.md`
   also need Jean's review (CODEOWNERS).
2. **Never deploy without the drift check.** Diff plain `uc-next` against the live site first (`deploy/site-deploy.sh` plan),
   apply once per release, keep the previous backup. 2026-11-24 an unreviewed apply overwrote live-only edits.
3. **No secrets in chat, config or git.** Jean types passwords/tokens. Mail: port 465 implicit TLS preferred, 587 STARTTLS only if 465 is blocked.
4. **Production schema/hook runs, DNS, GitHub settings, visibility, API keys are Jean's steps.** Say so in the PR under "Needs a human".
5. **Privacy:** dossiers (`docs/icp-dossier/`) name organisations and public roles only; no emails, phones or LinkedIn profile links
   (`node tools/check-icp-privacy.mjs`). Map shows city level only.
6. **Escape user text** (`esc()`); buttons are `<button>`, links `<a href>`; demo content is labelled Sample; brand stays vendor-neutral.
7. **Say what you did not verify.** Green output from your own tool is not proof; run the gate.

## Run and check (all from the repo root)
| What | Command |
|---|---|
| Serve | `python -m http.server 5173` |
| Static gate | `node tools/ci-static.mjs` (set `BASE_SHA=<sha>` to also check new large files) |
| Privacy | `node tools/check-icp-privacy.mjs` |
| Links | `node tools/qa-crawler.mjs http://127.0.0.1:5173` |
| UI against mock backend | `node tools/mock-pb.mjs 8099`, open `/?api=http://127.0.0.1:8099#feed`; probe `tools/verify.js`; full: `node tools/ci-app-gate.mjs` (needs `playwright`) |
| Backend gates | real PocketBase with `backend/pb_hooks`, `python3 init_schema.py` twice, then every `backend/verify_*.py` (see `ci.yml` job `backend-gates`) |

CI check names: `ci / static`, `ci / app-gate`, `ci / backend-gates` (only when `backend/` changed), roll-up `ci / ci`.

## Lanes (who owns which files; do not edit another lane's files without a HANDOFF note)
| Lane | Files |
|---|---|
| frontend | `index.html`, `js/**`, `css/**`, `components/**`, `assets/**` |
| backend | `backend/**` (schema, hooks, `verify_*.py`) |
| deploy | `deploy/**`, `sw.js` VERSION, `.github/**` |
| research | `docs/icp-dossier/**`, `docs/redesign/findings-*` |
| team | `CLAUDE.md`, `AGENTS.md`, `docs/team/**`, `CONTRIBUTING.md` |

## How we talk
- **PR description** = the message to the next person: What / Why / Verified / Not verified / Needs a human / Deploy impact.
- **Labels:** `lane:*`, `needs:jean` (blocked on a human), `blocked`, `claude-working`, `deploy`.
- **`@claude`** in an issue or PR comment runs a session in GitHub (write-access commenters only).
- **HANDOFF.md** = append-only log, **DECISIONS.md** = rules that bind everyone, with the reason.
- Stuck on something only Jean can answer: put one short question in the PR with `needs:jean`, then stop.
