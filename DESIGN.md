# UniCircle design record ("the circle is the medium")

Entry mode: **Redesign** of the live app (no Figma file: `dropped: Figma (none given)`).
Written during Phase 0 of the orbit redesign; builders read this, they do not re-decide it.

## The one idea
A circle of people. **People are dots, relations are lines.** Every interaction is a dot
reaching a dot: hover draws a line, click sends a pulse along it, a new message rings a node.
Nothing decorative moves unless it explains a connection.

## Conversion goals (one per surface)
| Surface | The one action |
|---|---|
| Guest landing + topic pages | Join the waitlist (`?ref=<page>` kept per page) |
| Feed | Post, or say hello to someone |
| Network / Map | Open a conversation with a member |
| Mentor & Tutor | Request a mentor or a tutor |
| Events / Case Hub / Jobs | Take part (RSVP, open a case, apply) |

## Tokens (unchanged unless noted)
Paper `#faf9f6` · ink `#2b2a26` · panel `#3a3934` · muted `#6a675e` (**changed**, was `#8b887e`
at 3.4:1; now AA) · fonts Instrument Serif (display) + Manrope (UI) · radii 16/24/28/pill.
Swarm hues (oklch): 235 feed · 275 network · 25 map · 45 mentor/tutor · 305 events ·
145 case hub · 185 jobs · 260 profile · 25 messages. Swarm colours are never text.
Motion tokens in `css/uc-orbit.css`: `--uc-ease-out`, `--uc-ease-in-out`, `--uc-d-fast/base/slow`
(120/200/280 ms).

## Shell
Content left, **orbit rail right** (264 px; 224 px below 1100 px). Rail = brand, 8 routes,
Messages, chat dock, sign out. A dimmed constellation runs behind it; each menu dot is an
anchor of that canvas (`js/app.js` `mountRailFx`). ≤ 860 px the rail is a bottom tab bar
(no canvas; also the shell for the Android TWA). Chat panel docks to the rail's left edge.

## Motion rules
≤ 300 ms · custom easing · `transform`/`opacity` only (colour hovers ≤ 200 ms) ·
canvas pauses off-screen and when the tab is hidden · one global `prefers-reduced-motion`
block (animations end instantly, canvas draws static frames only) ·
hover line ≤ 220 ms, click pulse 280 ms, unread ring 900 ms once (a state signal, not a UI transition).

## Components cookbook (opt-in classes, `css/uc-orbit.css`)
`.uc-connect` line reaches out of a card on hover · `.uc-nudge` glyph nudges toward the click ·
`.uc-node` unread dot that rings once · `.uc-empty-orbit` empty state (node + line toward the
action) · `.uc-band` slim constellation header strip · `.uc-stagger` entrance, 40 ms steps.
Engine: `UCConstellation.mount(canvas, opts)` in `js/uc-constellation.js` (several instances OK;
`destroy()` removes every listener).

## Chat
1:1 only. PocketBase realtime over SSE (`/api/realtime`), 6 s polling as fallback. Unread =
recipient's `read=false`; opening a thread sets `read` on incoming messages. Panel + dock in
`js/uc-chat.js`. Planned backend hardening: recipient may change only `read`
(see `backend/init_schema.py` once updated; verify with `backend/verify_chat.py`).

## Verified so far (Phase 0 gate, feed page, mock API)
`tools/verify.js` green at 1432 and 390 px · 0 console errors · `tools/qa-crawler.mjs`: 0 broken
links · realtime message → badge, dock, toast, tab title without reload · thread open marks read.
Probe fixes (project copy `tools/verify.js`): colours converted via canvas (oklch was misread),
1 px sr-only text not "clipped", elements inside a scrolling bar are "contained".
