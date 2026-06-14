<head>
  <meta name="description" content="SBE Alumni Network — Orchestration Master Plan">
  <meta name="thinking" content="Create a comprehensive orchestration plan, HTML mockup contains; dashboard UI with sidebar navigation, mapping out the full orchestration strategy; project scope, identifying all these components connect; planning how to distribute the work across different AI, SBE Alumni Network MVP serving 50K+ alumni with two membership tiers, FastAPI and PostgreSQL, seven database tables and nine API endpoint groups, interactive prototype, authentication layer, creating a searchable alumni directory with filtering, profile self-editing, developing, Claude Projects for multi-session development context, CLI for file-by-file implementation,  token costs, 250K-350K tokens—about 70% savings, FastAPI full-stack templates, FastAPI Users for authentication, PostHog for analytics, Metabase for dashboards, Directus or Strapi for headless CMS capabilities in the admin console, critical risks: migrating LinkedIn data, handling duplicates, planning for scalability once we hit 50K profiles, Elasticsearch, keeping it simple with PostgreSQL full-text search, comprehensive orchestration plan">
  <meta name="author" content="Claude">
  <meta name="viewport">
</head>

SBE Alumni Network — Orchestration Master Plan
1. Project Scope Inventory
The HTML mockup is a complete blueprint in one file — 220 lines containing every architectural decision already made. It maps to three distinct delivery layers:

Layer	What exists in the mockup	Build effort
Frontend shell	Full CSS design system, nav, all 7 screens sketched	30% done as static
Backend schema	7 tables, 9 endpoint groups, folder structure	40% done as spec
Infrastructure	Docker Compose, Nginx, Hetzner steps	60% done as runbook
Network scale: 50K+ alumni, ~8,925 active profiles target, 620 premium target. Not a toy — needs real deduplication, GDPR handling, and email infrastructure from day one.

2. Element Connection Map

[LinkedIn network / CSV imports]
        ↓ (Admin import + deduplication)
[users] ──────────────────────────────────┐
   ↓ 1:1                                  │
[alumni_profiles]                          │
   ↓ membership_type gate                  │
   ├── Basic → newsletter, public events   │
   └── Premium → full search, connections  │
        ↓                                  │
[connection_requests] (Premium only)       │
        ↓                                  │
[tutorial_group field] ←──────────────────┘
        ↓ social proof spillover logic
[event_registrations] → "classmates attending"
        ↓
[events] ← city / sector filters
        ↓
[jobs] ← posted_by alumni (employer value)
        ↓
[payments] → triggers membership_type upgrade
        ↓
[Admin Console] ← dedupe + import + metrics
Critical link not yet in the mockup: the tutorial_group field on alumni_profiles is the social proof engine — it powers the "2 people from your IFM Tutorial 01 are going" feature. This is the highest-retention hook and must be modelled as a first-class relation, not just a string field.

