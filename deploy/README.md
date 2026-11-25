# Deploying unicircle.eu

The live site is static files on All-Inkl KAS (`/www/htdocs/w0150658/unicircle.eu`), not GitHub Pages.
`origin/uc-next` is the branch that goes live. Merging a PR does **not** deploy it. Someone has to run the script.

## The flow

1. PR merged into `uc-next`.
2. **Plan:** `deploy/site-deploy.sh` lists every file whose content differs between `uc-next` and what https://unicircle.eu serves. CRLF-only differences are ignored. Read the list.
3. **Apply:** `deploy/site-deploy.sh --apply` overwrites the one backup, uploads only the differing files and writes `/deploy-version.txt`. It never deletes anything on live.
4. **Verify (automatic after apply, or on its own):** `deploy/site-deploy.sh --verify` fetches every file over public HTTPS with a cache-buster and compares it to the ref. Exit 0 and `VERIFIED` is the only state that counts as "live".

Use `--only <path>` (repeatable) to deploy or verify a subset, and `--ref <ref>` for another branch.
Files that must never be uploaded go in `deploy/.deployignore`.

## Caching

There is no CDN in front of KAS (plain nginx, no Cloudflare), so there is no server cache to purge.
CSS/JS are loaded with `?v=` versions, so bump `?v=` in the HTML whenever a CSS/JS file changes.
If a browser still shows old HTML, a hard refresh (Ctrl+F5) is enough.

**Never edit files on the server by hand.** A hand edit shows up as `CHANGED` in the next plan, and `--apply`
would overwrite it with the repo. Put the change in a PR instead.

## Running it from DeploymentHub (Claude on the box)

DeploymentHub deploys over **FTPS** with an All-Inkl FTP user whose home is `unicircle.eu/` only, so the box
never holds the main KAS login (which covers ~45 other domains). This is the default `DEPLOY_TRANSPORT=ftp`.

One-time setup:
1. **Jean, in the KAS panel:** FTP → new FTP user, directory `/unicircle.eu/`, strong password.
2. **Jean, on DeploymentHub** (Claude never types the password):
   `printf 'machine w0150658.kasserver.com login <ftp-user> password <password>\n' >> ~/.netrc && chmod 600 ~/.netrc`
3. `lftp` installed, repo cloned at `/opt/alumni-network`.

Then on the box: `cd /opt/alumni-network && deploy/site-deploy.sh` (plan), `--apply` (deploy + verify).
Or ask `claude` there: "run deploy/site-deploy.sh, show me the plan, then --apply and report the verify line".
The FTPS backup is one mirror at `~/backups/unicircle.eu-latest`, overwritten each run.

From Jean's laptop with the main KAS login: `DEPLOY_TRANSPORT=ssh deploy/site-deploy.sh --apply`.

## Backend changes are separate

PocketBase (`api.unicircle.eu`) runs on the Hetzner LMS box. Schema scripts such as
`backend/waitlist_answers_schema.py --verify` run there and ask for the superuser login. Run them **before**
publishing a page that sends the new fields. PocketBase silently drops fields it does not know.
