# Session C — Ops Code Reference
## P5 · P6 · P7 · P9 — GDPR / Email / Stripe / Docker

> **Purpose:** Pre-researched, battle-tested snippets to feed project planning.  
> Zero written from scratch — all patterns sourced from authoritative repos, official docs, and production guides.

---

## P5 — GDPR Article 17: Right-to-Delete (FastAPI + PostgreSQL)

### Legal Obligation Summary
- Art. 17 GDPR: controller must erase personal data **without undue delay** on request.  
- Response deadline: **1 month**.  
- Applies when: consent withdrawn, data no longer necessary, unlawful processing.  
- Cascade requirement: notify downstream controllers / processors of erasure.

### Pattern 1 — SQLAlchemy ORM Cascade Delete (preferred, handles FK integrity)

```python
# models.py — Parent drives cascade; child FK must reference ON DELETE CASCADE
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id       = Column(Integer, primary_key=True, index=True)
    email    = Column(String, unique=True, nullable=False)
    # cascade="all, delete" tells SQLAlchemy to DELETE children when parent is deleted
    posts    = relationship("Post", back_populates="user", cascade="all, delete", passive_deletes=True)
    profiles = relationship("Profile", back_populates="user", cascade="all, delete", passive_deletes=True)

class Post(Base):
    __tablename__ = "posts"
    id      = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user    = relationship("User", back_populates="posts")

class Profile(Base):
    __tablename__ = "profiles"
    id      = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user    = relationship("User", back_populates="profiles")
```

> **Critical:** Use `db.delete(obj)` on the ORM object, NOT `db.query(User).filter(...).delete()`.  
> The Query `.delete()` method bypasses ORM cascade logic.

### Pattern 2 — FastAPI GDPR Delete Endpoint

```python
# routers/gdpr.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User
from app.auth import get_current_user   # your JWT/session auth dependency

router = APIRouter(prefix="/gdpr", tags=["GDPR"])

@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Article 17 GDPR — Right to erasure",
)
def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Permanently deletes the authenticated user and ALL related personal data
    via DB-level CASCADE + ORM cascade. Audit log written before delete.
    """
    # 1. Write deletion audit record (keep for legal proof, no PII)
    _write_deletion_audit(user_id=current_user.id, db=db)

    # 2. Revoke active Stripe subscriptions (call before DB delete)
    _cancel_stripe_subscription(customer_email=current_user.email)

    # 3. ORM delete triggers cascade on posts, profiles, sessions, etc.
    db.delete(current_user)
    db.commit()

    # 4. (Optional) fire event to notify downstream processors
    # deletion_event_bus.publish(user_id=current_user.id)

    return  # 204 No Content

def _write_deletion_audit(user_id: int, db: Session):
    # Store only non-PII: user_id hash + timestamp
    import hashlib, datetime
    from app.models import DeletionAuditLog
    record = DeletionAuditLog(
        user_id_hash=hashlib.sha256(str(user_id).encode()).hexdigest(),
        deleted_at=datetime.datetime.utcnow(),
    )
    db.add(record)
    db.flush()

def _cancel_stripe_subscription(customer_email: str):
    # Hook into Stripe cancel — see P7 section
    pass
```

### Pattern 3 — AsyncSession (SQLModel / async FastAPI)

```python
# For async usage: must load relationships BEFORE delete, else cascade is skipped
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

async def delete_user_async(db: AsyncSession, user_id: int):
    result = await db.execute(
        select(User)
        .options(selectinload(User.posts), selectinload(User.profiles))
        .where(User.id == user_id)
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
```

> **Gotcha (AsyncSession + `lazy='noload'`):**  
> If relationships are set to `lazy='noload'`, the user object loads with empty child lists,  
> so cascade finds nothing to delete. Always use `selectinload` or `joinedload` with async deletes.

### Alembic Migration Snippet — Ensure DB-Level CASCADE

```python
# In your alembic migration for posts table:
op.create_foreign_key(
    "fk_posts_user_id",
    "posts", "users",
    ["user_id"], ["id"],
    ondelete="CASCADE"   # <-- DB enforced, not just ORM
)
```

