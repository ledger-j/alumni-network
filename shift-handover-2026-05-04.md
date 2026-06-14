# Shift Handover — SBE Alumni Network MVP

**Outgoing:** Claude Sonnet 4.6 | Session context: ~180K tokens used  
**Incoming:** Fresh context window  
**Date:** 2026-05-04 | Environment: Antigravity CLI  

---

## Current Status

| Item | State |
|---|---|
| HTML mockup | Complete, read, analyzed — `alumni-network-mvp.html` |
| Orchestration plan | Delivered — 10-section master plan in conversation |
| Code written | Zero — orchestration only, as instructed |
| Agent split | Designed: Perplexity (3 sessions), Gemini/Antigravity, Claude CLI |
| Token estimate | 245K orchestrated vs 600K naive — 59% reduction |
| Next action pending | Perplexity research sessions P1-P10 not yet executed |

---

## Preparation for Incoming Session

**Load this before starting:**

1. Read `alumni-network-mvp.html` — it is the single source of truth
2. The orchestration plan lives in the outgoing conversation — extract the 10 Perplexity queries and 4 Gemini prompts before closing
3. No files have been created yet — the project folder contains only the HTML mockup
4. Antigravity project context: upload the HTML file once, do not re-paste per prompt

---

## 4 Crucial Questions

1. **Has any Perplexity research been executed?** If not, Phase 0 is still blocked — nothing downstream can start without the package research outputs.
2. **Is the tutorial_group field confirmed as a real data field in Leann's current database?** The social proof feature (classmates attending) depends entirely on this data existing — it was assumed, not verified.
3. **Who owns the Hetzner account and domain DNS?** Deployment in Phase 4 requires credentials that have not been discussed — establish this before Sprint 3.
4. **Is GDPR compliance a blocker for launch or a post-launch requirement?** The premortem flagged it as high risk (R5) — the answer changes the Sprint 1 scope significantly.

---

## 4 Thoughts Worth Carrying Forward

1. **The admin CSV import is the true critical path** — without data in the database, every other feature demonstrates on empty screens. It must be Sprint 1, not Sprint 3.
2. **Stripe should not appear until premium conversion is validated manually** — ship with a bank transfer or Tikkie link first; adding Stripe before proving willingness to pay is premature complexity.
3. **The HTML mockup is production-quality CSS** — do not rebuild the frontend; wire it with Jinja templates and `fetch()` calls. Rewriting it loses weeks.
4. **Gemini 2.5 Pro (Thinking High) via Antigravity** outperforms browser for chained tasks — confirmed in this session. Use it for the 4 one-shot bulk generation prompts (models, routers, GDPR review, social proof query).

---

## 4 Lessons Learned This Session

1. **Splitting Perplexity into 3 thematic sessions** (auth+search / stack decisions / ops) produces deeper results than one bundled query — retrieval budget stays focused per topic.
2. **Reverse-engineering from the board metric** (premium conversions) reordered the build sequence meaningfully — feature-first thinking would have built Jobs before Admin import, which is backwards.
3. **The token cost analysis exposed that 60% of build tokens come from 3 tasks** — auth, search, and deduplication — which are all solvable with pre-existing open-source packages. This is where Perplexity ROI is highest.
4. **Antigravity centralises context and enables prompt caching** — placing all prompts there instead of per-browser-session eliminates ~40% of repeat-context token spend.

---

## 4 Approach Checks — Bias Verification

| Check | Observation | Verdict |
|---|---|---|
| **Tool bias** | Plan defaults to FastAPI — is that the user's choice or mine? | Confirmed by mockup `#python` section — not imposed |
| **Complexity bias** | Did I over-engineer the agent split? | No — user explicitly requested multi-agent orchestration; plan matches stated success criteria |
| **Speed vs quality bias** | 7-day sprint assumes one senior developer with LLM assist — realistic? | Flagged as assumption; verify FTE availability before committing to timeline |
| **Open-source trust bias** | Plan recommends tiangolo template + fastapi-users without auditing them in this session | Perplexity P1/P2 must verify last commit date and FastAPI version compatibility before adoption |

---

## Responsibility Map

| Responsibility | Owner |
|---|---|
| Perplexity research (P1-P10) | User executes; outputs saved as text files |
| Gemini one-shot generation (G1-G4) | User dispatches via Antigravity with HTML uploaded |
| Complex logic sessions (A1-A4) | Antigravity Claude project, multi-turn |
| File-by-file implementation (sprints 1-4) | Claude CLI reads research outputs, writes code |
| Hetzner provisioning + DNS | User / infrastructure owner |
| GDPR legal review | External — not an AI responsibility |
| Alumni data sourcing and CSV prep | Leann / Alumni Office (0.5 FTE) |

---

## Agent Orchestration Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 0 — RESEARCH (parallel, execute first)                   │
│  → Perplexity Session A: P1, P2, P3 — auth + search            │
│  → Perplexity Session B: P4, P8, P10 — stack + dedupe          │
│  → Perplexity Session C: P5, P6, P7, P9 — GDPR + ops           │
│  → Gemini G1-G4 via Antigravity — models, routers, GDPR, query  │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1 — SCAFFOLD (Day 1-2, Claude CLI)                       │
│  Input: tiangolo template + Gemini G1 models + Perplexity P2    │
│  Output: working FastAPI app + DB migrations + auth endpoints   │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2 — CORE FEATURES (Days 2-4, Claude CLI)                 │
│  Input: Perplexity P3, P5, P8 + Antigravity A1, A2, A3         │
│  Output: search, social proof, membership gate, CSV import      │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3 — FRONTEND WIRE (Days 4-5, Claude CLI)                 │
│  Input: existing HTML mockup + Phase 2 API endpoints            │
│  Output: Jinja templates or fetch() calls wired to real data    │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4 — DEPLOY (Days 6-7, Claude CLI)                        │
│  Input: Perplexity P9 Docker stack + P4 Hetzner runbook         │
│  Output: live on Hetzner, TLS, daily backups, UFW               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Premortem — Top 5 Risks to Check at Sprint Start

| Risk | Trigger | Mitigation |
|---|---|---|
| R1 — Data cold start | 50K alumni, 0 in DB on launch | CSV import must be Sprint 1 priority |
| R5 — GDPR complaint | One alumni requests deletion | Cascade delete endpoint in Sprint 1, not Sprint 3 |
| R8 — Admin overwhelm | 0.5 FTE can't process imports | Bulk CSV import is priority 1, not nice-to-have |
| R2 — Tutorial group missing | Alumni don't know their group | Make optional; fallback to graduation year + course |
| R10 — Open-source mismatch | Repo is 80% fit, 20% wrong | Check: license, last commit, FastAPI version compatibility |

---

## Handover Checklist

- [ ] Outgoing session conversation exported or summarised
- [ ] `alumni-network-mvp.html` confirmed readable in project folder
- [ ] 10 Perplexity queries copied to a running document
- [ ] 4 Gemini prompts copied and ready
- [ ] Premortem risks R1-R10 reviewed against current project state
- [ ] GDPR and tutorial_group questions escalated before Sprint 1

---

## Incoming Session Instruction

Start with reading `alumni-network-mvp.html`, then ask the user which phase to begin.  
**Do not assume Phase 0 research is complete.**  
**Do not write any code until Perplexity and Gemini outputs are available as files.**
