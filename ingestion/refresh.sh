#!/usr/bin/env bash
#
# Frontline data refresh — re-ingest the real sources on a schedule so the DB
# stays current and every resource's `last_checked` date stays honest.
#
# Usage:
#   ingestion/refresh.sh all      # everything (default)
#   ingestion/refresh.sh places   # slow-changing places: VA, GI Bill, curated,
#                                  #   SSVF, VSO orgs, Feed America (food), HUD
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
  # Veteran sources, plus the two kept general backfills (HUD housing — real
  # HUD-VASH tie-in — and Feed America food, both capped in-app). General legal
  # aid (LSC) was dropped 2026-07-24 for veteran-specific VA-accredited reps,
  # which in turn became `vso-organizations` on 2026-07-27 — see Decision Log.
  log "VA facilities (national)";              $RUN --source va-facilities --national
  log "GI Bill schools (national)";            $RUN --source gi-bill
  log "Veteran national referrals";            $RUN --source curated-national
  log "SSVF providers (from committed JSON)";  $RUN --source ssvf-providers
  log "VSO organizations (VA OGC export)";      $RUN --source vso-organizations
  log "State Veterans Homes (NASVH)";          $RUN --source state-veterans-homes
  # Food pantries (open to everyone, labeled) — national; the app caps them to
  # the nearest ~20 so they stay scoped.
  log "Feed America food (national)";          $RUN --source feed-america

  # HUD locator caps at ~1,329/query, so sweep regional points (CONUS + HI + AK);
  # the idempotent upsert dedups by agency id.
  local points=(
    "47.6 -122.3 600" "46.6 -112.0 600" "47.9 -97.0 600" "44.9 -93.2 600"
    "44.5 -73.2 600" "40.7 -74.0 500" "39.7 -104.9 600" "38.6 -90.2 600"
    "38.9 -77.0 500" "34.0 -118.2 500" "33.4 -112.1 500" "32.8 -96.8 600"
    "29.8 -95.4 500" "33.7 -84.4 500" "29.95 -90.1 500" "28.5 -81.4 500"
    "25.8 -80.2 400" "41.88 -87.63 500" "21.4 -157.9 500" "61.2 -149.9 900" "64.8 -147.7 600"
  )
  for p in "${points[@]}"; do
    set -- $p
    log "HUD housing — $1,$2 (r=$3)"
    $RUN --source hud-housing --lat "$1" --long "$2" --radius "$3"
  done
}

case "$MODE" in
  jobs)   refresh_jobs ;;
  places) refresh_places ;;
  all)    refresh_jobs; refresh_places ;;
  *) echo "Unknown mode '$MODE' (use: all | places | jobs)"; exit 1 ;;
esac

log "refresh '$MODE' complete."