---

## P6 — Postmark Transactional Email (FastAPI + Python)

### Install

```bash
pip install postmarker
# No official SDK — postmarker is the community standard
```

### Pattern 1 — Minimal Postmark Send (postmarker SDK)

```python
# services/email.py
from postmarker.core import PostmarkClient
from app.config import settings   # POSTMARK_TOKEN from .env

postmark = PostmarkClient(server_token=settings.POSTMARK_TOKEN)

def send_transactional_email(
    to: str,
    subject: str,
    html_body: str,
    text_body: str = "",
    from_addr: str = "noreply@yourdomain.com",
    message_stream: str = "outbound",   # Postmark stream name
) -> dict:
    response = postmark.emails.send(
        From=from_addr,
        To=to,
        Subject=subject,
        HtmlBody=html_body,
        TextBody=text_body,
        MessageStream=message_stream,
    )
    return response
```

### Pattern 2 — FastAPI Route Wrapping Email Service

```python
# routers/notifications.py
from fastapi import APIRouter, BackgroundTasks, Depends
from app.auth import get_current_user
from app.services.email import send_transactional_email

router = APIRouter(prefix="/notifications", tags=["Email"])

@router.post("/welcome")
async def send_welcome_email(
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    background_tasks.add_task(
        send_transactional_email,
        to=current_user.email,
        subject="Welcome to the platform!",
        html_body="<h1>Welcome!</h1><p>Your account is ready.</p>",
    )
    return {"status": "queued"}

@router.post("/deletion-confirmation")
async def send_deletion_confirmation(email: str):
    """Fire after GDPR Article 17 delete (P5)"""
    send_transactional_email(
        to=email,
        subject="Your data has been deleted",
        html_body="<p>Your account and personal data have been permanently erased.</p>",
    )
    return {"status": "sent"}
```

### Pattern 3 — Direct HTTP via httpx (no SDK, minimal deps)

```python
# services/email_http.py  — zero-dependency alternative
import httpx
from app.config import settings

POSTMARK_API_URL = "https://api.postmarkapp.com/email"

async def send_email_httpx(to: str, subject: str, html_body: str) -> dict:
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": settings.POSTMARK_TOKEN,
    }
    payload = {
        "From": "noreply@yourdomain.com",
        "To": to,
        "Subject": subject,
        "HtmlBody": html_body,
        "MessageStream": "outbound",
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(POSTMARK_API_URL, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
```

### `.env` Keys Required

```env
POSTMARK_TOKEN=your-postmark-server-api-token
EMAIL_FROM=noreply@yourdomain.com
```

> **DNS prerequisites:** SPF, DKIM, DMARC records required. Propagation: 24–72 hours.  
> Always use **transactional message stream** (`outbound`) for receipts, deletion confirmations, welcome emails.

---

## P7 — Stripe Subscription Webhook (FastAPI — Basic vs Premium)

### Install

```bash
pip install stripe
```

### Pattern 1 — Stripe Product/Price Setup Reference

```
Basic tier   → $5/month  → copy Price ID → STRIPE_BASIC_PRICE_ID
Premium tier → $15/month → copy Price ID → STRIPE_PREMIUM_PRICE_ID
```
Source: Stripe official docs (flat-rate pricing, 2-tier example).

### Pattern 2 — Subscription Check Dependency

```python
# dependencies/stripe_auth.py
import stripe
from fastapi import Depends, HTTPException
from app.config import settings
from app.auth import get_current_user

stripe.api_key = settings.STRIPE_SECRET_KEY

TIER_PRICE_MAP = {
    "basic":   settings.STRIPE_BASIC_PRICE_ID,
    "premium": settings.STRIPE_PREMIUM_PRICE_ID,
}

async def require_active_subscription(
    current_user=Depends(get_current_user),
) -> dict:
    customers = await stripe.Customer.list_async(email=current_user.email, limit=1)
    if not customers.data:
        raise HTTPException(status_code=403, detail="No Stripe customer found")
    subscriptions = await stripe.Subscription.list_async(
        customer=customers.data[0].id,
        status="active",
        limit=1,
    )
    if not subscriptions.data:
        raise HTTPException(status_code=403, detail="No active subscription")
    return subscriptions.data[0]

async def require_premium(sub=Depends(require_active_subscription)):
    price_id = sub["items"]["data"][0]["price"]["id"]
    if price_id != settings.STRIPE_PREMIUM_PRICE_ID:
        raise HTTPException(status_code=403, detail="Premium plan required")
    return sub
```

