---
tags: [build-log, backend, ingestion, ratings, trust, ws-7]
date: 2026-07-21
status: complete
---

# 2026-07-21 — College Scorecard + Real Ratings (simulated-data purge)

## What & why
Two things: (1) added the **College Scorecard** education adapter (national), and (2) **removed the
last simulated data in the live app** — the fake star rating — and replaced it with a **real,
backend-aggregated thumbs rating** that starts at 0 and grows as veterans vote. Goal: everything the
app shows in backend mode is real.

## Part 1 — College Scorecard (education)
- **New:** `ingestion/sources/collegeScorecard.ts`; registered as **`college-scorecard`** in `run.ts`
  (needs `DATA_GOV_API_KEY`; `DEMO_KEY` for testing), with paging defaults.
- Verified live (DEMO_KEY): 100 schools/page of **~6,243 operating schools**, real addresses/coords,
  ownership → plain English, GI Bill eligibility copy. `page` is 0-indexed (handled).
- Education category now filled. See [[Resource Source Integration Plan]] §Tier 1 #4.

## Part 2 — Real ratings, no simulated data
**Removed:** `src/lib/ratings.ts` (`simulatedRating` — deterministic fake 3.8–4.8 stars). It was shown
on **every** resource detail regardless of backend, so fake data leaked into the real experience.

**Added — backend:** `supabase/migrations/0009_resource_votes.sql`
- `resource_votes(device_id, resource_id, vote up/down)` — one vote per device per resource, keyed to
  the same anonymous device UUID as backup sync (no login/PII). Table is **deny-all** (RLS on, no anon
  policies); FK → `resources(id)` on delete cascade.
- Two `SECURITY DEFINER` RPCs, execute granted to anon: `get_resource_rating(resource_id)` and
  `submit_resource_vote(device_id, resource_id, vote)` (upsert → returns updated counts). The client
  can vote and read totals but never sees who voted or writes rows directly.

**Added — client:** `src/services/ratings/` (mirrors the resources/ai factory pattern)
- `RatingsService` (interface + `RatingAggregate`), `SupabaseRatingsService` (RPCs),
  `LocalRatingsService` (offline stub → honest 0, never simulated), `index.ts` factory keyed on
  `supabaseConfig`.
- **New component** `src/features/resources/ResourceRating.tsx` — "N of M found this helpful" + thumbs;
  reads the live aggregate, submits votes, reflects the veteran's own vote (from ActivityContext).

**Wired:**
- `ResourceDetail.tsx` — removed the fake star chip; now renders `<ResourceRating>` (real count + vote).
- `ReviewPrompt.tsx` — removed the "simulated (demo)" line; thumbs now record locally **and** submit to
  the backend aggregate.
- `types/resource.ts` — corrected the stale "all data is simulated" doc comment.

## Model decision
Thumbs → **"N found this helpful"**, aggregated across all devices via the backend, starting at 0
(chosen over 1–5 stars and over on-device-only). Matches the existing thumbs UI; smallest honest
change. See [[Decision Log]].

## Verification
- Full **typecheck passes** (`tsc --noEmit` exit 0); **lint clean**.
- College Scorecard dry-run verified live (DEMO_KEY).
- Ratings: services + component typecheck; offline path returns 0 (no backend); backend path uses the
  new RPCs. Migration follows the 0005 deny-all + definer-RPC pattern.
- Confirmed **no `simulatedRating` / `lib/ratings` references remain** anywhere.

## Not done / risks
- **Migration not yet applied to the live project** — run `supabase db push` (adds 0009) before the
  ratings feature works against the real backend.
- The **offline mock resource service** (`mockResourceService.ts` / `seedResources.ts`, LA sample) is
  intentionally kept as the no-backend fallback — it only runs when `EXPO_PUBLIC_SUPABASE_*` is unset
  and is never shown in production. If we want to drop offline mode entirely, that's a separate call.
- Ratings have no abuse throttling beyond one-vote-per-device (acceptable for now).

## Next steps
- Apply 0009 (`supabase db push`); load College Scorecard nationally with a real DATA.gov key.
- Optional: allow voting to also show on the resource card; CareerOneStop (job centers) next source.

## Related
[[Resource Source Integration Plan]] · [[2026-07-21 WS-7 HRSA and SAMHSA Healthcare Ingestion]] ·
[[2026-07-21 WS-7 HUD Housing Counseling Ingestion]] · [[Decision Log]]
