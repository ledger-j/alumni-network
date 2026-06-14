# Session B – P4 · P8 · P10: Stack Decisions & Deduplication Research
> **Role:** Pre-fetched, battle-tested code & library analysis — zero custom build from scratch.  
> **Context:** Financial-cost expert, alumni-network threat model.  
> Generated: 2026-05-04

---

## 1. Scaffold Decision — `tiangolo/full-stack-fastapi-template` vs Custom FastAPI

### TL;DR
**Use the tiangolo template for MVP.** It eliminates ~80 % of boilerplate that an LLM would otherwise write (and hallucinate).  
Fewer generated tokens = lower LLM-assisted-coding cost + lower review surface.

### What the Template Ships Out-of-the-Box

| Layer | Included | Custom Scaffold (DIY) |
|---|---|---|
| Auth | JWT + OAuth2 password flow, email recovery | Manual |
| ORM / DB | SQLModel + Alembic migrations + PostgreSQL | Manual |
| Frontend | React + TypeScript + Vite + Tailwind + shadcn/ui | Manual |
| API Client | Auto-generated TypeScript client from OpenAPI | Manual |
| Docker | Docker Compose (dev + prod) + Traefik + HTTPS | Manual |
| CI/CD | GitHub Actions out of the box | Manual |
| Testing | pytest + Playwright E2E scaffolded | Manual |

> Source: https://fastapi.tiangolo.com/project-generation/  
> GitHub: https://github.com/fastapi/full-stack-fastapi-template (⭐ 34 k+)

### Token-Cost Framing for MVP

- **Template path:** Clone → strip unused modules → extend. LLM only writes **business logic**.  
  Estimated LLM-token spend: auth + CRUD + email = already done; you write ~20 % of lines.
- **Custom scaffold path:** Every file (settings, CORS, DB session, JWT middleware, Alembic env, Dockerfile…) must be generated or typed from scratch.  
  Empirical dev reports: ~200–300 % slower initial velocity vs FastAPI template.
- **Key risk with template:** Ships React SPA (Vite, not Next.js) — no SSR/SEO out of box.  
  Mitigation for alumni portals: alumni admin ≠ public-facing, so SSR is irrelevant.

### Caveats / When to Go Custom

- Template is SQLModel-only; if you need raw SQLAlchemy Core with async, slim the template or adopt `fastadmin` (SQLAlchemy-native).  
- React frontend is optional; strip it if you mount an admin panel (see Section 3) instead of a custom UI.

### Recommended Clone & Strip Pattern

```bash
git clone https://github.com/fastapi/full-stack-fastapi-template alumni-network
cd alumni-network
# Remove frontend if using Metabase / AdminJS for admin UI
rm -rf frontend
# Keep: backend/, .github/, docker-compose.yml, pyproject.toml
```

---

## 2. Duplicate Alumni Detection — PostgreSQL Fuzzy Matching

### Strategy Overview

Three complementary methods — combine all three for best coverage:

| Method | PostgreSQL Extension | Best for |
|---|---|---|
| Trigram similarity | `pg_trgm` (`similarity()`) | Name misspellings, phonetic variants |
| Levenshtein distance | `fuzzystrmatch` (`levenshtein()`) | Short fields, ID corrections |
| Soundex / Metaphone | `fuzzystrmatch` | Same-sounding names across languages |

### Step 1 — Enable Extensions

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
```

### Step 2 — Add GIN Index for Speed

```sql
-- For similarity() queries to use index (GIN is faster for static data)
CREATE INDEX CONCURRENTLY alumni_name_trgm_idx
ON alumni
USING gin (full_name gin_trgm_ops);
```

> Note: Without this index a self-join similarity scan on 10 k rows takes > 1 200 s.  
> With GIN index it drops to milliseconds.

### Step 3 — Candidate Pair Query (SQL)

```sql
-- Find candidate duplicate pairs with similarity > 0.75
SELECT
  a1.id        AS id_1,
  a1.full_name AS name_1,
  a1.email     AS email_1,
  a2.id        AS id_2,
  a2.full_name AS name_2,
  a2.email     AS email_2,
  similarity(a1.full_name, a2.full_name) AS name_sim,
  levenshtein(lower(a1.email), lower(a2.email)) AS email_lev
FROM alumni a1
JOIN alumni a2
  ON a1.id < a2.id
  AND a1.full_name % a2.full_name
WHERE similarity(a1.full_name, a2.full_name) > 0.75
ORDER BY name_sim DESC;
```

### Step 4 — Python + SQLAlchemy Deduplication Helper

```python
"""
alumni_dedup.py — battle-tested fuzzy duplicate detection via pg_trgm + fuzzystrmatch
Requires: sqlalchemy, psycopg2-binary
"""
from sqlalchemy import create_engine, text
from dataclasses import dataclass

DATABASE_URL = "postgresql+psycopg2://user:pass@localhost/alumni_db"
engine = create_engine(DATABASE_URL, echo=False)

SIMILARITY_THRESHOLD = 0.75
EMAIL_LEV_MAX = 3

