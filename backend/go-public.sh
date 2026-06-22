#!/usr/bin/env bash
# UniCircle — make the PocketBase backend public over HTTPS.
# Run ON the LMS box (ssh LMS) AFTER the DNS A record exists:
#     api.unicircle.eu  A  195.201.26.62
# It adds the Caddy route (idempotent) and brings the shared edge up so Caddy
# auto-provisions a Let's Encrypt certificate for api.unicircle.eu.
set -euo pipefail

CADDYFILE=/opt/caddy/Caddyfile
HOST=api.unicircle.eu

if ! grep -q "$HOST" "$CADDYFILE"; then
  echo ">> appending $HOST route to $CADDYFILE"
  cat >> "$CADDYFILE" <<EOF

# UniCircle API (PocketBase) — added by go-public.sh
$HOST {
	encode zstd gzip
	reverse_proxy unicircle-pb:8090
}
EOF
else
  echo ">> $HOST already present in $CADDYFILE"
fi

echo ">> ensuring unicircle-pb is on the caddy network"
docker network connect caddy unicircle-pb 2>/dev/null || true

echo ">> bringing up the Caddy edge"
cd /opt/caddy && docker compose up -d

echo ">> reloading Caddy config"
docker exec caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || docker restart caddy

echo ">> done. Test in ~30s:  curl -s https://$HOST/api/health"
