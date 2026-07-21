---
tags: [build-log, backend, ingestion, ws-7, healthcare]
date: 2026-07-21
status: complete
---

# 2026-07-21 — WS-7: HRSA + SAMHSA Healthcare Ingestion (national)

## What & why
Added two national ingestion adapters that round out the `healthcare` category with civilian
safety-net care alongside VA facilities. Both are built for **nationwide coverage** so the app works
for **any ZIP** the user enters (ingest everything → the `search_resources` RPC filters by ZIP radius),
not city-scoped demo data. Fourth and fifth live sources after VA, USAJOBS, HUD.
See [[Resource Source Integration Plan]] §Tier 1 #2–3.

## Files
- **New:** `ingestion/sources/hrsaHealthCenters.ts` — HRSA-funded community health centers.
- **New:** `ingestion/sources/samhsaTreatment.ts` — SAMHSA mental-health / substance-use treatment.
- **Changed:** `ingestion/run.ts` — registered source keys **`hrsa-health`** and
  **`samhsa-treatment`** (keyless), added a `PAGE_DEFAULTS` map (SAMHSA pages at 500/page), and
  replaced the old USAJOBS-only page-default special-case with it.

## Key findings (verified against the live APIs)
**HRSA**
- **Keyless.** The data.hrsa.gov JSON API redirects to an error page; the reliable source is the
  public **national CSV** (`.../Health_Center_Service_Delivery_and_LookAlike_Sites.csv`).
- The server **406s on `Accept: text/csv`** — must send `Accept: */*`.
- 56 columns; site name/address/phone/web + `Site Status Description` + X/Y geocode columns. Parsed
  with a proper RFC-4180 reader (names/addresses contain commas). Kept only `Active` + valid geocode.
- **Result: 18,892 active health centers nationwide.**

**SAMHSA**
- **Keyless.** `exportsAsJson/v2` with **no geo limit** returns the whole national dataset
  (`recordCount` ~45,605, `totalPages` 92 at pageSize 500). The distance filter is buggy — irrelevant,
  the app filters by ZIP.
- **Dedup risk found & handled:** the national export is *mostly* `typeFacility:"HRSA"` (the same
  health centers HRSA already provides). Adapter keeps only genuine treatment types **SA / MH / OTP**
  and drops HRSA rows, so the two sources don't duplicate.
- Export returns empty `services[]` per row → description derived from `typeFacility`. No stable
  provider id → deterministic key synthesized from name+address (idempotent upserts).

## Verification (dry-run, zero writes)
- HRSA: `--source hrsa-health --dry-run` → **18,892 normalized**, samples in RI/MA/IN (national, not LA),
  coords + normalized websites correct.
- SAMHSA: `--source samhsa-treatment --max-pages 1 --dry-run` → 500 fetched → **7 treatment facilities
  kept** (OTP/SA), ~493 HRSA rows filtered out; samples in PA/CO/KY.
- Typecheck clean for all new/changed files.

## Trust
Both official → `source_type:'official'`, `verification_status:'verified'`, `last_checked` = fetch
date. SAMHSA copy is deliberately non-stigmatizing and hedged; HRSA notes sliding-scale / uninsured.

## Next steps
- **Load live (national):** with `.env.seed` Supabase creds set —
  `... --source hrsa-health` and `... --source samhsa-treatment` (no `--dry-run`). Note SAMHSA is a
  ~92-page sweep; HRSA is one ~14 MB download → ~19k upserts. Batched by `upsert.ts`.
- Next sources: **College Scorecard** (education, reusable DATA.gov key), then CareerOneStop.
- Freshness: re-ingest periodically; treatment/site rows change (future automation).

## Related
[[Resource Source Integration Plan]] · [[2026-07-21 WS-7 HUD Housing Counseling Ingestion]] ·
[[Backend to Production Master Plan]]
