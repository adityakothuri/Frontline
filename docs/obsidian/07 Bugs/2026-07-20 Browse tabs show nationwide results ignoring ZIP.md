---
tags: [bug]
date: 2026-07-20
severity: high
status: fixed
area: resources / browse (Discover + Map) / listResources
---

# Bug: Discover & Map show nationwide (e.g. LA) results, ignoring the profile ZIP

## Summary
With profile ZIP **75034** (Frisco TX), the **Discover** and **Map** tabs showed resources from all
over the country — including the LA curated seed rows — instead of resources near the user. The
category **results** page was correctly ZIP-scoped; browse was not.

## Steps to reproduce
1. Set profile ZIP to 75034 (or any non-LA ZIP).
2. Open **Map** → pins span the whole US (LA included); the view isn't centered on the user.
3. Open **Discover** ("All") → the list includes far-away/LA resources.

## Expected
Browse tabs show resources **near the profile ZIP**, like the category search does.

## Actual
Browse returned every resource nationwide, distance-sorted but **unbounded**.

## Root cause
`ResourceService.listResources()` was specified to apply **no radius filter** ("browsing shows
everything") — `supabaseResourceService` called the `search_resources` RPC with `radius_miles`
unset (→ null → no distance filter). That was harmless with the 12-row LA seed, but after WS-7
ingestion the table holds **2,373 rows nationwide** (2,261 VA + 100 jobs + 12 curated), so browse
returned the entire country and the Map plotted all of it. The LA rows were the most visible symptom.

## Fix
Made browse **location-scoped**, mirroring search:
- `ResourceService.listResources(category?, zip?, radiusMiles?)` — added the radius param.
- `supabaseResourceService` passes `radius_miles` to the RPC (the RPC ignores it when the origin is
  unknown, and always lets null-coord resources — crisis lines, remote jobs — through).
- `mockResourceService` mirrors the radius filter (parity spec; origin is its demo seed city).
- **Discover** and **Map** pass `profile.preferredRadiusMiles ?? DEFAULT_RADIUS_MILES` (15).

## Verification
- SQL: browse near 75034 → 37 rows @15 mi / 74 @50 mi, **0 LA rows** either way (farthest 49 mi).
- On device: **Discover** shows Sam Johnson VA Clinic (8.3 mi) + Dallas Mobile Vet Center (16 mi),
  official badges, no LA. **Map** is centered on the DFW metro (Frisco/McKinney/Arlington) with 16
  local pins + "36 phone/online resources not shown on the map" (null-coord rows, correct).
- `npm run verify` green.

## Prevention / follow-ups
- Any "show everything" query is a scaling trap once real data lands — browse must be bounded.
- The 12 curated LA seed rows are now only reachable near LA; they remain labeled demo data. Consider
  retiring them once directory sources fill food/clothing/housing/legal (they're the only rows there).
- `DEFAULT_RADIUS_MILES` (15) may feel tight for Map in sparse areas; revisit if users report empty
  maps. A wider browse-specific default is a one-line change.

## Related
- Build log: [[2026-07-15 WS-7 VA Facilities Ingestion]]
- Master plan: [[Backend to Production Master Plan]] §WS-7
