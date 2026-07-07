# UniCircle — Fable 5 Orchestration Plan (premium alumni-network build)

**Purpose.** This is a self-contained plan for **Fable 5** (as planner/referee/teacher in
the SFC coding harness) to build the premium alumni-network features on top of the wired
redesign. The design is live, accounts are wired to the Hetzner PocketBase backend, and
login (magic-link primary + password + LinkedIn fallbacks) is hardened. What remains is the
**feature layer** that turns UniCircle into a revenue product. Everything below is scoped so
each worker agent stays **< 180k tokens**, hands off via **artifacts not chat**, and passes a
**deterministic gate before any LLM review**.

Source-of-truth for the brief: the alumni-office minutes (Carl = revenue/premium backbone,
Leann = customer-insights/idea portal, plus student mentoring + guest-speaker matching).
Keep UniCircle **vendor-neutral** — an alumni office (e.g. SBE) is a prospective *client*,
not the product's identity.

---

## 0. The harness (how Fable runs this)

Lifecycle per feature: **think → plan → build → gate → review → ship → reflect**, with the
SFC ledger so no decision is re-litigated:

```bash
# recall before deciding; log after settling; distil in reflect
python scripts/sfc_ledger.py recall decision --slug unicircle --query <keyword>
python scripts/sfc_ledger.py log decision --slug unicircle --text "..." --why "..." --scope repo
python scripts/sfc_ledger.py log learning --slug unicircle --text "..." --tags <a,b>
```

**Model roster — native genius → routed model (each < 180k ctx):**

| Sub-agent | Native genius | Model | MCP |
|---|---|---|---|
| Structure & Orchestration Architect | decomposition, DAG, merge/gate order | **Gemini** | `ask_gemini` |
| Schema Engineer | PB v0.39 `fields` specs + API rules | **Qwen** | `ask_qwen` |
| SPA/JS Engineer | fallbacks{} UI slice, contract selectors | **Kimi** | `ask_kimicode` |
| Refactor / Cross-check | transforms, dedup, second opinion | **DeepSeek** | `ask_deepseek` |
| Skeptic / Security + hard slice | premium-gating rules, payments, executed attacks | **Opus xhigh / Fable** | — |

**Rule:** Gemini structures & orchestrates; Kimi/Qwen/DeepSeek write the code; **Opus/Fable
own the 5–10% that is genuinely hard** (premium-gating, payments, adversarial review).

---

## A. Dependency DAG & build order (from the Structure Architect)

```
users (existing, authed-only)
  ├─► chapters ─► events
  ├─► mentorships
  ├─► speaker_requests
  ├─► ideas
  ├─► ll_sessions
  └─► membership ─► [Premium-Gating Logic] ─► directory-search (deep)
```

- **Phase 1 — core collections (parallel):** `chapters`, `mentorships`, `speaker_requests`,
  `ideas`, `ll_sessions`, `membership`. Each: Qwen schema + a `verify.py`-style smoke test.
- **Phase 2 — dependent collection:** `events` (needs `chapters`).
- **Barrier:** `membership` must be green & stable **before** premium-gating logic starts.
- **Phase 3 — UI slices (parallel per feature, Kimi):** mentorship, ideas, events/chapters,
  ll_sessions, membership/premium page.
- **Phase 4 — hard slice (Opus/Fable):** premium-gating rules + directory deep-search gate;
  any payment integration. **Never a blind cheap attempt.**

Barriers exist only where cross-feature state is needed: (1) `chapters` before `events`;
(2) `membership` before gating; (3) all schemas green before the adversarial security pass.
Everything else pipelines (no barrier) — an item may be in UI while another is still in schema.

---

## B. Per-feature agent assignment

| # | Feature (collection) | Schema | UI slice → page | Gate (deterministic) | Reviewer |
|---|---|---|---|---|---|
| 1 | `mentorships` + `speaker_requests` | Qwen | Kimi → new `mentorship` route | smoke: student requests mentor, alum offers, list filters by status (N>0) | DeepSeek |
| 2 | `membership` | Qwen | Kimi → `jobs` (Premium) page | smoke: create tier, read own; **rule: non-premium cannot read premium-only fields** | **Opus xhigh** |
| 3 | `ideas` | Qwen | Kimi → `pbl-hub` | smoke: post idea, upvote, list by votes desc (N>0) | DeepSeek |
| 4 | `chapters` + `events` | Qwen | Kimi → `events` | smoke: create chapter, event under it, RSVP increments (N>0) | DeepSeek |
| 5 | directory search | — (reads `users`) | Kimi → `network` | smoke: filter by year/discipline/city returns expected subset; anon blocked | **Opus xhigh** |
| 6 | `ll_sessions` | Qwen | Kimi → `events` | smoke: create session, list upcoming (N>0) | DeepSeek |

Every gate result is a **command + effect-evidence pair** (e.g. "collected N>0", "403 for anon"),
never a bare exit-0. Log what was dropped if any coverage is capped.

---

## C. Collection specs (PocketBase v0.39 `fields` format)

Follow the existing helpers in `backend/init_schema.py` (`text`, `urlf`, `boolf`, `number`,
`relation`, `created`, `updated`). `USERS_ID = "_pb_users_auth_"`. Reuse, don't reinvent.