### Pattern 3 — Webhook Handler (signature-verified, all key events)

```python
# routers/stripe_webhook.py
import stripe
from fastapi import APIRouter, Request, HTTPException
from app.config import settings
from app.db import SessionLocal
from app.models import User

router = APIRouter(prefix="/payments", tags=["Stripe"])
stripe.api_key = settings.STRIPE_SECRET_KEY

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload    = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    data       = event["data"]["object"]

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data)

    elif event_type == "customer.subscription.created":
        _handle_subscription_created(data)

    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(data)

    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data)

    elif event_type == "invoice.payment_succeeded":
        _handle_invoice_paid(data)

    elif event_type == "invoice.payment_failed":
        _handle_invoice_failed(data)

    return {"status": "ok"}

# --- Handlers ---

def _handle_checkout_completed(session: dict):
    email = session.get("customer_details", {}).get("email")
    # TODO: persist stripe_customer_id to User, grant access
    print(f"[Stripe] Checkout complete: {email}")

def _handle_subscription_created(sub: dict):
    customer_id = sub["customer"]
    price_id    = sub["items"]["data"][0]["price"]["id"]
    tier = "premium" if price_id == settings.STRIPE_PREMIUM_PRICE_ID else "basic"
    # TODO: db.query(User).filter(...).update({"tier": tier, "subscription_id": sub["id"]})
    print(f"[Stripe] Subscription created: customer={customer_id} tier={tier}")

def _handle_subscription_updated(sub: dict):
    customer_id = sub["customer"]
    status      = sub["status"]
    price_id    = sub["items"]["data"][0]["price"]["id"]
    tier = "premium" if price_id == settings.STRIPE_PREMIUM_PRICE_ID else "basic"
    # TODO: update User.tier, User.subscription_status
    print(f"[Stripe] Subscription updated: {customer_id} → {tier} / {status}")

def _handle_subscription_deleted(sub: dict):
    customer_id = sub["customer"]
    # TODO: revoke access, update User.tier = "free"
    # Hook: send cancellation email via P6 Postmark
    print(f"[Stripe] Subscription cancelled: {customer_id}")

def _handle_invoice_paid(invoice: dict):
    customer_id = invoice["customer"]
    # TODO: extend subscription, send receipt via P6 Postmark
    print(f"[Stripe] Invoice paid: {customer_id}")

def _handle_invoice_failed(invoice: dict):
    customer_id = invoice["customer"]
    # TODO: send payment failure email (P6), pause access after grace period
    print(f"[Stripe] Payment FAILED: {customer_id}")
```

### Pattern 4 — Protected Premium Route

```python
# routers/content.py
from fastapi import APIRouter, Depends
from app.dependencies.stripe_auth import require_active_subscription, require_premium

router = APIRouter()

@router.get("/basic-content")
async def basic_content(sub=Depends(require_active_subscription)):
    return {"message": "Basic content", "subscription_id": sub.id}

@router.get("/premium-content")
async def premium_content(sub=Depends(require_premium)):
    return {"message": "Premium content", "subscription_id": sub.id}
```

### `.env` Keys Required

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BASIC_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
```

---

## P9 — Docker Compose: FastAPI + PostgreSQL + Nginx + Certbot (Production)

### Reference Repositories
| Repo | Stars | Notes |
|---|---|---|
| `wmnnd/nginx-certbot` | 3k+ | Battle-tested init script for Let's Encrypt + Nginx |
| `zhanymkanov/fastapi_production_template` | 2k+ | FastAPI + Postgres + Gunicorn + async SQLAlchemy |
| `rafsaf/docker-fastapi-projects-nginx-with-postgresql` | Community | Nginx + Postgres production stack |
| `fastapi/full-stack-fastapi-template` | Official | Full-stack baseline with Docker Swarm support |

### Pattern — `docker-compose.prod.yml`

```yaml
version: "3.8"

