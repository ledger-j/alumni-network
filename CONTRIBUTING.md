# Working on UniCircle (team guide)

## The rule
`uc-next` is the only trunk and nobody pushes to it directly. Work on a branch (`claude/<lane>-<topic>` or
`<name>/<topic>`), open a pull request titled `UNICI-nn: what`, and turn on auto-merge. When `ci` is green it merges
itself (squash) and the branch is deleted. Changes under `backend/`, `deploy/`, `.github/`, `sw.js`, `CNAME`,
`CLAUDE.md` also need Jean's review. `main` is stale: ignore it.
Claude sessions and teammates share the contract in `CLAUDE.md` and the log in `docs/team/HANDOFF.md`.
Nobody edits the live server by hand; the live site only changes when Jean deploys.
FTP accounts are for the deploy step only, and each is limited to one folder.

## Checks (what makes a PR green)
`ci / static` (syntax, JSON, references, secrets, XSS heuristic, privacy), `ci / app-gate` (links, headless
Chromium on every route at 1440 and 390 px against the mock backend), `ci / backend-gates` (only when `backend/`
changed: real PocketBase with the hooks, schema applied twice, every `verify_*.py`). Run the same locally with the
commands in `CLAUDE.md`.

## Deploying (Jean)
Diff plain `uc-next` against the live site first (`deploy/site-deploy.sh` plan), look at every CHANGED file that is not
part of the release, apply once per release, keep the previous backup. Never deploy an unmerged branch.

## Backups & rolling back
Every push automatically creates a restore point: a tag `backup/<branch>/<time>-<sha>`
pointing at the state **just before** that push (workflow: `.github/workflows/backup-before-push.yml`;
tags older than 90 days are pruned).
```bash
git fetch --tags
git tag -l "backup/uc-next/*"          # list restore points (newest last)
git revert <bad-commit>                 # preferred: undo one commit, keeps history
```
Restoring a trunk to a tag is an admin-only emergency step (Jean bypasses the branch rules).

## Where things are
| What | Where |
|---|---|
| Live site | `unicircle.eu` (All-Inkl, folder `unicircle.eu/`) |
| Backend (accounts, posts, messages, waitlist) | `api.unicircle.eu` (PocketBase on Hetzner) |
| Source of truth for code | GitHub `ledger-j/alumni-network` (private), branch **`uc-next`**. The live site can differ: check drift before deploying |

## Run it locally
No build step, it's plain HTML/CSS/JS:
```bash
python -m http.server 5173
```
Open http://localhost:5173 (app) or http://localhost:5173/waitlist.html.

## How the app is put together
- `index.html` → `js/app.js` (router) loads `components/<page>.html` into the side-rail shell.
- Each page's behaviour lives in **`js/pages/<page>.js`** and registers `window.UCPages['<page>']`.
  Helpers (`UCP.go`, `UCP.dialog`, `UCP.toast`, `UCP.api`, …) are documented in `js/pages/_shared.js`.
- Cross-links use hash params: `#network?q=finance`, `#map?city=Berlin&layer=students`,
  `#events?id=<slug>`, `#jobs?id=<slug>`, `#mentoring?q=…`, `#pbl-hub?id=<slug>`, `#feed?compose=1`.
- Page styles: `css/p-<lane>.css`, built only on the `--uc-*` tokens in `css/redesign.css`.
- Map: `js/uc-map.js` (Leaflet). Privacy rule: **city / neighbourhood only, never streets; max zoom 11.**

## Waitlist
- Page: `waitlist.html` + `js/waitlist.js` + `css/waitlist.css`.
- Data: PocketBase collection `waitlist` (schema: `backend/waitlist_schema.py`, gate: `backend/verify_waitlist.py`).
- Track channels with `?ref=`: e.g. `unicircle.eu/waitlist.html?ref=linkedin-maxim` → stored in `source`.
- Read access is granted per person by Jean: `python3 waitlist_schema.py --grant you@example.com`.

## House rules
- Brand stays vendor-neutral: no university/faculty names in product copy.
- No fake engagement. Demo content is labelled **Sample**.
- Escape anything user-written (`UCP.esc`). Buttons are `<button>`, links are `<a href>`.
- Bump the `?v=` query on any CSS/JS you change in `index.html` so browsers refetch it.

_Restore points are listed under Tags on GitHub (`backup/…`)._