@dataclass
class DuplicatePair:
    id_1: int; name_1: str; email_1: str
    id_2: int; name_2: str; email_2: str
    name_sim: float; email_lev: int

def find_duplicate_candidates() -> list[DuplicatePair]:
    sql = text("""
        SELECT
            a1.id, a1.full_name, a1.email,
            a2.id, a2.full_name, a2.email,
            similarity(a1.full_name, a2.full_name)         AS name_sim,
            levenshtein(lower(a1.email), lower(a2.email))  AS email_lev
        FROM alumni a1
        JOIN alumni a2
            ON a1.id < a2.id
            AND a1.full_name % a2.full_name
        WHERE
            similarity(a1.full_name, a2.full_name) > :threshold
            OR levenshtein(lower(a1.email), lower(a2.email)) <= :lev_max
        ORDER BY name_sim DESC
    """)
    with engine.connect() as conn:
        rows = conn.execute(
            sql,
            {"threshold": SIMILARITY_THRESHOLD, "lev_max": EMAIL_LEV_MAX}
        ).fetchall()
    return [
        DuplicatePair(
            id_1=r[0], name_1=r[1], email_1=r[2],
            id_2=r[3], name_2=r[4], email_2=r[5],
            name_sim=float(r[6]), email_lev=int(r[7])
        )
        for r in rows
    ]

if __name__ == "__main__":
    pairs = find_duplicate_candidates()
    print(f"Found {len(pairs)} candidate duplicate pairs")
    for p in pairs[:20]:
        print(f"  [{p.id_1}] {p.name_1} <{p.email_1}>")
        print(f"  [{p.id_2}] {p.name_2} <{p.email_2}>")
        print(f"  -> sim={p.name_sim:.2f}  lev={p.email_lev}")
        print()
```

### Threshold Tuning Guide

| `pg_trgm.similarity_threshold` | Behaviour |
|---|---|
| 0.9+ | Near-identical strings only |
| 0.75–0.89 | Catches most misspellings (recommended start) |
| 0.6–0.74 | High recall, expect more false positives |
| < 0.6 | Flood of candidates — use only with secondary email filter |

### Performance Notes

- **GIN > GiST** for static/batch duplicate-detection jobs (alumni data = largely static).  
- For >100 k rows: batch with `WHERE a1.id BETWEEN :lo AND :hi` chunks.  
- Python-side library alternative: `rapidfuzz` (`pip install rapidfuzz`) mirrors PostgreSQL trigram logic for pre-filtering before DB round-trips.

```python
# rapidfuzz pre-filter (optional, Python-side)
from rapidfuzz import fuzz, process

def python_prefilter(name: str, candidates: list[str], threshold=75) -> list[str]:
    results = process.extract(name, candidates, scorer=fuzz.WRatio, score_cutoff=threshold)
    return [r[0] for r in results]
```

---

## 3. Admin Panel — Metabase vs AdminJS vs FastAPI-Admin

### Decision Matrix

| Criterion | **Metabase** | **AdminJS** | **FastAPI-Admin** |
|---|---|---|---|
| Primary purpose | BI / analytics dashboards | CRUD admin panel | CRUD admin panel |
| Language stack | JVM (Java) + React | Node.js + React | Python + TortoiseORM |
| Setup effort | High (Docker + JVM) | Medium (npm + adapters) | Low (`pip install`) |
| Non-technical user friendly | Excellent — no-SQL UI | Requires dev setup | Requires dev setup |
| Python/FastAPI native | External service | Node.js only | Native |
| Alumni CRUD (records mgmt) | v57+ inline edit (Pro/Ent only) | Full CRUD OOB | Full CRUD OOB |
| ORM constraint | None (connects to any DB) | Mongoose/Sequelize/Prisma/TypeORM | **Tortoise ORM only** |
| Licensing | AGPL (self-host free) | Apache 2.0 | Apache 2.0 |
| Alumni office staff usability | 5/5 | 2/5 | 3/5 |
| Dev customizability | 3/5 | 5/5 (React) | 3/5 |

### Metabase

**Best for:** reporting, dashboards, non-technical alumni office staff who need charts + queries without writing SQL.

- v57 (Nov 2025) added **inline CRUD** for Postgres/MySQL — Pro/Enterprise only.  
- Self-host via Docker (free open-source version has no row-level security or CRUD).  
- Not a replacement for a data-entry admin panel — it is a BI layer on top of your DB.

```bash
docker run -d \
  -p 3000:3000 \
  -e "MB_DB_TYPE=postgres" \
  -e "MB_DB_DBNAME=metabase" \
  -e "MB_DB_PORT=5432" \
  -e "MB_DB_USER=metabase" \
  -e "MB_DB_PASS=secret" \
  -e "MB_DB_HOST=postgres" \
  --name metabase metabase/metabase
