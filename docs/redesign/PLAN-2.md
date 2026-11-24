# Round 2: logo, personal profiles, status points, collaboration, live map, groups, mentoring documents, target groups

Branch `claude/uc-profiles-points` (from `origin/claude/uc-orbit-redesign`, deployed commit 8e9813a + a5fed1d).
Orchestration: objection-based. Reviewers with distinct lenses attack this plan first; every objection gets a logged resolution; builders only start after. A second objection wave attacks the built result and must close each objection with executed evidence. Every agent: model sonnet unless noted, hard ceiling 150k tokens (prompts say: stop and return partial at ~120k).

## Think (scope, non-goals)
Goal (from the user's definition of success): new logo on the whole platform · profile fully customisable (own UI colour, picture, cover) · status points · collaboration requests · my location on the map · map synchronised with real alumni data · click the map to set up an event per day · in-depth profiles · group chats · mentoring with structure and document upload · target-group dossiers (A universities NL, B alumni types + student types) · 10 alumni offices to reach this week.
Non-goals this round: payments, native Android code, scraping private data about named individuals, any change to the live site without a drift check first.

## Existing facts that constrain the design (from the code map, 2026-11-24)
- `UC.api` sends JSON only (js/unicircle.js:19-29): file upload needs a FormData branch.
- `users.avatar` is the built-in file field, read-only in the UI; no cover; no accent field.
- Map has no geocoding: a 75-city table + free-text match (js/uc-map.js:22-59); real users loaded max 500, samples fill in under 25; click handler gives `{city, area, lat, lng}`.
- Events are sample-only (localStorage RSVP); no events collection exists. Chat is 1:1 only. Mentorships have no documents or structure fields.
- Prior decisions to honour: premium gate = `users.supporter` only; deep directory data in a split collection `profiles_deep`; RSVPs via a join collection with a unique index; directory is authed-only.
- Logo sources: `Unicircle_team/assets-transparent/logo_unicircle_v2_{32,64,128,256,512,trimmed}.png` (transparent "U"). Current repo logo is the old 2048 px / 774 KB PNG (also the favicon and the rail brand).

## Data model (new, all in backend/init_schema.py, idempotent)
| Collection / fields | Purpose | Key rule |
|---|---|---|
| `users` + `accent_hue` (number 0-360), `cover` (file, image, 5 MB), `lat`, `lng` (number, coarse ~0.05°), `map_visible` (bool), `points` (number, never client-writable), `contact_mode` (open / points / request / closed), `min_points`, `accepts` (text), `daily_cap` | personalisation, location, inbox protection | update rule forbids `points`, `supporter` |
| `points_ledger` user, delta, reason, ref, created | proof of work | clients cannot create; a PocketBase hook writes it and updates `users.points` |
| `collab_requests` from, to, kind, message, status, created | collaboration / internship / mentoring asks | create only if recipient `contact_mode` allows it and `@request.auth.points >= to.min_points`; recipient answers |
| `events` title, start, end, city, lat, lng, place, host, description, created + `rsvps` event, user (unique index) | map-click events per day | create authed; rsvps unique |
| `conversations` + `conversation_members` + `conversation_messages` | group chats, add participants | members-only list/view/create; owner adds members |
| `mentorship_docs` mentorship, uploader, file (10 MB), note + `mentorships` + `goals`, `stage`, `next_session` | structured mentoring, uploads | participants only |
| `profiles_deep` user, experience, education, skills, sectors, languages, offer, seek, links | in-depth profile (split collection) | owner writes; readable by authed members that meet `contact`/points rules |

## Points rules (hard slice, Fable only)
Points come only from server-verified events, never from client claims: tutoring or mentoring session closed by the mentor (+), a peer review of a draft or post confirmed by its author (+), feedback accepted by the recipient (+). Daily caps, no self-awards, no reciprocal farming (same pair counts once per week). Spending: approaching a person with `contact_mode = points` needs `min_points`.

## Work items and write sets (disjoint)
| Lane | Owner files |
|---|---|
| C0 contract (Fable): schema + hooks + verify scripts; `UC.upload`; `UCTheme` (accent engine); constellation `setPalette`; shared avatar helper | backend/*, js/unicircle.js, js/app.js, js/uc-constellation.js, css/uc-orbit.css |
| L logo | assets/*, manifest, sw.js list, head of every static page, js/site.js, components/landing.html, offline.html |
| P profile (identity, cover, accent, contact settings, points panel, deep profile) | components/profile.html, js/pages/profile.js, css/p-profile.css (new) |
| K collaboration requests + inbox | js/uc-collab.js, css/uc-collab.css (new) |
| M map + events | components/map.html, js/pages/map.js, js/uc-map.js, css/p-map.css, components/events.html, js/pages/events.js, css/p-events-jobs.css |
| G group chat | js/uc-chat.js, css/uc-chat.css (new) |
| D mentoring structure + documents | components/mentoring.html, js/pages/mentoring.js, css/p-mentoring-cases.css |
| T target-group map page (HTML) | docs/icp-dossier/** |

## Objection round (before any build)
Lenses: (1) privacy and GDPR (location, profiles, Gemini data, points records), (2) abuse and gaming (points farming, contact-rule bypass, group-chat spam, upload abuse), (3) feasibility and cost (does it fit PocketBase rules, 150k per agent, mobile). Output: `docs/redesign/objections.md`, each as `{id, lens, severity, claim, proposed fix}`; resolution column filled by the conductor: accepted / rejected + reason / escalated to the user.
