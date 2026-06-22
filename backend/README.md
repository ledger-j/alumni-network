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
