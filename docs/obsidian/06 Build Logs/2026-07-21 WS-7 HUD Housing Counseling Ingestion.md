---
tags: [build-log, backend, ingestion, ws-7, housing]
date: 2026-07-21
status: complete
---

# 2026-07-21 — WS-7: HUD Housing Counseling Ingestion

## What & why
Added the third live ingestion adapter — **HUD housing counseling agencies** — filling the `housing`
category, the biggest empty gap for veterans (rent, foreclosure, homelessness/HUD-VASH). Third real
source after VA Facilities and USAJOBS. See [[Resource Source Integration Plan]] §Tier 1 #1.

## Files
- **New:** `ingestion/sources/hudCounseling.ts` — `SourceFactory` following the VA/USAJOBS pattern
  (typed provider interfaces → `normalize()` → `NormalizedResource`; timeout + 429 backoff; dedup).
- **Changed:** `ingestion/run.ts` — registered source key **`hud-housing`** (keyless `resolveConfig`,
  `HUD_HCS_BASE` const, optional `HUD_HCS_BASE_URL` override), plus the import.

## Key findings (verified against the live API, not assumed)
- **The API is keyless.** The original plan pointed at `huduser.gov/hudapi` (token-gated) — that's
  Fair Market Rent / CHAS *reference* data. The actual **agency locator** is public at
  `data.hud.gov/Housing_Counselor/searchByLocation?Lat=&Long=&Distance=` (miles). No `HUD_API_TOKEN`.
  Plan doc corrected.
- Only the **geo** endpoint works; `search?State=` and `searchByState` return 500 → HUD is
  location-scoped (like USAJOBS), not nationwide-by-state.
- Real response is a **flat JSON array**; fields are lowercase provider keys. Data hygiene handled:
  `"N/A"` is HUD's null sentinel for `weburl`/`email` (→ null, no fake links); URLs may lack a scheme
  (→ prefixed `https://`); lat/long are strings (→ parsed + range-checked); ZIPs are ZIP+4.
- `services` is coded jargon (`PPC,DFC,RHC`…) → decoded to plain-English themes (buying, renting,
  foreclosure, budgeting, home repair, reverse mortgage, loan scams, homelessness) via a 2-letter
  prefix legend; unknown codes contribute nothing (honest over guessed, matching the VA hours rule).
- `counslg_METHOD` → "in person, by phone and online".

## Verification
`--dry-run` against downtown LA (34.05, -118.24, 15mi): **15 agencies fetched → 15 normalized → 0
rejected**, zero DB writes. Descriptions render plain-English; `"N/A"` website correctly nulled; real
URLs preserved. Typecheck clean for the new + changed files.

Command:
```
node --experimental-strip-types ingestion/run.ts --source hud-housing --lat 34.05 --long -118.24 --radius 25 --dry-run
```

## Trust
Official API → `source_type:'official'`, `verification_status:'verified'`, `last_checked` = fetch
date. Eligibility copy is hedged and points veterans at HUD-VASH.

## Next steps
- **Load live:** re-run without `--dry-run` (needs `.env.seed` `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY`) to populate housing in the real backend, per metro or ZIP.
- Next sources in order: **HRSA + SAMHSA** (round out healthcare), then **College Scorecard**
  (education, reusable DATA.gov key).
- Freshness: like all sources, re-ingest periodically (future automation).

## Related
[[Resource Source Integration Plan]] · [[2026-07-15 WS-7 VA Facilities Ingestion]] ·
[[Backend to Production Master Plan]]
