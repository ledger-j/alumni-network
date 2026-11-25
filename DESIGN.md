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
`js/uc-chat.js`. Backend rules (in `backend/init_schema.py`, verified by `backend/verify_chat.py`):
only the two participants see a thread, the recipient may change only `read`, nobody deletes.
The schema script must be run on the production PocketBase before the new chat/mentorship
features can store data; until then they degrade to message-only.

## Verified (final gate, 2026-11-23)
- `tools/verify.js` green on all 8 app routes at 1432 and 382/390 px (real Chromium), the guest landing and 11 static pages at 390 and 1440 (embedded pane), with the chat panel open; 0 unhandled rejections after rapid route changes; `tools/qa-crawler.mjs`: 0 broken same-origin links.
- Realtime: message -> badge, dock, toast, tab title without reload; opening a thread marks read; SSE de-duplicated; refresh race fixed after the Qwen review.
- Rules (real PocketBase 0.39.4, throwaway): 19 chat + 32 mentorship checks incl. executed attacks (forged sender, text tampering, stranger reads, self-grant `supporter` on update and on signup, `role=admin`, modifier keys).
- Reduced motion: canvases stop, static frames identical across reads, all transitions ~0 ms. Service worker registers, caches same-origin files only. Keyboard: content first, rail last, visible focus ring on every rail control.
- Known gate limits: contrast on text over photos/gradients is eye-checked; an 8 px scroll-width reading appears for ~200 ms during the route View Transition (and persists only in the throttled embedded pane); no skip-to-menu link yet (the app hides the global skip link).
- Probe fixes (project copy `tools/verify.js`): colours via canvas (oklch was misread), 1 px sr-only text not "clipped", scroll-contained items not page overflow.
- Defects found by the gate and fixed: muted text 3.4:1 (token), dark-panel headings ink-on-dark, small tap targets, landing footer overflow, Enter in dialog forms reloading the page, View Transition rejections, constellation dots clustered in a late-measured canvas, static redraws washing the canvas, dock focus ring invisible on the dark rail.
