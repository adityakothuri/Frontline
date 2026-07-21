---
tags: [build-log, backend, ingestion, data, trust]
date: 2026-07-21
status: complete
---

# 2026-07-21 — Load all real data + purge every trace of simulation

## Goal
Make the live app run on **only real data** — load the remaining national sources into
the production DB and remove all simulated data from the code AND the database.

## Data loaded (live production DB)
| Provider | Rows | Notes |
|---|---|---|
| HRSA health centers | 18,892 | national (loaded earlier) |
| SAMHSA treatment | 17,953 | national sweep this session |
| VA facilities | 2,261 | earlier |
| HUD housing counseling | 1,316 | 21-point national sweep this session (was 33) |
| USAJOBS | 89 | earlier |
| **Total** | **40,511** | **0 simulated rows** |

Category coverage: healthcare 38,661 · housing 1,316 · benefits_help 445 · jobs 89.
**HUD note:** the locator caps at ~1,329 results/query, so HUD is loaded via a 21-point
regional sweep (CONUS grid + HI + AK, 400–900 mi radii) with idempotent dedup by agency id.

## Simulation purged — code
- Deleted `src/services/resources/mockResourceService.ts` and `seedResources.ts`
  (the 12-row LA sample + `SEED_CENTER`).
- Deleted `supabase/seed-data/resources.la.json`; `scripts/seed.ts` now seeds **only** the
  real Census ZIP centroids (no resources).
- `src/services/resources/index.ts`: factory is now `SupabaseResourceService` **always** —
  no mock fallback. Without backend env, resource/rating calls throw (error/retry UI),
  never fake data.
- Fixed stale "mock/simulated" comments in `ResourceService.ts`, `sortResults.ts`,
  `supabaseResourceService.ts`, `supabase/config.ts`, `types/resource.ts`.
- (Earlier this day: `src/lib/ratings.ts` simulated rating already removed.)

## Simulation purged — database
- Deleted the **12 seed rows** (`source_provider is null`, `res-*` ids). Verified 0 remain.

## Comprehensive checkup
Full `grep` of `src/`+`app/` for simulat/mock/fake/dummy/stub/placeholder-data/etc.:
remaining hits are all (a) comments documenting the *absence* of simulation, (b) the iOS
*simulator* (device), or (c) the **templated AI fallback** (`templatedAiService`,
`simulateLatency`) — a graceful per-call degradation for the Claude proxy, not resource
data. **Open decision:** whether to also remove templated-AI fallback (would make AI
hard-fail on any proxy error). Left in place pending a call.

## Bug fixed
NUL byte (U+0000) in HUD data broke whole upsert batches (22P05) — central fix in
`upsert.ts`. See [[2026-07-21 Null byte in provider data breaks upsert (22P05)]].

## Not done / blocked
- **College Scorecard (education) — 0 rows.** Needs a free `DATA_GOV_API_KEY`
  (api.data.gov/signup) not present in `.env.seed`; the public `DEMO_KEY` is rate-limited
  (30/hr) and can't bulk-load ~6.2k schools. Adapter is built + verified — one command
  once the key is added.
- Food / clothing / legal / transportation: still blocked on a 211/Open Referral
  partnership (no public API). Emergency: crisis lines are hardcoded in `CrisisBanner`
  (988/911), intact and independent of the DB.

## Verification
Typecheck + lint clean. DB counts confirmed via SQL. Ratings RPCs unaffected.

## Related
[[Resource Source Integration Plan]] · [[College Scorecard plus Real Ratings and Simulated-Data Purge]]
