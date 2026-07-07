# UniCircle backend — PocketBase

Open-source backend powering UniCircle accounts, posting, chat and the LinkedIn
import. One self-hosted [PocketBase](https://pocketbase.io) binary (auth +
realtime + REST + admin UI) running in Docker behind the shared Caddy edge.

## Where it runs

| | |
|---|---|
| Host | Hetzner **LMS** box — `195.201.26.62` (`ssh LMS`) |
| Stack dir | `/opt/unicircle/` |
| Container | `unicircle-pb` (PocketBase **v0.39.4**), `restart: unless-stopped` |
| Bind | `127.0.0.1:8090` (loopback only until public) + `caddy` network |
| Data | Docker volume `unicircle_pb-data` → `/pb/pb_data` (SQLite + uploads) |
| Admin creds | `/opt/unicircle/ADMIN_CREDENTIALS.txt` (chmod 600, root only) |

## Data model

- **users** (auth) — built-in `email`/`password`/`name`/`avatar` plus added
  profile fields: `headline`, `location`, `degree`, `linkedin_url`,
  `linkedin_imported`, `supporter`, `mentor`, `mentor_offer`.
  Open signup (`createRule: ""`), public profile listing, self-edit only.
- **posts** — `author`→users, `text`, `image`, `degree`, `likes`. Public read;
  create requires auth; update/delete by author.
- **messages** — `sender`→users, `recipient`→users, `text`, `read`. Visible
  only to sender/recipient; create as yourself.

Schema is created by `init_schema.py` (idempotent; reads the live field format
so it stays correct across PB versions). `verify.py` runs an end-to-end smoke
test (signup → login → post → message) and cleans up after itself.

## Operate

```bash
ssh LMS
cd /opt/unicircle
docker compose ps                 # status
docker compose logs -f pocketbase # logs
docker compose up -d --build      # rebuild/restart
docker compose down               # stop (data volume persists)
# admin UI over a tunnel:  ssh -L 8090:127.0.0.1:8090 LMS  → http://localhost:8090/_/
```

## Go public (the one remaining step)

The backend is live but loopback-only. To expose it over HTTPS:

1. **DNS** — add at your `unicircle.eu` DNS host (KAS):
   `api.unicircle.eu  A  195.201.26.62`
   (today it points at kasserver — repoint it here.)
2. **Edge** — once DNS resolves to the box:
   `ssh LMS 'bash /opt/unicircle/go-public.sh'`
   Caddy auto-issues a Let's Encrypt cert and routes `api.unicircle.eu` →
   `unicircle-pb:8090`. The frontend already defaults to `https://api.unicircle.eu`.

Verify: `curl -s https://api.unicircle.eu/api/health`

## Enable passwordless magic-link / OTP + password reset + verification

The frontend's **primary** login is now passwordless (PocketBase OTP), with
email+password and LinkedIn as fallbacks. All three of these — the magic-link
code, the "Forgot password?" reset, and post-signup verification — send email,
so they need SMTP and OTP switched on:

1. **SMTP** — PocketBase admin → **Settings → Mail settings** → set a real SMTP
   host/credentials (e.g. a transactional provider). Without this, no code/reset/
   verification email is delivered and magic-link login cannot complete.
2. **OTP** — admin → **Collections → users → Options (auth)** → enable **One-time
   password (OTP)**. The client calls `POST /api/collections/users/request-otp`
   `{email}` → `{otpId}`, then `POST /api/collections/users/auth-with-otp`
   `{otpId, password:<code>}`. OTP authenticates existing members; first-time users
   use "Create account" or LinkedIn.
3. **Verification (optional gate)** — enable "require verified email" on the users
   collection if you want to gate premium actions on `record.verified`. The client
   fires `request-verification` after email/password signup.
4. **Rate limiting** — admin → **Settings → Application** → enable the built-in
   rate limiter (protects `request-otp`, `auth-with-password`, `request-password-reset`
   from brute force / email bombing).

## Directory is authenticated-only

`init_schema.py` sets the `users` `listRule`/`viewRule` to `@request.auth.id != ""`.
Anonymous visitors can still **sign up** (open `createRule`) but cannot list or scrape
member profiles — this also lays the groundwork for premium-gating deeper directory
search. Re-run `init_schema.py` after pulling to apply. The frontend sends its auth
token on the feed author-expand and chat peer-list reads accordingly.

## Enable "Sign in with LinkedIn"

1. Create a LinkedIn developer app (you must do this — it needs your identity).
2. PocketBase admin → **Settings → Auth providers → LinkedIn (OIDC)** → paste the
   Client ID/Secret; set redirect to `https://unicircle.eu/`.
3. The frontend's "Sign in with LinkedIn" button then completes the OAuth2 flow.

Until then, the **LinkedIn data-export upload** path works with no setup.

## Frontend wiring

`js/unicircle.js` talks to this API. Override the base URL for testing with
`?api=http://localhost:8091` (e.g. over an SSH tunnel) — it's remembered in
`localStorage.uc_api_base`.
