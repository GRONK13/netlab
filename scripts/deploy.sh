#!/usr/bin/env bash
#
# Pull-based deploy for netlab.dcism.org, run by cron every 2 minutes:
#   */2 * * * * $HOME/netlab.dcism.org/scripts/deploy.sh
#
# CI pushes each green commit on main to the `deploy` branch. This script
# notices the new commit, installs/builds it, restarts the app, and rolls back
# to the previous commit if the health check fails.
#
#   scripts/deploy.sh           deploy only if there's a new commit
#   scripts/deploy.sh --force   rebuild and restart the current target anyway
#
# Log: .data/deploy.log

set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${DEPLOY_BRANCH:-deploy}"
APP_NAME="${PM2_APP_NAME:-netlab}"
LOG="$APP_DIR/.data/deploy.log"

cd "$APP_DIR"
mkdir -p .data

# One deploy at a time; a cron run that overlaps a slow deploy just exits.
exec 9>.data/deploy.lock
flock -n 9 || exit 0

# Keep the log small.
if [ -f "$LOG" ] && [ "$(wc -c <"$LOG")" -gt 1000000 ]; then
  tail -n 2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
exec >>"$LOG" 2>&1

log() { echo "$(date '+%F %T') $*"; }

git fetch -q origin "$BRANCH"
current="$(git rev-parse HEAD)"
target="$(git rev-parse "origin/$BRANCH")"
if [ "${1:-}" != "--force" ]; then
  [ "$current" = "$target" ] && exit 0
  # Don't retry a commit that already failed; push a fix or use --force.
  [ "$(cat .data/failed-commit 2>/dev/null)" = "$target" ] && exit 0
fi

PORT="$(grep -E '^PORT=' .env | cut -d= -f2)"

# Functions called from `if` don't stop on errors under `set -e`, so each step checks itself.
build() {
  local from="$1" to="$2"
  git checkout -q -B "$BRANCH" "$to" || return 1
  if [ ! -d node_modules ] || ! git diff --quiet "$from" "$to" -- package-lock.json; then
    log "Installing dependencies"
    npm ci --no-audit --no-fund --loglevel=error || return 1
  fi
  npm run build --silent >/dev/null || return 1
  pm2 restart "$APP_NAME" --update-env >/dev/null || return 1
}

healthy() {
  for _ in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

log "Deploying ${current:0:7} -> ${target:0:7}: $(git log -1 --format=%s "$target")"
if build "$current" "$target" && healthy; then
  rm -f .data/failed-commit
  log "Deployed ${target:0:7}"
  exit 0
fi

echo "$target" >.data/failed-commit
log "Deploy of ${target:0:7} failed, rolling back to ${current:0:7}"
build "$target" "$current" || true
if healthy; then
  log "Rolled back to ${current:0:7}"
else
  log "ROLLBACK FAILED: check 'pm2 logs $APP_NAME'"
fi
exit 1
