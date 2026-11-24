# Decisions that bind everyone (newest first)

| Date | Decision | Why |
|---|---|---|
| 2026-11-24 | One trunk `uc-next`; every change is a short-lived PR that auto-merges on green `ci`; sensitive paths need Jean | Direct pushes had no gate; two trunks (`main`, `uc-next`) confused everyone |
| 2026-11-24 | Repo is private; GitHub Pages is not used (All-Inkl serves unicircle.eu) | Repo holds internal minutes and server details; Pages published the whole repo |
| 2026-11-24 | Deploy: diff plain `uc-next` against live first, apply once per release, keep the previous backup | An unreviewed apply overwrote live-only edits and the single backup |
| 2026-11-24 | Contact is gated in one place (`contactCheck`: open / points / request / closed) | Protect high-value alumni from spam |
| 2026-11-24 | Status points are written only by a server hook in one transaction, never by clients | Prevents farming and races |
| 2026-11-24 | Hook helpers are shared with `require(`${__hooks}/uc_lib.js`)` | PocketBase hook handlers are isolated |
| 2026-11-24 | Location lives in `user_locations`, coarse (about 0.05 degrees), opt-in | Privacy |
| 2026-11-24 | Agents have a 150k-token ceiling and return partial work at about 120k | They overshoot otherwise |
