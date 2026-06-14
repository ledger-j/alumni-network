# FastAPI Alumni Portal & University Network — Open-Source GitHub Repo Scouting
> Research date: May 2026 | Scope: 2023–2025 repos with FastAPI + PostgreSQL + Jinja2 or React frontend

---

## 🎯 Purpose
Find battle-tested, prewritten open-source code bases to serve as the foundation for a FastAPI alumni portal project. Zero from scratch. Steal smart.

---

## 🏆 Tier 1 — Primary Foundation Templates

### 1. `fastapi/full-stack-fastapi-template`
| Field | Detail |
|---|---|
| **URL** | https://github.com/fastapi/full-stack-fastapi-template |
| **Stars** | ⭐ 42,600+ (global rank #549) |
| **Forks** | 8,400+ |
| **Last release** | v0.10.0 — Jan 2026 (0 open PRs, 0 open issues) |
| **License** | MIT |
| **Frontend** | React (TypeScript) + Chakra UI |
| **Backend** | FastAPI + SQLModel + Pydantic v2 |
| **Database** | PostgreSQL |
| **Auth** | OAuth2 JWT (Argon2 password hashing as of v0.10.0) |
| **DevOps** | Docker, Docker Compose, GitHub Actions CI/CD, Traefik, automatic HTTPS |
| **Extras** | Adminer (DB UI), E2E tests, uv workspace, bun monorepo |

**Why use it:** The canonical, creator-maintained FastAPI full-stack template. Most battle-tested codebase available. Every pattern inside is idiomatic FastAPI. Build the alumni portal domain layer on top of this scaffold.

**Key files to reuse:**
- `backend/app/api/` → route skeletons
- `backend/app/models.py` → SQLModel user model (extend for alumni profile)
- `backend/app/core/security.py` → JWT logic
- `frontend/src/` → React auth flow and dashboard shell

---

### 2. `whythawk/full-stack-fastapi-postgresql`
| Field | Detail |
|---|---|
| **URL** | https://github.com/whythawk/full-stack-fastapi-postgresql |
| **Stars** | ⭐ 250 |
| **Forks** | 47 |
| **Last release** | 0.9.0 — May 2024 |
| **License** | MIT |
| **Frontend** | Nuxt 3 / Vue 3 (TypeScript) + TailwindCSS + HeadlessUI |
| **Backend** | FastAPI 0.109 + SQLAlchemy 2.0 + Pydantic 2.7 |
| **Database** | PostgreSQL 15 + PGAdmin + Neo4j graph DB |
| **Auth** | OAuth2 JWT + **magic-link** auth + TOTP 2FA + cookie management |
| **Task queue** | Celery + RabbitMQ + Flower dashboard |
| **Migrations** | Alembic |
| **DevOps** | Docker Compose, Traefik load-balancer, Let's Encrypt HTTPS |

**Why use it:** More enterprise-grade than the official template. The magic-link auth is perfect for alumni invitations (send email, click, log in). Neo4j enables graph-based alumni connection recommendations (shared employer, shared cohort). Celery handles async jobs like bulk email blasts to alumni. Use if you need advanced networking features.

**Key files to reuse:**
- `backend/app/crud/` → generic CRUD base classes
- `backend/app/schemas/` → Dublin Core metadata schema (great for alumni profiles)
- `backend/celeryworker/` → async task workers for email/notifications
- `frontend/pages/` → Nuxt auth middleware patterns

---

## 🎓 Tier 2 — Alumni-Specific Repos (Domain Logic)

### 3. `ShobanChiddarth/alumni-connect-backend`
| Field | Detail |
|---|---|
| **URL** | https://github.com/ShobanChiddarth/alumni-connect-backend |
| **Stack** | FastAPI + PostgreSQL 16 + SQLAlchemy + Alembic |
| **Auth** | JWT, role-based user flows |
| **Roles** | Student, Alumni, Admin (3-tier RBAC) |
| **Domain features** | Readiness scoring engine, job board, mentorship system |
| **License** | Check repo |

**Why use it:** This is the only **directly alumni-scoped FastAPI + PostgreSQL** backend found (2024). The readiness scoring engine (student career readiness) and job/mentorship APIs are copy-paste ready domain logic. Avoids reinventing the alumni-specific data model.

**Key domain models to steal:**
- Alumni profile schema with professional data fields
- Student ↔ Alumni mentorship pairing model
- Job posting + application model
- Readiness/scoring engine logic

---

### 4. `ShubhamKarampure/ShikshaSangam`
| Field | Detail |
|---|---|
| **URL** | https://github.com/ShubhamKarampure/ShikshaSangam |
| **Stars** | Active (SIH 2024 submission) |
| **Frontend** | React.js |
| **Backend** | Django + DRF (not FastAPI — port patterns) |
| **Database** | PostgreSQL |
| **Auth** | JWT + OAuth2 |
| **ML** | Scikit-learn / TensorFlow for alumni–student matching |

**Why use it:** Despite using Django instead of FastAPI, the **domain model and feature set is the most complete alumni network** found. Use as a feature spec and data model reference. Port the PostgreSQL schema to SQLAlchemy models.

**Features to port to FastAPI:**
- Centralized alumni database (employment status, achievements, expertise)
- Discussion forums + mentorship pairing
- AI-powered connection matching (interests/career path/industry)
- NLP content moderation
- Event management (meetups, webinars, panel discussions)
- Placement assistance + job opportunities

---

### 5. `nawal03/AlumNET`
| Field | Detail |
|---|---|
| **URL** | https://github.com/nawal03/AlumNET |
| **Description** | Social networking platform for BUET university alumni |
| **Features** | Connections, blog posts, job board, notifications |
| **Use** | Reference for alumni social feed + connection-request flow |

---

### 6. `RAJESH2961/ALUMNI-CONNECT`
| Field | Detail |
|---|---|
| **URL** | https://github.com/RAJESH2961/ALUMNI-CONNECT |
| **Description** | Full-stack alumni networking with career opportunities |
| **Features** | Alumni network, career guidance, student ↔ alumni bridge |
| **Use** | Reference for alumni directory + career module |

---

## 🧩 Tier 3 — Building-Block Libraries

### 7. `Promptly-Technologies-LLC/fastapi-jinja2-postgres-webapp`
| Field | Detail |
|---|---|
| **URL** | https://github.com/Promptly-Technologies-LLC/fastapi-jinja2-postgres-webapp |
| **Stars** | 4 (small but high quality) |
| **Published** | Sep 2024 |
| **Frontend** | **Jinja2** + Bootstrap (pure Python, minimal JS) |
| **Backend** | FastAPI + SQLModel |
| **Database** | PostgreSQL |
| **Auth** | Token-based + password recovery + **RBAC** |
| **DevOps** | Docker, GitHub Actions CI/CD, uv, Pytest, MyPy |
| **LLM support** | `.cursor/rules` + `llms.txt` for AI-assisted dev |
| **License** | MIT |

**Why use it:** The only Jinja2 + PostgreSQL template with full auth. Use if you prefer server-rendered HTML over a React SPA — ideal for admin panels and alumni directory views. The `llms.txt` file makes it AI-coding-friendly.

---

### 8. `fastapi-users/fastapi-users`
| Field | Detail |
|---|---|
| **URL** | https://github.com/fastapi-users/fastapi-users |
| **Purpose** | Drop-in user registration, login, email verification, password reset |
| **DB adapter** | `fastapi-users-db-sqlalchemy` → PostgreSQL via asyncpg |
| **Install** | `pip install fastapi-users[sqlalchemy]` |

**Why use it:** Handles the entire user lifecycle out of the box. Plug into either Tier 1 template as the auth backbone, then extend the `User` model with alumni-specific fields.

---

### 9. `doganzub/FullCalendar-FastAPI-PostgreSQL`
| Field | Detail |
|---|---|
| **URL** | https://github.com/doganzub/FullCalendar-FastAPI-PostgreSQL |
| **Published** | Sep 2024 |
| **Stack** | FastAPI + SQLAlchemy + **Jinja2** + PostgreSQL |
| **Feature** | FullCalendar event scheduling UI |

**Why use it:** Ready-made event calendar with FastAPI + Jinja2 + PostgreSQL. Plug into alumni portal for event management (reunions, webinars, career fairs).

---

### 10. `00-Python/FastAPI-Role-and-Permissions`
| Field | Detail |
|---|---|
| **URL** | https://github.com/00-Python/FastAPI-Role-and-Permissions |
| **Published** | Jul 2024 |
| **Stack** | FastAPI + JWT + PostgreSQL |
| **Feature** | Fine-grained RBAC (roles + permissions) boilerplate |

**Why use it:** Alumni portals need multi-role access (student, alumni, staff, admin). This boilerplate wires JWT auth to a PostgreSQL permissions table cleanly.

---

## 🗺️ Recommended Composition Strategy

```
FOUNDATION  →  fastapi/full-stack-fastapi-template  (scaffold + React UI)
              OR
              Promptly-Technologies-LLC/fastapi-jinja2-postgres-webapp  (if Jinja2)

DOMAIN      →  ShobanChiddarth/alumni-connect-backend  (alumni models + scoring)
FEATURES    →  ShikshaSangam  (port feature set + data model to FastAPI)
AUTH        →  fastapi-users/fastapi-users  (drop-in user lifecycle)
RBAC        →  00-Python/FastAPI-Role-and-Permissions  (roles: student/alumni/admin)
EVENTS      →  doganzub/FullCalendar-FastAPI-PostgreSQL  (calendar module)
NETWORKING  →  whythawk/full-stack-fastapi-postgresql  (if Neo4j graph + Celery needed)
```

---

## 📋 Module Checklist for Alumni Portal

| Module | Source Repo | Status |
|---|---|---|
| User registration + email verify | `fastapi-users` | ✅ Drop-in |
| JWT auth + refresh tokens | `full-stack-fastapi-template` | ✅ Drop-in |
| RBAC (student/alumni/admin) | `00-Python/FastAPI-Role-and-Permissions` | ✅ Adapt |
| Alumni profile model | `alumni-connect-backend` | ✅ Adapt |
| Mentorship system | `alumni-connect-backend` + `ShikshaSangam` | 🔧 Port |
| Job board | `alumni-connect-backend` | ✅ Adapt |
| Career readiness scoring | `alumni-connect-backend` | ✅ Adapt |
| Event calendar | `FullCalendar-FastAPI-PostgreSQL` | ✅ Plug in |
| Alumni directory + search | `AlumNET` + `ALUMNI-CONNECT` | 🔧 Port |
| Alumni–student matching (AI) | `ShikshaSangam` ML module | 🔧 Port |
| React dashboard shell | `full-stack-fastapi-template` frontend | ✅ Drop-in |
| Server-rendered admin views | `fastapi-jinja2-postgres-webapp` | ✅ Drop-in |
| Async email / notifications | `whythawk` Celery workers | 🔧 Adapt |
| DB migrations | Alembic (in all templates) | ✅ Standard |

---

## ⚡ Quick-Start Commands

```bash
# Option A: React frontend (recommended)
git clone https://github.com/fastapi/full-stack-fastapi-template my-alumni-portal
cd my-alumni-portal
cp .env.example .env
docker compose up -d

# Option B: Jinja2 server-rendered
git clone https://github.com/Promptly-Technologies-LLC/fastapi-jinja2-postgres-webapp my-alumni-portal
cd my-alumni-portal
uv venv && uv sync
docker compose up -d  # starts PostgreSQL
uv run python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🔗 All Repository URLs

| Repo | URL |
|---|---|
| full-stack-fastapi-template | https://github.com/fastapi/full-stack-fastapi-template |
| full-stack-fastapi-postgresql (whythawk) | https://github.com/whythawk/full-stack-fastapi-postgresql |
| fastapi-jinja2-postgres-webapp | https://github.com/Promptly-Technologies-LLC/fastapi-jinja2-postgres-webapp |
| alumni-connect-backend | https://github.com/ShobanChiddarth/alumni-connect-backend |
| ShikshaSangam | https://github.com/ShubhamKarampure/ShikshaSangam |
| AlumNET | https://github.com/nawal03/AlumNET |
| ALUMNI-CONNECT (RAJESH) | https://github.com/RAJESH2961/ALUMNI-CONNECT |
| FullCalendar-FastAPI-PostgreSQL | https://github.com/doganzub/FullCalendar-FastAPI-PostgreSQL |
| FastAPI-Role-and-Permissions | https://github.com/00-Python/FastAPI-Role-and-Permissions |
| fastapi-users | https://github.com/fastapi-users/fastapi-users |

---

*Generated: May 2026 | Feed into: Project Planning Phase*