```

### AdminJS (Node.js)

**Best for:** teams already running Node.js, or who want maximum React customisation.

- Auto-discovers ORM models (TypeORM, Sequelize, Mongoose, Prisma, MikroORM adapters).  
- RBAC, custom actions, form validation out-of-box.  
- **Mismatch:** stack is Python/FastAPI → AdminJS introduces a second language runtime.

```bash
npm install adminjs @adminjs/express @adminjs/typeorm
```

### FastAPI-Admin (Python, but caveat)

**Best for:** teams already on TortoiseORM.

- **Hard constraint:** requires Tortoise ORM — **not compatible with SQLAlchemy** (which tiangolo template uses).  
- If you are on SQLAlchemy, choose instead:  
  - **SQLAdmin** (`pip install sqladmin`) — SQLAlchemy-native, async-ready  
  - **fastadmin** (`pip install fastadmin[fastapi,sqlalchemy]`) — multi-ORM, async  
  - **CRUDAdmin** (`uv add crudadmin`) — 85 % smaller than SQLAdmin, built on FastCRUD + HTMX

### Recommended Combination for Alumni Office MVP

```
tiangolo template (backend scaffold)
  ├── SQLAdmin or CRUDAdmin  ← staff CRUD panel (records, donations, events)
  └── Metabase (free tier)   ← reporting dashboards for alumni office management
```

#### SQLAdmin Quick-Start (SQLAlchemy-native)

```python
# main.py
from fastapi import FastAPI
from sqladmin import Admin, ModelView
from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import DeclarativeBase

engine = create_async_engine("postgresql+asyncpg://user:pass@localhost/alumni_db")

class Base(DeclarativeBase):
    pass

class Alumni(Base):
    __tablename__ = "alumni"
    id        = Column(Integer, primary_key=True)
    full_name = Column(String(200))
    email     = Column(String(255))
    cohort    = Column(String(10))
    city      = Column(String(100))

app = FastAPI()
admin = Admin(app, engine)

class AlumniAdmin(ModelView, model=Alumni):
    column_list            = [Alumni.id, Alumni.full_name, Alumni.email, Alumni.cohort, Alumni.city]
    column_searchable_list = [Alumni.full_name, Alumni.email]
    column_sortable_list   = [Alumni.cohort, Alumni.city]

admin.add_view(AlumniAdmin)
```

```bash
pip install sqladmin[full]
# Visit http://localhost:8000/admin
```

---

## 4. P10 — Combined Architecture Snapshot

```
[ tiangolo full-stack-fastapi-template ]
        |
        ├── backend/app/api/      <- alumni REST endpoints
        ├── backend/app/models/   <- SQLModel Alumni, Donation, Event
        ├── backend/app/core/     <- JWT auth, config (already written)
        |
        ├── SQLAdmin / CRUDAdmin  -> /admin  (staff CRUD, data entry)
        ├── alumni_dedup.py       -> scheduled job / cron deduplication
        └── Metabase (Docker)     -> :3000  (reports, no SQL required)

Database: PostgreSQL
  extensions: pg_trgm, fuzzystrmatch
  indexes:    gin(full_name gin_trgm_ops)
```

---

## 5. Quick Reference — Install Commands

```bash
# Backend scaffold
git clone https://github.com/fastapi/full-stack-fastapi-template alumni-portal
cd alumni-portal/backend && pip install -e ".[dev]"

# Admin panel (SQLAlchemy path — recommended)
pip install sqladmin[full]
# OR
uv add crudadmin

# Deduplication
pip install "sqlalchemy[asyncio]" psycopg2-binary rapidfuzz

# PostgreSQL extensions (run once in psql)
psql -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
psql -c "CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;"
psql -c "CREATE INDEX CONCURRENTLY alumni_name_trgm_idx ON alumni USING gin (full_name gin_trgm_ops);"

# Metabase (reporting layer)
docker pull metabase/metabase
docker run -d -p 3000:3000 --name metabase metabase/metabase
```

---

## 6. Sources & References

| # | Source |
|---|---|
| 1 | tiangolo full-stack-fastapi-template — https://github.com/fastapi/full-stack-fastapi-template |
| 2 | FastAPI project generation docs — https://fastapi.tiangolo.com/project-generation/ |
| 3 | StartPick FastAPI Template Review 2026 — https://starterpick.com/blog/fastapi-template-review-2026 |
| 4 | Crunchy Data: Fuzzy Name Matching in Postgres — https://www.crunchydata.com/blog/fuzzy-name-matching-in-postgresql |
| 5 | PostgreSQL pg_trgm docs — https://www.postgresql.org/docs/current/pgtrgm.html |
| 6 | pganalyze: Fuzzy text search — https://pganalyze.com/blog/5mins-postgres-fuzzy-text-search-case-insensitive-ICU-collations |
| 7 | SO: Find fuzzy duplicates with pg_trgm — https://stackoverflow.com/questions/54444866 |
| 8 | AdminJS GitHub — https://github.com/SoftwareBrothers/adminjs |
| 9 | FastAPI-Admin — https://fastapi-admin.github.io |
| 10 | Metabase v57 (inline CRUD) — https://www.metabase.com/releases/metabase-57 |
| 11 | SQLAdmin GitHub — sqladmin by aminalaee |
| 12 | CRUDAdmin — https://github.com/benavlabs/crudadmin |
| 13 | fastadmin (multi-ORM) — https://github.com/vsdudakov/fastadmin |
