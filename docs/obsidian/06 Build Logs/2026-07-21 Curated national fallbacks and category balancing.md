---
tags: [build-log, backend, ingestion, data, ux]
date: 2026-07-21
status: complete
---

# 2026-07-21 — Curated national fallbacks + category balancing

## Part 1 — Real national resources for the API-less categories
Food, clothing, transportation, and community_support have **no public place-locator API** (verified),
so they're filled with **real, hand-verified national resources** — not simulated.
- **New:** `ingestion/data/curated-national.json` (13 entries) + `ingestion/sources/curatedNational.ts`
  (source key `curated-national`, reads the JSON, no network).
- Entries: USDA National Hunger Hotline (verified 1-866-348-6479), Feeding America locator, 211, SNAP,
  Salvation Army, Goodwill, VA VTS (1-800-698-2411), DAV, VA Caregiver Support Line (1-855-260-3274),
  Vet Centers (1-877-927-8387). Every phone/website checked against the official source.
- Nationwide referrals → **null coordinates**: they surface in every search for their category (the RPC
  passes null-coord rows through) but place **no map pin** (a hotline isn't a place). `source_type` is
  honest per entry (`official` for gov, `nonprofit` for orgs); `verification_status: verified`.
- Loaded live: 13 rows. food/clothing/transportation/community_support are no longer empty.

## Part 2 — Balance categories on the map/browse (0010)
The map browses all categories and pinned **every** row, so healthcare (~38k) drowned everything and
was slow. Fix: **query-time per-category cap** — no data deleted.
- **`0010_search_per_category_limit.sql`** (applied live): `search_resources` gains
  `per_category_limit int`; a `row_number() over (partition by category order by distance)` keeps only
  the **nearest N per category**. Null param = unchanged (every match).
- Client (`supabaseResourceService.ts`): `search()` passes 50, `listResources()` (browse + map) passes
  30. Verified: a 90012 browse returns 30 each for the dense categories (was 100s), plus the curated
  referrals — balanced and fast.

## DB now (real, 0 simulated) — 10 of 11 categories
healthcare 38,661 · education 5,715 · housing 1,316 · legal 854 · benefits 445 · jobs 306 ·
food 4 · transportation 3 · community_support 3 · clothing 3. (emergency = hardcoded crisis banner.)

## Verification
Typecheck + lint clean. Migration applied + tested via SQL. Curated load verified.

## Related
[[Resource Source Integration Plan]] · [[2026-07-21 WS-7 LSC Legal Aid Ingestion]]
