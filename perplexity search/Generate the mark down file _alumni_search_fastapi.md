
# Alumni Search FastAPI – PostgreSQL FTS Core

This document captures the **PostgreSQL full‑text search schema** plus some glue notes on how the parts connect inside a FastAPI + SQLAlchemy project.[web:2][web:8]  
It is meant as a copy‑pasteable foundation and a reminder of questions you still need to clarify before going into production.

---

## 1. PostgreSQL schema and FTS index

```sql
-- 1.1 Alumni table
CREATE TABLE alumni (
    id          SERIAL PRIMARY KEY,
    full_name   VARCHAR(255) NOT NULL,
    headline    VARCHAR(255),
    bio         TEXT,
    grad_year   INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 tsvector column for FTS
ALTER TABLE alumni
ADD COLUMN search_vector tsvector;

-- 1.3 initial population of search_vector
UPDATE alumni
SET search_vector =
    to_tsvector(
        'english',
        coalesce(full_name, '') || ' ' ||
        coalesce(headline, '')  || ' ' ||
        coalesce(bio, '')
    );

-- 1.4 GIN index for fast full-text search
CREATE INDEX idx_alumni_search_vector
ON alumni
USING gin (search_vector);

-- 1.5 trigger function to keep search_vector in sync
CREATE FUNCTION alumni_search_vector_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        to_tsvector(
            'english',
            coalesce(NEW.full_name, '') || ' ' ||
            coalesce(NEW.headline, '')  || ' ' ||
            coalesce(NEW.bio, '')
        );
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 1.6 trigger definition
CREATE TRIGGER trg_alumni_search_vector
BEFORE INSERT OR UPDATE ON alumni
FOR EACH ROW
EXECUTE FUNCTION alumni_search_vector_trigger();
```

These steps follow the standard PostgreSQL FTS pattern: a dedicated `tsvector` column, a GIN index on it, and a trigger to keep it updated on each write.[web:2][web:8]

---

## 2. How these parts connect in the FastAPI stack

At a high level, there are **four layers** that need to align around this FTS schema:

1. **Database layer (PostgreSQL)**
    - The `alumni` table is the source of truth for all profile data.
    - `search_vector` is a *derived* column that you never write to from Python; it is updated by the trigger on `INSERT` and `UPDATE`.
    - The GIN index (`idx_alumni_search_vector`) allows fast `@@` queries on `search_vector` even for large datasets.[web:2][web:8]
2. **ORM layer (SQLAlchemy model)**
    - A corresponding `Alumni` model exposes columns `full_name`, `headline`, `bio`, `grad_year`, `created_at`, and `search_vector`.
    - In Python, `search_vector` is typically mapped with `TSVECTOR` from `sqlalchemy.dialects.postgresql`, but your application code rarely reads it directly.
    - Queries use expressions like `Alumni.search_vector.op('@@')(func.plainto_tsquery('english', q))` to leverage FTS from SQLAlchemy.[web:2][web:9]
3. **API/query layer (FastAPI endpoints)**
    - Endpoints accept a free‑text `q` plus pagination parameters (`page`, `page_size`) and optional filters such as `grad_year`.
    - The core query pattern is:
        - build `ts_query = func.plainto_tsquery('english', q)`
        - filter with `Alumni.search_vector.op('@@')(ts_query)`
        - order by `ts_rank(Alumni.search_vector, ts_query)` and tie‑breakers (e.g., `created_at`)
        - apply `.offset()` and `.limit()` for pagination.
    - Responses serialize ORM objects into Pydantic models (e.g., `AlumniOut`) and wrap them in a pagination container with metadata.[web:2][web:3][web:13]
4. **Client/UX layer (web or internal tools)**
    - The client sends queries like `/alumni/search?q=data+engineer+berlin&page=1&page_size=20`.
    - It consumes the result list plus `total`, `total_pages`, and `has_next` to draw pagination controls.
    - Ranking and filters should match user expectations (e.g., more recent or more complete profiles float higher).

---

## 3. Why this file is more than copy‑paste code

Copying the bare SQL and Python code without the surrounding thinking often leads to hidden issues later, even if the code “works”.[web:11]
This markdown captures **connections and trade‑offs** that plain snippets do not express:

- It records why `search_vector` is a generated column and not something you manipulate in application code.
- It documents the FTS query pattern (`plainto_tsquery`, `ts_rank`) as part of a larger FastAPI stack.
- It reminds you that pagination, ranking, and filters are not independent; you decide how they interact for your specific alumni use‑case.
- It explicitly lists open questions you still need to answer, so this becomes a planning artifact, not just boilerplate.

---

## 4. Four aspects that are not answered yet (and you should decide)

Even with “battle‑tested” patterns, several **design decisions are still open** and need your judgment for an alumni directory:

1. **Language and stemming strategy**
    - The code assumes `'english'` configuration for `to_tsvector` and `plainto_tsquery`.
    - For an international alumni base (DE, NL, FR, etc.), you may need:
        - multiple language configurations,
        - per‑user locale selection, or
        - a custom combined dictionary.
    - This affects recall and precision (e.g., “ökonomie” vs “economics”), and needs a deliberate choice.[web:8]
2. **Profile fields included in ranking and their weights**
    - Current snippet concatenates `full_name`, `headline`, and `bio` with equal weight.
    - In reality, matches in the *name* or *headline* probably deserve higher relevance than matches deep in the bio.
    - Postgres supports `setweight` (A/B/C/D) on different fields, which you might want to use to tune ranking: e.g., name > headline > bio.[web:8]
    - You also might want to add non‑FTS signals (recent activity, verified email, etc.) into the ordering.
3. **Pagination strategy under high load**
    - Offset‑based pagination (`OFFSET ... LIMIT ...`) is easy and good enough for moderate result sets.
    - Under heavy use, deep pages (e.g., page 1000) become slow because Postgres still has to scan and sort many rows.
    - Keyset (cursor) pagination using stable tie‑breakers can drastically improve performance but complicates the API.
    - You need to decide which pattern the alumni product actually requires and possibly support both (simple offset for UI; keyset for internal tools).[web:3][web:11]
4. **Access control and multi‑tenant concerns**
    - The current model assumes a single global alumni dataset.
    - Many real‑world alumni directories are scoped to:
        - specific schools or programs,
        - graduation cohorts,
        - membership tiers.
    - That usually implies additional columns (e.g., `school_id`, `visibility_level`) and extra conditions in both the FTS filter and the count query.
    - You also need to decide what is publicly searchable vs. what requires authentication and how that interacts with indexes and caching.

---

## 5. Next steps

Before turning this into production code, it is worth answering at least:

- Which languages and countries must be supported from day one?
- Which alumni fields are *most* important to rank high (name, headline, skills, location, employer)?
- How large do you expect the dataset and query volume to be in the next 3 years (to choose between offset vs. keyset)?
- What visibility rules apply to profiles (public, logged‑in only, per‑alumnus privacy settings)?

Once you sketch those answers, the next iteration of this file can add the SQLAlchemy model and FastAPI endpoints that encode these decisions explicitly.

---
```

From these four “open aspects”, which one feels most critical for your alumni use case right now: language handling, ranking weights, pagination strategy, or access control?```

