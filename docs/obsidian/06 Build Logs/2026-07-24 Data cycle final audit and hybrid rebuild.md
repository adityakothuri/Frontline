---
tags: [build-log, backend, ingestion, data-sources, trust]
date: 2026-07-24
---

# 2026-07-24 — Data cycle final audit + hybrid rebuild

The final end-to-end check of the data cycle: (1) veteran-centric, (2) abundant
per category, (3) auto-updating, (4) honest pins, (5) honest trust labels.

## Audit found

- **Veteran-centric held** (NOT NULL `veteran_relevance` guardrail) — but at the
  cost of abundance: **7 of 11 categories had 1–4 national hotlines** (food 1,
  legal 2, housing 4 …) after the 2026-07-22 purge.
- **Refresh automation was 0% operational**: `refresh-data.yml` lived only on
  the feature branch (cron fires from `main` only), had never run, and **zero
  repo secrets** were set. USAJOBS purge never fired.
- **GI Bill pins sat on ZIP centroids** (offset from the real building;
  same-ZIP schools stacked) and education rows had no phone/website (verified:
  the GI Bill API simply doesn't provide them).
- **Trust labels overstated**: every row auto-`verified` with
  `last_checked` = pipeline run date, rendered as "Official source · checked
  <date>" — implying human review.

## Decisions (user)

- **Hybrid relevance** — veteran-first, labeled general backfill (see
  [[Decision Log]] 2026-07-24, supersedes strict veteran-only).
- **Census-geocode school pins** — exact coords or no pin, never a centroid.

## What was built

**Schema (migrations, applied live):**
- `0013_veteran_relevance_general.sql` — `'general'` added to the CHECK, still NOT NULL.
- `0014_search_veteran_first_cap.sql` — per-category cap fills veteran rows first.
- `0015_geocode_cache.sql` — Census geocode cache (misses cached too).

**Ingestion:**
- `censusGeocode.ts` (new) — Census batch geocoder, cache-first, 2.5k batches,
  502-backoff; unmatched addresses stay null (listed, never pinned).
- `vaGiBillSchools.ts` — ZIP-centroid placement removed; emits `geocode` parts.
  `ingestion/geocode.ts` (ZIP centroids) deleted.
- `lscLegalAid.ts` + `hudCounseling.ts` — restored from `74d625e^` as
  `veteran_relevance:'general'`; re-registered; HUD 21-point sweep back in
  `refresh.sh`. **Loaded live: LSC 854, HUD 1,315.**
- `ssvfProviders.ts` + `data/ssvf-providers.json` (new) — VA FY26 SSVF grantee
  XLSX converted (235 orgs, 232 with intake phones), `veteran_specific`,
  `category:'housing'`, `last_checked` = `retrieved_on`. **Loaded live: 235.**
- `vaFacilities.ts` — Vet Centers now cross-list into `community_support`
  (`:community` id suffix). *Re-ingest pending: needs `VA_API_KEY` (user).* 
- `feedAmericaFood.ts` (new) — Feed America HSDS 3.0 feed (~310k US food
  sites), `directory`/`needs_review`/`general`, CC BY-SA attribution, bad-page
  tolerance. **Pilot-gated: TX dry-run + spot-check; national ingest needs user
  license sign-off + DB-size check.**
- `curatedNational.ts` — `last_checked` now = each entry's new `verified_on`
  (real human-review date), not the run date. Re-ingested.
- `freshnessGate.ts` (new) — fails CI when any provider ages past cadence +
  slack (jobs 10d / places 40d / manual lists 120d). Passing live.

**Client:**
- `types/resource.ts` — `VeteranRelevance` + `'general'`; stale header fixed.
- `VeteranBadge.tsx` — muted "Open to everyone" badge for general rows.
- `sortResults.ts` — relevance rank between distance and verification;
  `isNationalReferral()` helper.
- `results.tsx` + `discover.tsx` — national veteran hotlines render in a
  "National help lines" strip above local results (they used to sort dead last
  on a null distance); Discover "all" keeps its category interleave.
- `resourceStatus.ts` / `ResourceDetail.tsx` — "From official VA/gov data ·
  updated <date>" and "Data updated <date>" copy (no human-review implication).

**Automation:** `refresh-data.yml` — stale comments fixed, `DATA_GOV_API_KEY`
dropped, freshness-gate step + failure-issue step added, timeout 90m.

## Verification so far

- Freshness gate green across all 7 providers.
- LSC/HUD/SSVF/curated live counts confirmed by SQL.
- Sample geocoded school lands street-level (Fredericksburg, VA test).
- Typecheck + lint clean throughout.

## QA + UI review outcomes (same day)

`qa-tester` found **two real blockers, both fixed and re-verified**:
- **Referral flood / HUD lockout** — under `0014`, 235 null-coord SSVF rows
  consumed the whole veteran-first housing cap from any ZIP (Alaska intake
  lines first, zero local HUD rows). Fixed by `0016_search_referral_cap.sql`:
  null-distance rows get their own cap (3/category, curated hotlines first);
  located rows keep the full veteran-first cap. Verified live: ZIP 75034
  housing = 6 local HUD agencies + 3 curated hotlines.
- **Geocode cache truncation** — `readCache` paged by 5,000 but PostgREST
  caps responses at 1,000, so later runs would silently re-geocode ~11k
  addresses. Fixed: advance by rows returned, stop on empty page.

QA minors fixed: `refresh.sh` now runs `ssvf-providers` in `places` (no
freshness-gate false alarm on a fresh DB); `feed-america` **hard-fails without
`--state`** (pilot gate is code, not a comment); Census CSV fields strip
embedded newlines; `isNationalReferral` also requires a **null address**, so
un-geocoded job postings stay in the normal list instead of the help-lines strip.

`ui-reviewer` (all fixed): "Open to everyone" badge text/icon moved to
`textSecondary` (textMuted was 4.24:1 on surfaceMuted — under AA; token comment
corrected); map view + toggle now gated on located results (referral-only
results can't open a zero-pin map); detail page no longer shows the same
"updated" date twice; official label shortened to "Official VA/gov data ·
updated <date>" (one line on cards) with wrapped-row icon alignment fixed;
"National help lines" / "Near you" labels are `accessibilityRole="header"`.

**Known limitation (roadmap):** SSVF rows are county/state-scoped but carry no
coordinates, so under the referral cap they rarely surface (curated hotlines
win the 3 slots). Making referrals state-aware (match the search origin's
state) is the follow-up that unlocks them.

## Final state (2026-07-24, end of day)

Live DB: **17,834 rows.** education 12,849 (10,559 street-geocoded pins, 2,290
honest nulls; 6 stale centroid stragglers deleted) · healthcare 1,816 ·
housing 1,554 (1,315 HUD general + 235 SSVF + 4 curated) · legal 856 (854 LSC)
· benefits_help 448 · jobs 306 · referral-only: transportation /
community_support / food / emergency / clothing. Freshness gate green on all 7
providers; `npm run verify` green. Feed America TX pilot passed (23,627 real
food-distribution sites after taxonomy filtering; clinics/SNAP/WIC excluded).

## Ship + live app verification (same day)

- **Shipped to `main`:** PR #9 merged; secrets `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` set. CI green.
- **Food scope (user decision):** 8 veteran-dense states (TX,FL,CA,VA,NC,GA,AZ,PA)
  — **116,501 food rows** loaded, DB 198 MB (well under the 500 MB free-tier
  cap). Taxonomy-filtered to real food distribution; `--state` now takes a
  comma list and hard-fails without it. Added to `refresh.sh places` + the
  freshness gate.
- **Ran the actual app** (Expo web, headless Chrome, onboarding → Discover →
  results → detail). Onboarding, home, the National-help-lines strip, the
  "Open to everyone" / "For veterans" badges, honest "Official VA/gov data ·
  updated" labels, and geocoded distances (Caritas of Austin 0.0 mi, BCL of
  Texas 0.2 mi) all render correctly. AI proxy verified healthy via direct call
  (HTTP 200, hedged summary in-schema).

### Publish-blocker found and fixed by running the app
The **"all categories" Discover browse 500'd** (`57014` statement timeout): with
116k food rows, `search_resources` computed haversine for every located row
before filtering by radius. Fix — **migration `0017_search_bbox_prefilter.sql`**:
an indexable lat/lng bounding-box pre-filter (+ `resources_lat_lng_idx`) runs
before the trig, so the query only touches rows near the user. Verified: the
all-browse went **500 → 200 in 0.57 s**, balanced across all 11 categories.

### Web-only (not shipping-native) notes
- AI edge function has no CORS headers → the browser preview can't call it
  (native has no CORS; curl confirms the function works). Add CORS only if a web
  build is ever shipped.
- RN-Web nested-`<button>` hydration warning (Pressable card containing the
  bookmark Pressable) — harmless on native.

## Remaining (user actions — the cron is dead until #1)

1. Merge `feature/phase-10-backend` → `main` + set repo secrets
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VA_API_KEY`,
   `USAJOBS_API_KEY`, `USAJOBS_USER_AGENT`) + one manual `workflow_dispatch`.
2. Re-run `--source va-facilities --national` with the VA key → activates the
   ~300 Vet Center community_support cross-listings.
3. Approve/decline Feed America (CC BY-SA attribution + ~310k-row size) →
   national food ingest, or leave food referral-only.
