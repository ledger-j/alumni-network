# Decisions that bind everyone (newest first)

| Date | Decision | Why |
|---|---|---|
| 2026-11-25 | Public sign-up is closed (users createRule = null; OAuth2 cannot create accounts). The waitlist is the only public entry. Members sign in at hidden `#signin` | Stop anonymous account creation; keep access gated |
| 2026-11-25 | Testers enter via `https://unicircle.eu/#enter/<UC_TESTER_KEY>`. The key lives only in `/opt/unicircle/.env` on the LMS box (written by Jean; never in git or chat). Each tester gets a personal flagged account with a per-device secret, so the same name on another device is a new account. Cap 200. Rotate the key to close the link; run `backend/tester_admin.py --purge` to remove testers | Controlled tester access without public sign-up; no secret in the repo |
| 2026-11-25 | Profile cover is LinkedIn 4:1 (1584x396); avatar 400x400 | One image spec for all profiles |
| 2026-11-25 | "Jev" is the UniCircle AI assistant. Local voice/text intents in `voice/intents.json` and `voice/responses.json` run first. The Gemini fallback `/api/uc/jev` stays off until `GEMINI_API_KEY` is in `/opt/unicircle/.env`. Memory in `jev_memory` is owner-only and deletable. Model output is untrusted: actions are allow-listed and memory is fenced as data | Cheap local answers first; model output cannot act on its own |
| 2026-11-25 | The deploy filter now ships `.json` and `.webmanifest` | Manifest and data files were missing from live deploys |
| 2026-11-24 | One trunk `uc-next`; every change is a short-lived PR that auto-merges on green `ci`; sensitive paths need Jean | Direct pushes had no gate; two trunks (`main`, `uc-next`) confused everyone |
| 2026-11-24 | Repo is private; GitHub Pages is not used (All-Inkl serves unicircle.eu) | Repo holds internal minutes and server details; Pages published the whole repo |
| 2026-11-24 | Deploy: diff plain `uc-next` against live first, apply once per release, keep the previous backup | An unreviewed apply overwrote live-only edits and the single backup |
| 2026-11-24 | Contact is gated in one place (`contactCheck`: open / points / request / closed) | Protect high-value alumni from spam |
| 2026-11-24 | Status points are written only by a server hook in one transaction, never by clients | Prevents farming and races |
| 2026-11-24 | Hook helpers are shared with `require(`${__hooks}/uc_lib.js`)` | PocketBase hook handlers are isolated |
| 2026-11-24 | Location lives in `user_locations`, coarse (about 0.05 degrees), opt-in | Privacy |
| 2026-11-24 | Agents have a 150k-token ceiling and return partial work at about 120k | They overshoot otherwise |