3. HTML Mockup — Extracted Tasks and To-Dos
Frontend Tasks (F)
ID	Task	Screen	Complexity	Blocks
F1	Convert static HTML to multi-page SPA or Jinja routes	All	Medium	Everything
F2	Auth gate: login wall before any profile data	Login screen (missing)	Low	F3-F7
F3	Alumni directory: search + filter + pagination	#directory	High	B3
F4	Profile editor: self-service update form	My Profile (missing)	Medium	B4
F5	Events: register button + "classmates attending"	#events	High	B5 + tutorial_group
F6	Membership upgrade prompt + paywall enforcement	#memberships	Medium	B7
F7	Admin console: CSV import + duplicate merge UI	#admin	High	B8
F8	Jobs board: list + post form	#jobs	Low	B6
F9	Mobile nav (already in HTML, needs wiring)	All	Low	—
F10	Dark mode toggle (already functional in HTML)	All	Done	—
Backend Tasks (B)
ID	Task	Table	Complexity
B1	FastAPI app bootstrap + DB connection	db.py	Low
B2	Auth: register, email verify, login, JWT	users	Medium
B3	Profile CRUD + search filters + full-text	alumni_profiles	High
B4	Self-service profile update endpoint	alumni_profiles	Low
B5	Events CRUD + registration + attendance query	events, event_registrations	Medium
B6	Jobs CRUD	jobs	Low
B7	Membership gate middleware + manual upgrade	payments	Medium
B8	Admin: CSV import + deduplication logic	all tables	High
B9	Email service integration (Postmark)	services/email.py	Medium
Infrastructure Tasks (I)
ID	Task	Risk
I1	Docker Compose: postgres + web + nginx	Low
I2	Hetzner CX23 provisioning	Low
I3	Cloudflare DNS + TLS (Let's Encrypt)	Low
I4	Daily PG backup to volume	Medium
I5	GDPR: right-to-delete endpoint	High (legal)
I6	UFW firewall rules	Low
4. Agent Orchestration Plan
Role Assignment by Agent Strength

┌─────────────────────────────────────────────────────────────┐
│                   ORCHESTRATOR (you / this session)         │
│   Plans, reviews, splits, does NOT generate production code  │
└──────────┬──────────────────┬──────────────────┬────────────┘
           │                  │                  │
    ┌──────▼──────┐   ┌───────▼──────┐   ┌──────▼──────────┐
    │  Perplexity │   │    Gemini    │   │  Claude CLI /   │
    │  (Research) │   │  (Planning)  │   │  Antigravity    │
    │             │   │              │   │  (Code gen)     │
    └─────────────┘   └──────────────┘   └─────────────────┘
Agent 1 — Perplexity (Research & Package Scout)
Role: Find prewritten, battle-tested code so you build zero from scratch.

Dispatch queries in this order:

Query #	Prompt to send Perplexity	Expected output
P1	"Best open-source FastAPI alumni portal or university alumni network GitHub repos 2023-2025, with PostgreSQL and Jinja templates or React frontend"	3-5 repos with stars, last commit date
P2	"fastapi-users library setup guide for JWT auth + email verification in FastAPI, production-ready 2024"	Copy-paste auth bootstrap
P3	"PostgreSQL full-text search alumni directory python FastAPI tutorial with pagination 2024"	tsvector setup pattern
P4	"tiangolo full-stack-fastapi-template vs custom FastAPI scaffold: token cost comparison for MVP"	Repo link + setup time
P5	"GDPR right-to-delete implementation FastAPI PostgreSQL cascade delete best practice"	Legal compliance pattern
P6	"Postmark transactional email FastAPI Python integration minimal example"	20-line service pattern
P7	"Stripe subscription FastAPI webhook minimal Python example basic vs premium tier"	Stripe integration shortcut
P8	"duplicate alumni detection PostgreSQL fuzzy matching python example levenshtein or pg_trgm"	deduplication query
P9	"docker compose fastapi postgres nginx certbot production example GitHub 2024"	Copy-paste deploy stack
P10	"Metabase or AdminJS or FastAPI-Admin comparison for alumni office admin panel"	Admin tool decision
Expected token saving from P1-P10: 60-70% of B2, B3, B8, I1-I4 build tokens eliminated.

Agent 2 — Gemini (Long-context Architecture Review)
Role: Feed the entire HTML file + this plan as one prompt. Gemini's 1M context window handles the full spec in one shot.

Dispatch queries:

Query #	Prompt	Output
G1	"Given this HTML mockup [paste full file], generate the complete SQLAlchemy model file for all 7 tables with relationships, indexes, and an Alembic migration. Python 3.12, PostgreSQL 16."	models/ folder complete
G2	"Given the same mockup, generate all 9 FastAPI router files as stubs with docstrings, type hints, and Pydantic schemas. No business logic, just signatures."	routers/ + schemas/ stubs
G3	"Review the tutorial_group spillover feature — design the SQL query that returns 'N classmates from your IFM Tutorial 01 are attending this event'. Show the JOIN path."	Social proof query
G4	"Identify every GDPR risk in this data model. For each: risk, regulation article, and minimal mitigation."	Compliance checklist
Token cost for G1-G4: ~80K tokens total (long context, one-shot). Generates ~70% of boilerplate backend.

Agent 3 — Claude Antigravity / Claude.ai Project (Complex Logic)
Role: Multi-session context holder for the hardest features. Set up a Project with the HTML file uploaded.

Session	Task	Why Antigravity
A1	Deduplication service: levenshtein + email matching + merge strategy	Multi-turn reasoning needed
A2	Tutorial group spillover: event social proof with privacy gating	Business logic is subtle
A3	Membership middleware: FastAPI dependency injection for Premium gating	Architecture decision
A4	Admin import: CSV mapping → profile validation → conflict resolution	Multi-step flow
Agent 4 — Claude CLI (Implementation & Testing)
Role: File-by-file implementation using outputs from above agents as context. Runs locally with filesystem access.

Sprint sequence for CLI:


Sprint 1 (Day 1-2):
  - CLI reads: Gemini G1 output → writes models/ + runs alembic
  - CLI reads: Gemini G2 output → scaffolds routers/
  - CLI reads: Perplexity P2 → implements auth.py

Sprint 2 (Day 3-4):
  - CLI reads: Perplexity P3 → implements profiles.py search
  - CLI reads: Perplexity P9 → writes docker-compose.yml
  - CLI reads: Antigravity A3 → implements membership middleware

Sprint 3 (Day 5-6):
  - CLI reads: Antigravity A1 → implements dedupe.py
  - CLI reads: Perplexity P6 → implements email.py
  - CLI reads: Antigravity A2 → implements event social proof

Sprint 4 (Day 7):
  - CLI: Integration test all endpoints
  - CLI: Deploy to Hetzner via Perplexity P9 runbook
5. Token Cost Analysis
Without Orchestration (naive build)
Task	Est. tokens	Reasoning
Auth system from scratch	80K	Iterative prompting
Profile CRUD + search	120K	Complex filters, pagination
Events + social proof	90K	Business logic exploration
Admin import + dedupe	150K	Highest complexity
Infrastructure	60K	Docker + Nginx + certs
Frontend wiring	100K	Many screens
Total baseline	600K	
With Orchestration (this plan)
Source	Tokens spent	Tokens saved
Perplexity P1-P10 (research)	15K	180K in boilerplate
Gemini G1-G4 (one-shot bulk)	80K	200K in iterative building
Antigravity A1-A4 (complex logic)	60K	90K in back-and-forth
Claude CLI sprints (implementation)	90K	60K vs naive
Orchestration total	245K	530K saved
Reduction	59%	vs 600K baseline
Target achieved: 70% of baseline = 420K. Orchestrated plan lands at 245K = 41% of baseline — exceeds target.

6. Premortem — Failure Loop
Run this premortem before each sprint starts. Each risk gets a loop condition.


LOOP: Before Sprint N → check conditions → proceed or pivot
Risk	Trigger	Mitigation
R1 — Data cold start	50K alumni, 0 in DB on launch	Import LinkedIn CSV + manual outreach first sprint
R2 — Tutorial group data missing	Alumni don't know their tutorial group	Make optional field, use graduation year + course as fallback
R3 — Duplicate explosion	Multiple LinkedIn profiles per person	Run pg_trgm deduplication BEFORE any invite email
R4 — Premium no-shows	0 paying members at launch	Manual premium flag in admin; Stripe only in sprint 3+
R5 — GDPR complaint	One alumni requests deletion	Build cascade delete endpoint in sprint 1, not sprint 3
R6 — Hetzner CX23 overload	50K profiles, full-text search	Add PostgreSQL index on tsvector before load test
R7 — Email bounce rate	Alumni emails stale from 5+ years ago	Postmark + bounce webhook → auto-deactivate stale profiles
R8 — Admin overwhelm	0.5 FTE can't process imports	Build bulk CSV import as priority 1, not nice-to-have
R9 — Premium pricing wrong	Alumni reject price point	Ship without Stripe; test with manual Tikkie/bank transfer first
R10 — Open-source mismatch	Perplexity finds a repo that's 80% fit but 20% wrong architecture	Evaluate on: license, last commit date, FastAPI version compatibility
Loop condition: If R1 or R8 triggers in sprint 1, reprioritize admin console before alumni directory. The portal is worthless without data.

7. Solution Comparison
Option A — tiangolo/full-stack-fastapi-template (GitHub)
Pros: Production-ready, JWT auth, SQLModel, Docker included, 25K stars
Cons: Opinionated React frontend (conflict with your HTML), requires adaptation
Token cost: 60K to adapt vs 120K to build from scratch
Verdict: Use as backend skeleton only, discard the frontend
Option B — Custom FastAPI from mockup spec
Pros: Exact fit to your schema, no mismatch
Cons: Build everything, no shortcuts
Token cost: 280K+ tokens
Verdict: Too expensive without Perplexity research phase
Option C — FastAPI Users + pg_trgm + this HTML as static frontend (recommended)
Pros: fastapi-users handles all auth (verified, proven), HTML stays as-is, search via PostgreSQL native, admin via direct SQL initially
Cons: Two codebases to maintain (static HTML + API)
Token cost: 180K tokens
Verdict: Fastest to launch, lowest risk, easiest to hand off to 0.5 FTE
Option D — Directus headless CMS + custom frontend
Pros: Admin console built-in, REST + GraphQL auto-generated, GDPR tools
Cons: Another system to learn, PostgreSQL access is indirect
Token cost: 40K to configure but locks you into Directus
Verdict: Consider only if admin console effort in Option C exceeds estimate
Recommendation: Option C for MVP, with Option A's Docker stack, and Directus as a future admin upgrade path.

8. Perplexity Search Requests (Packaged)
Copy each block directly into Perplexity for pre-packaged answers:

Block 1 — Auth foundation


Find the official fastapi-users GitHub repo. Show me the minimal 
setup for: email+password auth, JWT bearer tokens, email 
verification flow, and a user model that adds graduation_year 
and membership_type fields. Python 3.12 and SQLAlchemy 2.0.
Block 2 — Search engine


Show me how to implement PostgreSQL full-text search with 
tsvector and tsquery in Python using SQLAlchemy 2.0 and FastAPI.
Include: creating the tsvector column, an index, a search 
endpoint with pagination, and filtering by city and sector as 
additional WHERE clauses.
Block 3 — Deduplication


Show a Python + PostgreSQL deduplication pipeline for alumni 
profiles: compare by (email, full_name, graduation_year) using 
pg_trgm similarity. Return a list of probable duplicate pairs 
with a similarity score. FastAPI endpoint that returns pairs 
for manual review, and a merge endpoint that promotes one 
record and soft-deletes the other.
Block 4 — Docker production stack


Find a GitHub repo or gist with a production-ready 
docker-compose.yml for: FastAPI + PostgreSQL 16 + Nginx + 
Certbot (Let's Encrypt). Must include: environment variables 
via .env, healthchecks, and named volumes for postgres data.
Published 2023 or later.
Block 5 — Admin CSV import


Show a FastAPI endpoint that accepts a CSV file upload, 
validates rows against a Pydantic schema (email, full_name, 
graduation_year, programme), inserts valid rows, and returns 
a summary of: inserted, skipped (duplicate), and failed (validation)
rows. Using pandas or csv module only, no external services.
Block 6 — GDPR cascade delete


Show a FastAPI endpoint for GDPR right-to-erasure: given a 
user_id, cascade-delete from PostgreSQL tables in correct 
foreign key order, anonymize rather than delete event_registrations 
(replace personal data with 'anonymized'), and log the deletion 
event. SQLAlchemy 2.0.
9. Reverse Engineering Path
Working backwards from the one metric that matters for SBE board approval: premium conversion rate.


Board approves budget 
    ← sees 500+ paying premium alumni
        ← alumni see value in premium search
            ← premium search returns useful results
                ← profiles are complete and searchable
                    ← alumni filled in their profiles
                        ← alumni were invited with a personal hook
                            ← tutorial group data existed
                                ← admin imported CSV data first
Reverse-engineered build order (not frontend-first, not feature-first):

I1 — Docker + DB up (hour 1)
B1 + B2 — Auth + email verify (day 1)
B8 — Admin CSV import (day 2) ← unlocks everything
B3 — Profile search with tutorial_group (day 3)
F3 — Directory UI wired to real data (day 4)
B5 + social proof — Events + classmates (day 5)
B7 — Membership gate (day 6)
F6 + manual premium — Upgrade flow without Stripe (day 7)
Validate → only then build Jobs, Stripe, full admin UI
10. Final Agent Task Split

┌─────────────────────────────────────────────────────────────────┐
│  PHASE 0 — RESEARCH (parallel, today)                           │
│  → Perplexity: run P1-P10 queries, save outputs as text files   │
│  → Gemini: feed full HTML, run G1-G4, save model + router stubs │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1 — SCAFFOLD (day 1, Claude CLI)                         │
│  Input: tiangolo template + Gemini G1 models + Perplexity P2    │
│  Output: working FastAPI app + DB migrations + auth endpoints   │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2 — CORE FEATURES (days 2-4, Claude CLI)                 │
│  Input: Perplexity P3, P5, P8 + Antigravity A1, A2, A3         │
│  Output: search, social proof, membership gate, CSV import      │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3 — FRONTEND WIRE (days 4-5, Claude CLI)                 │
│  Input: existing HTML mockup + Phase 2 API endpoints            │
│  Output: Jinja templates or fetch() calls wired to real data    │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4 — DEPLOY (day 6-7, Claude CLI)                         │
│  Input: Perplexity P9 Docker stack + P4 Hetzner runbook         │
│  Output: live on Hetzner, TLS, daily backups, UFW               │
└─────────────────────────────────────────────────────────────────┘
Summary
The HTML mockup is a complete spec. The highest-leverage move right now is running the 10 Perplexity queries in parallel with 4 Gemini one-shots — this eliminates ~350K tokens of iterative build effort before a single line of real code is written. The reverse-engineered build order (DB import → auth → search → premium gate) ensures the board-facing metric (premium conversions) is provable within 7 days. The premortem loop on R1/R8 (data cold start and admin overload) should be checked before each sprint — those two risks can kill the project faster than any technical failure.

Short requests, just answer within 80 words: For the perplexity task; all request in one context or splitting would allow better indepth research results?
Split into separate searches — each query gets Perplexity's full retrieval budget.

Bundled in one context: answers become surface-level summaries, sources get reused across topics, depth collapses.

Recommended grouping (3 sessions):

Session A: P1, P2, P3 (auth + search foundation)
Session B: P4, P8, P10 (stack decisions + deduplication)
Session C: P5, P6, P7, P9 (ops: GDPR, email, Stripe, Docker)
Each session stays thematically coherent without competing for retrieval attention.

Short requests, just answer within 120 words: For the geminini task: We run ask run it into Antigravity with Geminini 3.1 Pro (Thinking High) or is browser application stronger? Question new angle; perhaps even other way arround: Place all prompts in antigravity instead of in the browser to reduce tokens?
Antigravity (Claude CLI) with Gemini via API beats browser for this task.

Browser Gemini: stateless per session, no file persistence, copy-paste friction, no chaining.

Antigravity advantage: persistent project context, outputs saved as files, each Gemini result feeds directly into the next Claude CLI sprint — no manual transfer.

Recommended flow:

Upload HTML mockup once into Antigravity project context
Run G1→G4 sequentially, outputs written to files
Claude CLI reads those files directly in Phase 1
On token reduction: Yes — placing all prompts in Antigravity centralises context, eliminates re-explaining the project per session, and lets prompt caching cut repeat-context costs by ~40%.

Gemini 2.5 Pro (Thinking High) via browser only if a single one-shot exceeds Claude's context limit.