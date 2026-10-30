#!/usr/bin/env bash
# Deploy the static site from a git ref to unicircle.eu (All-Inkl KAS) and PROVE it is live.
#
#   deploy/site-deploy.sh                    # plan only: what differs between the ref and live
#   deploy/site-deploy.sh --apply            # backup, upload changed files, then verify over HTTPS
#   deploy/site-deploy.sh --verify           # verify only: does the public site serve the ref?
#   deploy/site-deploy.sh --ref origin/uc-next --only waitlist-v2.html --only css/v2.css --apply
#
# Rules it enforces:
#   - The ref (default origin/uc-next) is the source of truth, never the working tree.
#   - Content is compared with CR stripped, so CRLF-only differences are not "changes".
#   - It only adds/overwrites files. It never deletes anything on live.
#   - Before uploading it overwrites the ONE backup _backups/unicircle.eu-latest.tgz.
#   - Done means: every deployed file, fetched over public HTTPS with a cache-buster,
#     matches the ref, and /deploy-version.txt names the deployed commit. Exit 1 otherwise.
#
# Env: KAS_SSH (ssh alias, default kasserver), KAS_ROOT, SITE_URL. Ignore list: deploy/.deployignore
set -euo pipefail

KAS_SSH="${KAS_SSH:-kasserver}"
KAS_ROOT="${KAS_ROOT:-/www/htdocs/w0150658}"
DOCROOT="$KAS_ROOT/unicircle.eu"
SITE_URL="${SITE_URL:-https://unicircle.eu}"
REF="origin/uc-next"
MODE="plan"
ONLY=()

while [ $# -gt 0 ]; do
  case "$1" in
    --ref) REF="$2"; shift 2 ;;
    --only) ONLY+=("$2"); shift 2 ;;
    --apply) MODE="apply"; shift ;;
    --verify) MODE="verify"; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

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

verify_https() {
  local bad=0 n=0 code got
  while read -r h f; do
    n=$((n+1))
    code=$(curl -s -o "$WORK/got" -w '%{http_code}' -H 'Cache-Control: no-cache' "$SITE_URL/${f// /%20}?cb=$SHA$RANDOM") || true
    got=$(norm < "$WORK/got")
    if [ "$code" != 200 ] || [ "$got" != "$h" ]; then echo "  FAIL $code $f"; bad=$((bad+1)); fi
  done < "$WORK/want"
  live_sha=$(curl -sf -H 'Cache-Control: no-cache' "$SITE_URL/deploy-version.txt?cb=$RANDOM" | sed -n 's/^commit=//p') || true
  echo "verify: $((n-bad))/$n files served over HTTPS match $REF; deploy-version.txt commit=${live_sha:-none}"
  [ "$bad" -eq 0 ] || { echo "VERIFY FAILED"; return 1; }
  if [ "$MODE" = "apply" ] && [ "$live_sha" != "$SHA" ]; then echo "VERIFY FAILED: version marker is not $SHA"; return 1; fi
  echo "VERIFIED: live serves $REF ($SHA)"
}

if [ "$MODE" = "verify" ]; then verify_https; exit $?; fi

# Hashes of what live has, in one ssh pass (stdin closed so it cannot eat our loops).
ssh -n "$KAS_SSH" "cd '$DOCROOT' && find . -type f | sed 's|^\./||' | while IFS= read -r f; do echo \"\$(tr -d '\r' < \"\$f\" | md5sum | cut -c1-32) \$f\"; done" > "$WORK/live"

: > "$WORK/changed"
while read -r h f; do
  l=$(awk -v f="$f" '{x=$1; sub(/^[^ ]+ /,"")} $0==f{print x}' "$WORK/live")
  if [ -z "$l" ]; then echo "  NEW     $f"; echo "$f" >> "$WORK/changed"
  elif [ "$l" != "$h" ]; then echo "  CHANGED $f"; echo "$f" >> "$WORK/changed"; fi
done < "$WORK/want"
echo "plan: $(wc -l < "$WORK/changed") of $(wc -l < "$WORK/want") files differ between $REF ($SHA) and live"

[ "$MODE" = "apply" ] || { echo "(plan only; re-run with --apply to deploy)"; exit 0; }

printf 'commit=%s\nref=%s\ndeployed=%s\n' "$SHA" "$REF" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$WORK/src/deploy-version.txt"
echo "deploy-version.txt" >> "$WORK/changed"

ssh -n "$KAS_SSH" "cd '$KAS_ROOT' && tar czf _backups/unicircle.eu-latest.tgz unicircle.eu"
echo "backup: overwrote $KAS_ROOT/_backups/unicircle.eu-latest.tgz"
(cd "$WORK/src" && tar cf - --mode=644 -T "$WORK/changed") \
  | ssh "$KAS_SSH" "cd '$DOCROOT' && tar xf - --no-same-owner"
echo "uploaded: $(wc -l < "$WORK/changed") files"

# No CDN in front of KAS (plain nginx), so there is no server cache to purge;
# assets carry ?v= and the check below bypasses browser caches with a cache-buster.
verify_https
