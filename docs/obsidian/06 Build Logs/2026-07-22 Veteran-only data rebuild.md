---
tags: [build-log, backend, ingestion, data, trust, veteran-relevance]
date: 2026-07-22
status: complete
---

# 2026-07-22 — Veteran-only data rebuild

## Why
The ingested data was mostly **general-public, not veteran-specific** (every college incl. a beauty
institute, every community clinic, every legal-aid office). New rule: every resource must be
**veteran-specific** or offer a **concrete veteran benefit**. See [[Decision Log]].

## Foundation (guardrail)
- `0011_veteran_relevance.sql` — add `veteran_relevance` (`veteran_specific` | `veteran_benefit`) with a
  CHECK; `0012_veteran_relevance_not_null.sql` — set NOT NULL after backfill/purge. The DB is
  **veteran-only by construction** — no runtime filter; a future ingest MUST classify a row.
- `src/types/resource.ts` — `VeteranRelevance` type + `veteran_relevance` field. `to_jsonb(r.*)` in the
  search RPC carries it to the client automatically. New `<VeteranBadge>` shows it on each card.

## Sources
- **Kept + classified:** VA facilities (`veteran_specific`, 2,261), USAJOBS (`veteran_benefit`, 306).
- **Replaced education:** dropped College Scorecard (all colleges); new `vaGiBillSchools.ts` ingests
  **only GI-Bill-approved schools** from the keyless VA GI Bill Comparison Tool API (`category=school`;
  per_page hard-capped at 10 → ~1,380 pages, fetched in parallel chunks of 15). No coords in the API →
  ZIP-centroid geocode via new `ingestion/geocode.ts` (reuses the loaded Census ZCTA centroids).
  `veteran_benefit`. Loaded: **12,596 schools**. Final DB: education 12,596 · healthcare 1,816 ·
  benefits_help 448 · jobs 306 · veteran referrals for the rest = **15,179 rows, 0 general**.
- **Dropped as general-public:** HRSA (18,892), SAMHSA (17,953), HUD counseling (1,316), LSC (854),
  College Scorecard (5,715). Adapters deleted; rows purged (chunked deletes — MCP statement timeout).
- **Veteran referrals:** rewrote `data/curated-national.json` to **16 veteran-specific** entries (VA
  homeless line 877-4AID-VET, HUD-VASH/GPD/SSVF, VA-accredited legal + Stateside Legal, VTS/DAV,
  Caregiver line, Vet Centers, Veterans Crisis Line) — every phone/site verified. Null coords → shown
  in the category list, no map pin.

## Corrections from live re-verification (research agents over-claimed)
- **SAMHSA veteran filter is unreliable** — `sCodes=VET` did NOT filter (returned the full 45,601); geo
  queries return services empty for ~90% of rows. Dropped SAMHSA; veteran mental-health/substance care
  is VA Vet Centers (in VA facilities) + VA health + the Crisis Line.
- **GPD/SSVF/CVSO have no national dataset** — the ArcGIS layers found are **single-state** (GPD 2 rows
  Oregon, SSVF 39 polygons Oregon, CVSO 86 Missouri). So veteran housing/legal/benefits gaps are
  **national referrals**, not per-place pins.
- **VA GI Bill**: Socrata bulk is non-tabular and the search list omits IPEDS `cross`, so ingest direct
  from the API + geocode (no scorecard join).

## Verification
- Each adapter `--dry-run` before writing. Final DB (SQL via MCP): `veteran_relevance` has only the two
  values, **0 null**; `source_provider` is only `va-facilities` / `usajobs` / `va-gi-bill` /
  `curated-national`. Typecheck + lint clean.

## Refresh
`ingestion/refresh.sh` places run is now VA facilities + GI Bill + veteran referrals (dropped HRSA/HUD/
SAMHSA/scorecard/LSC sweeps).

## Related
[[Resource Source Integration Plan]] · [[Decision Log]]
