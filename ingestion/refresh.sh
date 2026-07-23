#!/usr/bin/env bash
#
# Frontline data refresh — re-ingest the real sources on a schedule so the DB
# stays current and every resource's `last_checked` date stays honest.
#
# Usage:
#   ingestion/refresh.sh all      # everything (default)
#   ingestion/refresh.sh places   # slow-changing places: HRSA, SAMHSA, HUD, VA, colleges
#   ingestion/refresh.sh jobs     # USAJOBS only (postings churn fast) + purge expired
#
# Recommended cadence (see docs/obsidian/04 Build Roadmap/Resource Source
# Integration Plan.md — "Refresh schedule"):
#   jobs    → weekly
#   places  → monthly
#
# Reads keys from the environment, or (for local runs) run.ts loads .env.seed
# itself. For the stale-jobs purge this script also needs SUPABASE_URL and
# SUPABASE_SERVICE_ROLE_KEY in the shell, so it sources .env.seed if present.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-all}"
RUN="node --experimental-strip-types ingestion/run.ts"

# Load .env.seed into the shell (KEY=value) for the purge step, without clobbering
# anything already exported (e.g. CI secrets take precedence).
if [ -f .env.seed ]; then set -a; . ./.env.seed; set +a; fi

log() { printf '\n\033[1m── %s\033[0m\n' "$*"; }

refresh_jobs() {
  # USAJOBS postings are location-scoped and expire, so sweep major metros, then
  # purge anything not refreshed in 21 days (a closed/expired posting).
  local metros=(
    "Washington, DC" "New York, New York" "Los Angeles, California"
    "Chicago, Illinois" "Houston, Texas" "Atlanta, Georgia"
    "Denver, Colorado" "Seattle, Washington" "San Antonio, Texas"
    "Norfolk, Virginia"
  )
  for m in "${metros[@]}"; do
    log "usajobs — $m"
    $RUN --source usajobs --location "$m" --radius 60
  done

  # Purge expired postings (idempotent upsert refreshes last_checked on live ones).
  if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    log "purge expired USAJOBS postings (last_checked < now-21d)"
    local cutoff
    cutoff=$(node -e "console.log(new Date(Date.now()-21*864e5).toISOString().slice(0,10))")
    curl -s -X DELETE \
      "$SUPABASE_URL/rest/v1/resources?source_provider=eq.usajobs&last_checked=lt.$cutoff" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Prefer: return=minimal" >/dev/null && echo "  purged rows older than $cutoff"
  else
    echo "  (skipping purge — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)"
  fi
}

refresh_places() {
  # Veteran-relevant sources only (see docs — strict veteran inclusion rule).
  log "VA facilities (national)";              $RUN --source va-facilities --national
  log "GI Bill schools (national)";            $RUN --source gi-bill
  log "Veteran national referrals";            $RUN --source curated-national
}

case "$MODE" in
  jobs)   refresh_jobs ;;
  places) refresh_places ;;
  all)    refresh_jobs; refresh_places ;;
  *) echo "Unknown mode '$MODE' (use: all | places | jobs)"; exit 1 ;;
esac

log "refresh '$MODE' complete."
