# Working on UniCircle (team guide)

## The rule
Work on **`uc-next`** (push directly, or use a branch + pull request for bigger changes).
Nobody edits the live server by hand — the live site only changes when Jean deploys.
FTP accounts are for the deploy step only, and each is limited to one folder.

## Backups & rolling back
Every push automatically creates a restore point: a tag `backup/<branch>/<time>-<sha>`
pointing at the state **just before** that push (workflow: `.github/workflows/backup-before-push.yml`).
```bash
git fetch --tags
git tag -l "backup/uc-next/*"          # list restore points (newest last)
git revert <bad-commit>                 # preferred: undo one commit, keeps history
git reset --hard backup/uc-next/<tag>   # or: go back to a restore point locally…
git push --force-with-lease             # …and publish it (admin only)
```

## Where things are
| What | Where |
|---|---|
| Live site | `unicircle.eu` (All-Inkl, folder `unicircle.eu/`) |
| Backend (accounts, posts, messages, waitlist) | `api.unicircle.eu` (PocketBase on Hetzner) |
| Source of truth | GitHub `ledger-j/alumni-network`, branch **`uc-next`** (matches live + new work) |

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
