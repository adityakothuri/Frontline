#!/usr/bin/env bash
#
# Frontline data refresh — re-ingest every source (monthly, via
# .github/workflows/refresh-data.yml) so the DB stays current and each
# resource's `last_checked` date stays honest.
#
# Usage:
#   ingestion/refresh.sh [all|places]   # both run every source; `jobs` is a legacy alias
#
# Reads keys from the environment, or (for local runs) run.ts loads .env.seed
# itself. The reap step also needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
# the shell, so this sources .env.seed if present.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-all}"
RUN="node --experimental-strip-types ingestion/run.ts"

# Load .env.seed into the shell (KEY=value) for the reap step. Exported CI secrets
# are only overridden if .env.seed exists, which it never does in CI.
if [ -f .env.seed ]; then set -a; . ./.env.seed; set +a; fi

log() { printf '\n\033[1m── %s\033[0m\n' "$*"; }

# Remove rows a provider no longer serves, right after that provider's own run
# (see ingestion/reap.ts — it refuses to delete more than a fifth of a provider's
# rows). Takes the stored `source_provider`, which can differ from `--source`.
# A failed reap is deliberately NOT fatal: under `set -e` it would abort every
# later source, and a skipped reap only leaves stale rows, which is strictly
# better than a skipped refresh.
reap() {
  if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    echo "  (skipping reap — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)"
    return 0
  fi
  node --experimental-strip-types ingestion/reap.ts "$@" || {
    echo "  ⚠️  reap failed for $1 — stale rows kept, continuing the refresh."
    return 0
  }
}

refresh_places() {
  # Each source is reaped immediately after its own run, while we know that run
  # succeeded (a failed run exits non-zero and `set -e` stops before the reap).
  log "VA facilities (national)";              $RUN --source va-facilities --national
  reap va-facilities
  log "GI Bill schools (national)";            $RUN --source gi-bill
  reap va-gi-bill
  log "Veteran national referrals";            $RUN --source curated-national
  log "SSVF providers (from committed JSON)";  $RUN --source ssvf-providers
  reap ssvf-providers
  log "VSO organizations (VA OGC export)";      $RUN --source vso-organizations
  reap vso-organizations
  log "State Veterans Homes (NASVH)";          $RUN --source state-veterans-homes
  reap state-veterans-homes
  log "Fisher Houses";                        $RUN --source fisher-houses
  reap fisher-houses
  log "SAMHSA veteran behavioral health";     $RUN --source samhsa-veteran-bh
  reap samhsa-veteran-bh
  log "VA/DOL grantees (USAspending)";        $RUN --source usaspending-va-grants
  reap usaspending-va-grants
  log "LSC legal aid grantees";               $RUN --source lsc-legal-aid
  reap lsc-legal-aid
  log "American Job Centers (CareerOneStop)";  $RUN --source american-job-centers
  reap careeronestop-ajc
  # NACVSO is ~2,900 polite HTML fetches, by far the slowest source — keep it late.
  log "VA transportation representatives";     $RUN --source va-transportation
  reap va-transportation
  log "Catholic Charities agencies";           $RUN --source catholic-charities
  reap catholic-charities
  log "Charity/thrift shops (OpenStreetMap)";  $RUN --source osm-clothing
  reap osm-clothing
  log "Transit agencies (FTA NTD)";            $RUN --source fta-ntd
  reap fta-ntd
  log "County Veterans Service Officers";      $RUN --source nacvso-cvso
  reap nacvso-cvso
  log "HUD public housing authorities";       $RUN --source hud-pha
  reap hud-pha
  log "HRSA health centers";                  $RUN --source hrsa-health-centers
  reap hrsa-health-centers
  log "Feed America food (national)";          $RUN --source feed-america
  reap feed-america

  # HUD locator caps at ~1,329/query, so sweep regional points (CONUS + HI + AK);
  # the idempotent upsert dedups by agency id. One query reaps nothing on its own,
  # so the reap runs once after the whole sweep, against the date the sweep started
  # (rows stamped later, past midnight UTC, are not < that date and so are kept).
  local hud_run_date
  hud_run_date="$(date -u +%Y-%m-%d)"
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
  reap hud-housing-counseling --run-date="$hud_run_date"
}

# `jobs` (the retired USAJOBS mode, migration 0033) is kept as an alias so an
# existing cron or habit does not fail.
case "$MODE" in
  places|jobs|all) refresh_places ;;
  *) echo "Unknown mode '$MODE' (use: all | places)"; exit 1 ;;
esac

log "refresh '$MODE' complete."
