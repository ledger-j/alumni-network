#!/usr/bin/env bash
# Deploy the static site from a git ref to unicircle.eu (All-Inkl KAS) and PROVE it is live.
#
#   deploy/site-deploy.sh                    # plan only: what differs between the ref and the public site
#   deploy/site-deploy.sh --apply            # backup, upload changed files, then verify over HTTPS
#   deploy/site-deploy.sh --verify           # verify only: does the public site serve the ref?
#   deploy/site-deploy.sh --ref origin/uc-next --only waitlist-v2.html --only css/v2.css --apply
#
# Rules it enforces:
#   - The ref (default origin/uc-next) is the source of truth, never the working tree.
#   - Plan and verify compare against what https://unicircle.eu actually serves, with CR stripped,
#     so CRLF-only differences are not "changes" and no shell on KAS is needed to plan.
#   - It only adds/overwrites files. It never deletes anything on live.
#   - Before uploading it overwrites ONE backup (never timestamped copies).
#   - Done means: every deployed file, fetched over public HTTPS with a cache-buster,
#     matches the ref, and /deploy-version.txt names the deployed commit. Exit 1 otherwise.
#
# Transport (DEPLOY_TRANSPORT):
#   ftp (default) - FTPS via lftp with the All-Inkl FTP user scoped to unicircle.eu/ (chroot = docroot).
#                   Login comes from ~/.netrc (machine $FTP_HOST login <user> password <...>), chmod 600.
#                   Backup: one mirror of the docroot at $BACKUP_DIR, overwritten each time.
#   ssh           - Jean's laptop only (main KAS account, alias kasserver).
#                   Backup: _backups/unicircle.eu-latest.tgz on KAS, overwritten each time.
# Ignore list: deploy/.deployignore
set -euo pipefail

TRANSPORT="${DEPLOY_TRANSPORT:-ftp}"
SITE_URL="${SITE_URL:-https://unicircle.eu}"
FTP_HOST="${FTP_HOST:-w0150658.kasserver.com}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/unicircle.eu-latest}"
KAS_SSH="${KAS_SSH:-kasserver}"
KAS_ROOT="${KAS_ROOT:-/www/htdocs/w0150658}"
REF="origin/uc-next"
MODE="plan"
ONLY=()

while [ $# -gt 0 ]; do
  case "$1" in
    --ref) REF="$2"; shift 2 ;;
    --only) ONLY+=("$2"); shift 2 ;;
    --apply) MODE="apply"; shift ;;
    --verify) MODE="verify"; shift ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
case "$TRANSPORT" in ftp|ssh) ;; *) echo "DEPLOY_TRANSPORT must be ftp or ssh" >&2; exit 2 ;; esac

cd "$(git rev-parse --show-toplevel)"
git fetch --quiet origin
SHA="$(git rev-parse --short "$REF")"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/src" && git archive "$REF" | tar -x -C "$WORK/src"

# Web files only: no backend, tooling, docs or source images.
git ls-tree -r --name-only "$REF" \
  | grep -E '\.(html|css|js|png|jpe?g|webp|svg|ico|woff2?)$' \
  | grep -v -E '^(backend|tools|deploy|docs|um-crm|HTML_front_end_MVP_new|\.github|\.claude)/' \
  > "$WORK/all"
if [ -f deploy/.deployignore ]; then
  tr -d '\r' < deploy/.deployignore | grep -v -E '^\s*(#|$)' > "$WORK/ignore" || true
  grep -v -x -F -f "$WORK/ignore" "$WORK/all" > "$WORK/files" || true
else
  cp "$WORK/all" "$WORK/files"
