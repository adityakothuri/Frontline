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

# Remove rows a provider no longer serves, right after that provider's own run —
# `upsert.ts` only ever upserts, so without this a clinic that closed stays in
# the catalogue forever. reap.ts refuses to delete more than a fifth of a
# provider's rows, so a partially-fetched run fails loudly instead of emptying a
# category (see ingestion/reap.ts). Needs the service-role key, sourced above.
# A tripped floor is deliberately NOT fatal to the run. `set -e` would otherwise
# abort the whole `places` sweep, so one provider's churn anomaly would stop the
# other twelve sources from refreshing at all — and the failure mode of a skipped
# reap is "stale rows remain", which is just the status quo we had before reaping
# existed. A failed refresh is strictly worse than a failed reap. It still prints
# loudly, and the freshness gate is unaffected because those rows keep their old
# `last_checked`.
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

  # Purge expired postings. 21 days rather than "not seen in this run": the sweep
  # only covers 10 metros and a single lost page shouldn't retire a live posting.
  # Postings close constantly, so high turnover here is correct — hence the
  # loosened reap floor, which stays at the strict default for every place feed.
  log "reap expired USAJOBS postings (not seen in 21 days)"
  reap usajobs --run-date="$(node -e "console.log(new Date(Date.now()-21*864e5).toISOString().slice(0,10))")" --max-fraction=0.9
}

refresh_places() {
  # Veteran sources, plus the two kept general backfills (HUD housing — real
  # HUD-VASH tie-in — and Feed America food, both capped in-app). General legal
  # aid (LSC) was dropped 2026-07-24 for veteran-specific VA-accredited reps,
  # which in turn became `vso-organizations` on 2026-07-27 — see Decision Log.
  # Each national source is reaped immediately after its own run, while we know
  # that run succeeded. The HUD sweep below is NOT reaped: it's 21 partial
  # regional queries, so "not seen in this run" is meaningless per-query.
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
  # Added by the 2026-07-28 data audit. The first three are the veteran-specific
  # depth the catalogue was missing; HRSA and HUD-PHA are capped general backfill.
  log "SAMHSA veteran behavioral health";     $RUN --source samhsa-veteran-bh
  reap samhsa-veteran-bh
  log "VA/DOL grantees (USAspending)";        $RUN --source usaspending-va-grants
  reap usaspending-va-grants
  log "IRS veterans organizations";           $RUN --source irs-veterans-orgs
  reap irs-veterans-orgs
  log "LSC legal aid grantees";               $RUN --source lsc-legal-aid
  reap lsc-legal-aid
  log "American Job Centers (CareerOneStop)";  $RUN --source american-job-centers
  reap american-job-centers
  # Added by the 2026-07-28 third pass. NACVSO is ~2,900 polite HTML fetches, so it
  # is the slowest source here by far — keep it late in the sweep.
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
  # Food pantries (open to everyone, labeled) — national; the app caps them to
  # the nearest ~20 so they stay scoped.
  log "Feed America food (national)";          $RUN --source feed-america
  reap feed-america

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
