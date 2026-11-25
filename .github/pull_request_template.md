<!-- Title: "UNICI-nn: short what" (links the Plane issue). Branch: claude/<lane>-<topic> or <name>/<topic>. -->
## What
## Why
## Verified (command and result, not "should work")
- [ ] `node tools/ci-static.mjs`
- [ ] app gate / backend gates (CI shows them)
-
## Not verified
## Needs a human (decision, secret, production step) - add label `needs:jean`
## Deploy impact
- [ ] none (docs/tools only)
- [ ] front end only: `sw.js` VERSION bumped, drift check against the live site done (`deploy/site-deploy.sh` plan)
- [ ] schema or hooks (`backend/`): HANDOFF line added, production run is Jean's step