**1. mentorships** — `relation("mentor", USERS_ID)`, `relation("mentee", USERS_ID)`,
`text("topic", maxlen=160)`, `text("status", maxlen=20)` (requested|active|closed),
`created()`, `updated()`. Rules: `listRule/viewRule = @request.auth.id != ""`;
`createRule = @request.auth.id != ""`; `updateRule = mentor = @request.auth.id || mentee = @request.auth.id`.

**speaker_requests** — `relation("requester", USERS_ID)`, `text("topic",160)`,
`text("format",20)` (lecture|guest-talk), `text("status",20)`, `created()`.
Rules: authed create/read; update by requester.

**2. membership** — `relation("user", USERS_ID)`, `text("tier",12)` (basic|premium),
`number("monthly_fee")`, `text("status",20)` (active|lapsed|trialing), `text("started",30)`,
`created()`, `updated()`. Rules: `viewRule = user = @request.auth.id` (a member sees only
their own membership); create/update via server logic only (see §D — do **not** let clients
self-upgrade tier). Wire the existing `users.supporter` boolean as the fast premium flag.

**3. ideas** — `relation("author", USERS_ID)`, `text("title",140)`, `text("body",4000)`,
`text("category",40)`, `number("votes")`, `created()`. Rules: public-authed read
(`@request.auth.id != ""`), create authed, update by author (or a votes-only patch rule).

**4. chapters** — `text("name",80)`, `text("city",80)`, `created()`. Public-authed read.
**events** — `relation("chapter", chapters_id, required=False)`, `text("title",160)`,
`text("date",30)`, `number("rsvp_count")`, `created()`. Read authed; RSVP increments via a
guarded update (or an `rsvps` join collection if per-user RSVP tracking is wanted — decide
in plan, log the decision).

**6. ll_sessions** — `text("title",160)`, `text("faculty",120)`, `text("date",30)`,
`number("reward_comp")`, `created()`. Read authed; create admin-only.

---

## D. The hard slice — escalate to Opus / Fable / human (never a blind cheap attempt)

These fire the runtime concede triggers; route them up:

1. **Premium-gating rules.** "Directory deep-search / full profile access requires
   `tier=premium`" is a cross-collection API-rule invariant (membership ↔ users ↔ query).
   Getting the PocketBase rule expression right so a non-premium user **cannot** craft a
   request that leaks premium-only fields is exactly the multi-file reasoning we concede.
   Opus writes it; the Skeptic runs **executed** bypass attacks (filter injection, field
   selection, relation expand to read gated data).
2. **Payments.** Any monthly-fee collection/charge (Carl's revenue backbone) touches money —
   never auto-approve. Human owns the provider/keys; Fable reviews the flow. This pass ships
   the `membership` **record model + gating**, not a live charge, unless the human opts in.
3. **Directory search correctness under the authed-only rule.** The search must return the
   right subset **and** stay within the `users` view rule; verify with an adversarial "can an
   anon or basic user see more than intended?" attack, not just a happy-path test.
4. **RSVP / vote idempotency.** Increment-on-click without a per-user guard double-counts;
   decide join-collection vs guarded-patch and prove idempotency (content-anchored, not
   position-anchored) before shipping.

**Non-vacuous gates.** Each collection ships with a `backend/verify_<feature>.py` modeled on
the existing `backend/verify.py` (signup→create→read→rule-check, self-cleaning) that asserts
**collected N>0** and the **negative** rule case (anon/basic gets 403/empty). A green run with
zero assertions is a FAIL, not a pass.

---

## E. UI seams (where each slice plugs in)

The SPA renders inline `fallbacks{}` templates in `js/app.js`; contract selectors are hooked
by `js/unicircle.js`. Preserve them:

- New **`mentorship`** route: add `fallbacks.mentorship` + a `data-page="mentorship"` nav item
  + a `case 'mentorship'` in `initializePageInteractivity`. Read/write via the existing
  `window.UC.API` base and the `api()` REST pattern.
- **`jobs`** page hosts the **Premium** upsell + membership state.
- **`pbl-hub`** hosts the **ideas** portal (Leann's willingness-to-pay capture).
- **`events`** hosts chapters/events + ll_sessions.
- **`network`** gains the directory search filters (year/discipline/city/tutorial-cohort),
  reading `users` with the authed token.

Reuse `window.UC` (`openAuth`, `openChat`, `openProfile`, `API`) and the `redesign.css` brand
layer (`.uc-card`, `.uc-panel-dark`, `.uc-eyebrow`, `.uc-btn-dark`, `.uc-people-grid`, etc.).

---

## F. Definition of done (the rubric Fable approves against)

1. Every collection has a **non-vacuous** `verify_<feature>.py` that ran and asserted N>0 **and**
   the negative rule case.
2. No architectural choice silently re-litigated — checked against `recall decision`,
   contradictions are explicit `supersede`.
3. The premium-gating + payments slice was **routed up**, not faked at a cheap tier.
4. Each phase consumed the prior phase's **artifact** (schema → gate → UI → review), not chat.
5. `Reflect` wrote ≥1 `learnings.jsonl` lesson; the **fill-gap shrank** vs this session.

---

## G. Human-owned prerequisites (surface, don't guess)
- Payment provider + keys (if a live charge is in scope for `membership`).
- SMTP already required for auth email (magic-link/reset/verification) — same instance.
- Product decisions: premium price point, what deep-search is gated, RSVP model
  (join-collection vs counter). Bring these to Carl/Leann, don't assume.
