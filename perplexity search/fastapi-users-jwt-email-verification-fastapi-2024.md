# fastapi-users library setup guide for JWT auth + email verification in FastAPI, production-ready 2024

## Why this is a strong starting point
- `fastapi-users` provides ready-to-use register, login, reset password, and verify email routes, along with JWT, cookie/header transports, and multiple database backends.[page:2]
- The official full example includes JWT authentication, `get_verify_router(...)`, and user-manager hooks for verification requests, which makes it a practical base instead of writing auth flows from scratch.[page:2]
- The project README was updated in November 2024, so this reference is suitable for a 2024-era production baseline.[page:1]

## Core official pattern
The official SQLAlchemy example wires these routers into `FastAPI`:[page:2]
- `fastapi_users.get_auth_router(auth_backend)` under `/auth/jwt`
- `fastapi_users.get_register_router(UserRead, UserCreate)` under `/auth`
- `fastapi_users.get_reset_password_router()` under `/auth`
- `fastapi_users.get_verify_router(UserRead)` under `/auth`
- `fastapi_users.get_users_router(UserRead, UserUpdate)` under `/users`

It also defines a `UserManager` with:[page:2]
- `reset_password_token_secret = SECRET`
- `verification_token_secret = SECRET`
- `on_after_request_verify(...)` hook, where you send the verification email
- a JWT backend using `BearerTransport(tokenUrl="auth/jwt/login")`
- `JWTStrategy(secret=SECRET, lifetime_seconds=3600)`

## Minimal official example to adapt
```python
from fastapi import Depends, FastAPI
from app.db import User, create_db_and_tables
from app.schemas import UserCreate, UserRead, UserUpdate
from app.users import auth_backend, current_active_user, fastapi_users

app = FastAPI()

app.include_router(
    fastapi_users.get_auth_router(auth_backend), prefix="/auth/jwt", tags=["auth"]
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

@app.get("/authenticated-route")
async def authenticated_route(user: User = Depends(current_active_user)):
    return {"message": f"Hello {user.email}!"}

@app.on_event("startup")
async def on_startup():
    await create_db_and_tables()
```
Source: official full example.[page:2]

## User manager and JWT backend example
```python
import uuid
from typing import Optional

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users.db import SQLAlchemyUserDatabase

from app.db import User, get_user_db

SECRET = "CHANGE_ME"

class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = SECRET
    verification_token_secret = SECRET

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        print(f"User {user.id} has registered.")

    async def on_after_forgot_password(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        print(f"User {user.id} forgot password. Reset token: {token}")

    async def on_after_request_verify(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        print(f"Verification requested for user {user.id}. Verification token: {token}")

async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)

bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])
current_active_user = fastapi_users.current_user(active=True)
```
Source: official full example.[page:2]

## What to change for real production use
Use the official example as the skeleton, but harden these parts before shipping:[page:2]
- Replace `SECRET = "SECRET"` with a strong secret stored in environment variables; the docs explicitly warn that insecure secrets can expose your database.[page:2]
- Swap SQLite demo storage for your real production database and migrations; the example notes startup table creation is only for simple setups and suggests using a migration system such as Alembic.[page:2]
- Implement `on_after_request_verify(...)` to actually send an email via your provider instead of printing tokens to logs.[page:2]
- Gate protected endpoints with `current_active_user` or stricter dependencies as shown in the example.[page:2]

## Battle-tested pieces worth reusing
- Built-in verify-email flow through `get_verify_router(UserRead)`.[page:2]
- Built-in password-reset flow through `get_reset_password_router()`.[page:2]
- JWT strategy and bearer transport abstraction, so you avoid hand-rolling token parsing and auth route plumbing.[page:2]
- Extensible user manager hooks for registration, forgot password, and verification email dispatch.[page:2]
- Library support for SQLAlchemy async and Beanie, depending on your stack.[page:1][page:2]

## Practical implementation note
The official example gives you the auth plumbing, but not the email delivery implementation; your production app still needs a mail provider integration inside `on_after_request_verify(...)` to send the tokenized verification link.[page:2]

## URLs
- Official docs: https://fastapi-users.github.io/fastapi-users/
- Full example used here: https://fastapi-users.github.io/fastapi-users/10.1/configuration/full-example/
- Repository README: https://github.com/fastapi-users/fastapi-users/blob/master/README.md
