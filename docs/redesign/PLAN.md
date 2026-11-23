# Orbit redesign: phase record (resume from here, not from the chat)

Branch `claude/uc-orbit-redesign` (from `origin/uc-next`). Plan approved 2026-11-23.
Fleet logged as `N = 7 builders + 1 contract owner (ceiling 40); dropped: 33 (no work item for them)`.

| Phase | What | State |
|---|---|---|
| 0 contract | `js/uc-constellation.js`, right orbit rail (`js/app.js`, `css/uc-orbit.css`), live chat (`js/uc-chat.js`), `DESIGN.md`, `tools/verify.js`, `tools/mock-pb.mjs` | done, gate green |
| hard slice | `backend/init_schema.py` (tutor fields, `mentorships`, hardened `messages`/`users` rules), `backend/verify_chat.py`, `verify_mentorships.py`, `vt_common.py` | done; 19 + 32 checks pass on a throwaway PocketBase (DeploymentHub) |
| 1 builders | app-a feed/network/map · app-b events/jobs · app-c mentor & tutor + profile + case hub · topic-a 7 pages + new `tutoring.html` · topic-b landing-v2/waitlist · pwa-android | done; returns in `findings-*.json` |
| 2 verify | gate in two browsers, DeepSeek rules review, Qwen client review, executed attacks, reduced motion, SW, focus | done; defects fixed (see DESIGN.md) |
| 3 android | PWA + `android/README.md` (TWA steps) + `docs/android-roadmap.md` | files written; TWA not built (needs JDK + Play account) |

## Not done / needs a human
- Production schema update (needs the admin token), KAS deploy, Play Console + signing key, `assetlinks.json` fingerprint.
- `tutoring.html` and the new files exist only on this branch until deployed: the crawler's one remaining flag (`unicircle.eu/tutoring.html` 404) resolves on deploy.
- sw.js: bump `VERSION` on every deploy that changes a precached file (now `uc-v4`).
- Enable PocketBase rate limiting (admin UI) before inviting users: nothing throttles message or request spam.

## Dropped (said out loud)
- `dropped: Figma (no file given)`.
- `dropped: Grok (key not smoke-tested)`; cheap-model page drafting (Sonnet builders were cheaper than the round trip). Gemini not used: nothing needed structure critique after the contract froze.
- `dropped: hub headless Playwright gate` (hub has no Chromium/JDK, and its `claude` is not signed in); the hub ran the zero-token PocketBase gates, the gates ran locally in two browsers.
- `dropped: hub headless Claude workers` (not signed in): the PWA/Android work ran as local background subagents.
- `dropped: native Kotlin app` (phase 2 by decision; roadmap written).