fi
if [ ${#ONLY[@]} -gt 0 ]; then printf '%s\n' "${ONLY[@]}" > "$WORK/files"; fi

norm() { tr -d '\r' | md5sum | cut -c1-32; }

# Hashes of what the ref says each file should be.
while IFS= read -r f; do
  [ -f "$WORK/src/$f" ] || { echo "not in $REF: $f" >&2; exit 2; }
  echo "$(norm < "$WORK/src/$f") $f"
done < "$WORK/files" > "$WORK/want"

# For each wanted file: "<http code> <served hash> <path>", fetched past every cache.
fetch_live() {
  local code
  while read -r h f; do
    code=$(curl -s -o "$WORK/got" -w '%{http_code}' -H 'Cache-Control: no-cache' "$SITE_URL/${f// /%20}?cb=$SHA$RANDOM") || true
    echo "$code $(norm < "$WORK/got") $h $f"
  done < "$WORK/want"
}

verify_https() {
  local bad=0 n=0 live_sha
  while read -r code got h f; do
    n=$((n+1))
    if [ "$code" != 200 ] || [ "$got" != "$h" ]; then echo "  FAIL $code $f"; bad=$((bad+1)); fi
  done < <(fetch_live)
  live_sha=$(curl -sf -H 'Cache-Control: no-cache' "$SITE_URL/deploy-version.txt?cb=$RANDOM" | sed -n 's/^commit=//p') || true
  echo "verify: $((n-bad))/$n files served over HTTPS match $REF; deploy-version.txt commit=${live_sha:-none}"
  [ "$bad" -eq 0 ] || { echo "VERIFY FAILED"; return 1; }
  if [ "$MODE" = "apply" ] && [ "$live_sha" != "$SHA" ]; then echo "VERIFY FAILED: version marker is not $SHA"; return 1; fi
  echo "VERIFIED: live serves $REF ($SHA)"
}

if [ "$MODE" = "verify" ]; then verify_https; exit $?; fi

: > "$WORK/changed"
while read -r code got h f; do
  if [ "$code" = 404 ]; then echo "  NEW     $f"; echo "$f" >> "$WORK/changed"
  elif [ "$code" != 200 ]; then echo "  HTTP $code on $f: fix that before deploying" >&2; exit 1
  elif [ "$got" != "$h" ]; then echo "  CHANGED $f"; echo "$f" >> "$WORK/changed"; fi
done < <(fetch_live)
echo "plan: $(wc -l < "$WORK/changed") of $(wc -l < "$WORK/want") files differ between $REF ($SHA) and $SITE_URL"

[ "$MODE" = "apply" ] || { echo "(plan only; re-run with --apply to deploy)"; exit 0; }

printf 'commit=%s\nref=%s\ndeployed=%s\n' "$SHA" "$REF" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$WORK/src/deploy-version.txt"
echo "deploy-version.txt" >> "$WORK/changed"

if [ "$TRANSPORT" = ftp ]; then
  command -v lftp >/dev/null || { echo "lftp is not installed" >&2; exit 2; }
  grep -q "machine $FTP_HOST" ~/.netrc 2>/dev/null || { echo "no ~/.netrc entry for $FTP_HOST" >&2; exit 2; }
  LFTP_SET="set ftp:ssl-force true; set ftp:ssl-protect-data true; set ssl:verify-certificate yes; set net:max-retries 2; set net:timeout 20"
  mkdir -p "$BACKUP_DIR"
  lftp -e "$LFTP_SET; mirror --delete --parallel=4 / '$BACKUP_DIR'; bye" "ftp://$FTP_HOST" >/dev/null
  echo "backup: overwrote mirror $BACKUP_DIR ($(find "$BACKUP_DIR" -type f | wc -l) files)"
  {
    echo "$LFTP_SET"
    sed 's|/[^/]*$||;t;d' "$WORK/changed" | sort -u | while IFS= read -r d; do echo "mkdir -p -f \"/$d\""; done
    while IFS= read -r f; do echo "put \"$WORK/src/$f\" -o \"/$f\""; done < "$WORK/changed"
    echo "bye"
  } > "$WORK/lftp.cmds"
  lftp -f "$WORK/lftp.cmds" "ftp://$FTP_HOST"
else
  DOCROOT="$KAS_ROOT/unicircle.eu"
  ssh -n "$KAS_SSH" "cd '$KAS_ROOT' && tar czf _backups/unicircle.eu-latest.tgz unicircle.eu"
  echo "backup: overwrote $KAS_ROOT/_backups/unicircle.eu-latest.tgz"
  (cd "$WORK/src" && tar cf - --mode=644 -T "$WORK/changed") \
    | ssh "$KAS_SSH" "cd '$DOCROOT' && tar xf - --no-same-owner"
fi
echo "uploaded: $(wc -l < "$WORK/changed") files via $TRANSPORT"

# No CDN in front of KAS (plain nginx), so there is no server cache to purge;
# assets carry ?v= and the check below bypasses browser caches with a cache-buster.
verify_https
