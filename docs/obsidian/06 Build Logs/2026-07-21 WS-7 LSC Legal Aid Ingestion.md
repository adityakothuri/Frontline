---
tags: [build-log, backend, ingestion, ws-7, legal]
date: 2026-07-21
status: complete
---

# 2026-07-21 — WS-7: LSC Legal Aid Ingestion (first ArcGIS source)

## What & why
Filled the `legal` category with **real, official data** — the Legal Services Corporation's
LSC-funded civil legal-aid offices. Seventh live source. Also the **first ArcGIS-backed adapter**.

## Files
- **New:** `ingestion/sources/lscLegalAid.ts` — source key **`lsc-legal`** (keyless), registered in
  `run.ts`. Added to `ingestion/refresh.sh` (places).

## Source (found by searching the ArcGIS Online catalog)
- `LSC_offices_grantees_main_branch (Public)`, owner `laytonj_LSCGOV` (Legal Services Corporation).
- Public ArcGIS Feature Service, **keyless**:
  `https://services3.arcgis.com/n7h3cEoHTyNCwjCf/arcgis/rest/services/LSC_offices_grantees_main_branch_(Public)/FeatureServer/0`
- New fetch pattern: `/query?where=1=1&outFields=…&resultOffset=&resultRecordCount=1000&f=json`,
  paging on `exceededTransferLimit`; features carry `attributes` (incl. `Latitude`/`Longitude`).
- Fields used: `recipOffID` (id), `orgName`, `officenam`, `officetype` (Main/Branch), `address`,
  `bldgSuite`, `City`, `State`, `ZIP`, `Latitude`, `Longitude`. **No phone/website** in the data →
  honest null (address + directions still work). Branch offices are named `{org} — {office}`.

## Verification
- `--dry-run`: **854 offices** normalized (national — CT, ME, … in the sample), 0 rejected.
- Live load: **854 upserted**. Category `legal` now has 854 real rows (was 0).
- Typecheck clean.

## DB after (real, 0 simulated)
healthcare 38,661 · education 5,715 · housing 1,316 · **legal 854** · benefits 445 · jobs 306 =
**47,297 total**. 6 of 11 categories now covered with real data.

## The remaining empty categories — no good public API
Researched and confirmed **no viable official/keyless locator API** for **food** (only SNAP grocery
stores ~250k; free-food is Feeding America/211, partnership-gated), **transportation** (VA VTS reached
through a VA facility, no directory API), **clothing** (211/findhelp), or **community_support**
(Vet Centers already ingested as healthcare). Per owner's decision these get **hand-verified curated
national resources** (real orgs, not simulated) — a future task.

## Related
[[Resource Source Integration Plan]] · [[2026-07-21 Load all real data and purge simulation]]