services:
  # ── FastAPI App (Gunicorn + Uvicorn workers) ─────────────────────────────
  web:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    expose:
      - "8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      - SECRET_KEY=${SECRET_KEY}
      - ENVIRONMENT=production
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs

  # ── PostgreSQL 16 ─────────────────────────────────────────────────────────
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Nginx Reverse Proxy ───────────────────────────────────────────────────
  nginx:
    image: nginx:1.25-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/certbot/www:/var/www/certbot:ro
      - ./nginx/certbot/conf:/etc/nginx/ssl:ro
    depends_on:
      - web

  # ── Certbot (Let's Encrypt) ───────────────────────────────────────────────
  certbot:
    image: certbot/certbot:latest
    volumes:
      - ./nginx/certbot/www:/var/www/certbot:rw
      - ./nginx/certbot/conf:/etc/letsencrypt:rw
    command: >
      certonly --webroot
      --webroot-path=/var/www/certbot
      --email ${ADMIN_EMAIL}
      --agree-tos
      --no-eff-email
      --force-renewal
      -d ${DOMAIN}

volumes:
  postgres_data:
```

### Pattern — `nginx/conf.d/app.conf`

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS with upstream FastAPI
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/nginx/ssl/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/live/yourdomain.com/privkey.pem;

    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 20M;

    location / {
        proxy_pass         http://web:8000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### Pattern — `Dockerfile` (production-optimised)

```dockerfile
FROM python:3.12-slim AS base

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN pip install --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root user (security hardening)
RUN adduser --disabled-password --gecos "" appuser
USER appuser

CMD ["gunicorn", "app.main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120"]
```

### Init Sequence (first deploy)

```bash
# 1. Create .env from template
cp .env.example .env && nano .env

# 2. Start nginx first (HTTP only) to pass ACME challenge
docker compose -f docker-compose.prod.yml up -d nginx

# 3. Run certbot once to obtain certificate
docker compose -f docker-compose.prod.yml run certbot

# 4. Restart nginx to pick up SSL certs
docker compose -f docker-compose.prod.yml restart nginx

# 5. Bring up all services
docker compose -f docker-compose.prod.yml up -d

# 6. Run Alembic migrations
docker compose -f docker-compose.prod.yml exec web alembic upgrade head
```

### `.env` Keys Required

```env
POSTGRES_PASSWORD=strongpassword
POSTGRES_DB=myapp
SECRET_KEY=supersecret
DOMAIN=yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
```

---

## Cross-Component Integration Map

```
P5 GDPR Delete ──► P6 Postmark   (send deletion confirmation email)
P5 GDPR Delete ──► P7 Stripe     (cancel active subscription on delete)
P7 Stripe Events ► P6 Postmark   (invoice paid / failed → email receipt)
P9 Docker Stack  ► hosts P5/P6/P7 endpoints behind Nginx/SSL
```

## Key Sources

| Topic | Source |
|---|---|
| SQLAlchemy cascade | Stack Overflow #72950729, GeeksforGeeks, fastapi/sqlmodel issue #480 |
| Async cascade gotcha | SQLModel GitHub Issue #480 |
| GDPR Art. 17 legal text | gdpr-info.eu, ICO.org.uk, dataprotection.ie |
| Postmark SDK | postmarker (PyPI), postmarkapp.com/send-email/python |
| Stripe webhook FastAPI | fast-saas.com, dev.to/fastapier, Stripe official docs |
| Stripe Basic/Premium pricing | docs.stripe.com/billing/subscriptions/build-subscriptions |
| Docker prod stack | zhanymkanov/fastapi_production_template, wmnnd/nginx-certbot |
| Certbot + FastAPI | fastapitutorial.com/blog/certbot-docker-fastapi |
| Nginx + Let's Encrypt compose | eugene-khyst/letsencrypt-docker-compose (archived ref) |

