---
tags: [roadmap, backend, ingestion, data-sources, ws-7]
status: active
updated: 2026-07-20
---

# Resource Source Integration Plan (WS-7 sources)

> **Goal.** Make Frontline a comprehensive, veteran-first resource lookup by ingesting **real,
> official-first** data across all 11 categories — through the existing `ingestion/` pipeline and
> the unchanged `ResourceService`. This is the per-source implementation plan (how to build each
> adapter and how to get each key). Architecture context: [[Backend to Production Master Plan]] §WS-7.

## How every adapter is built (the pattern, once)

All sources follow the same shape already used by `va-facilities` and `usajobs`:

1. **New file** `ingestion/sources/<name>.ts` exporting a `SourceFactory` (see `ingestion/types.ts`).
2. **Fetch** the provider (paginated, with a timeout + 429 backoff), reading secrets from `SourceConfig`.
3. **Normalize** each record → `NormalizedResource` (the app's `Resource` + provenance). Map to a
   `ResourceCategory`, translate provider jargon into plain-English `description`/`eligibility`,
   set honest coordinates (null when unknown), and controlled `hours` when available.
4. **Trust:** official API → `source_type:'official'` + `verification_status:'verified'`,
   `last_checked` = fetch date. Directory/aggregator → `directory`/`nonprofit` +
   `verification_status:'needs_review'` (surfaces as the amber "check the source" badge).
5. **Register** in `run.ts` `SOURCES` with a `resolveConfig()` that reads its env keys.
6. **Verify against a live sample** (`--dry-run`) before any write — field casing/shape always
   surprises (VA was camelCase). Then load; upsert is idempotent (dedup on `source_provider`+`external_id`).

Keys live only in the git-ignored `.env.seed` (server-side), never in the app bundle.

---

## Category coverage scorecard

| Category | Have now | Best next source(s) |
|---|---|---|
| healthcare | ✅ VA + HRSA + SAMHSA | (well covered) |
| benefits_help | ✅ VA Facilities | + VA Benefits Reference / Forms (enrich) |
| jobs | ✅ USAJOBS | + CareerOneStop (AJC centers), DOL |
| housing | ✅ HUD counseling | HUD-VASH, SAMHSA housing (more breadth) |
| education | ✅ College Scorecard | VA GI Bill enrichment (later) |
| food | ❌ | 211 / Open Referral, USDA/food-bank directories |
| legal | ✅ LSC legal aid | 211 (long tail) |
| clothing | ❌ | 211 / findhelp (directory long-tail) |
| transportation | ❌ | 211, VA Veterans Transportation Service |
| community_support | ⚠️ Vet Centers | National Resource Directory, 211 |
| emergency | ✅ curated 988/911 | (keep curated; SAMHSA disaster) |

---

## TIER 1 — free/instant, official, high-trust (build these next, in order)

### 1. HUD — Housing (housing) ✅ DONE (2026-07-21)
- **Fills:** `housing` — HUD-approved **housing counseling agencies** (physical offices that help with
  renting, buying, foreclosure, budgeting, homelessness/HUD-VASH). Official.
- **Key:** **NONE.** ⚠️ Correction to the original plan: the housing-*counselor* locator at
  `data.hud.gov` is **public and keyless**. The token-gated `huduser.gov/hudapi` API is Fair Market
  Rent / CHAS *reference* data — a different API, not agency places. No `HUD_API_TOKEN` is needed.
- **Endpoint (verified live):** `GET https://data.hud.gov/Housing_Counselor/searchByLocation?Lat=&Long=&Distance=`
  (Distance in miles). Returns a flat JSON array; fields are lowercase provider keys
  (`nme`, `adr1`, `phone1`, `weburl`, `agc_ADDR_LATITUDE/LONGITUDE`, `services`, `counslg_METHOD`,
  `agcid`). The `search?State=` / `searchByState` forms currently 500 — geo search only.
- **Implementation:** `ingestion/sources/hudCounseling.ts`, registered as source key **`hud-housing`**
  in `run.ts` (keyless `resolveConfig`, optional `HUD_HCS_BASE_URL` override). Geo-scoped like
  USAJOBS (needs `--lat/--long`, optional `--radius`, default 25mi). `"N/A"` weburl/email is HUD's
  null sentinel → mapped to null. Service codes decoded to plain-English themes via a 2-letter-prefix
  legend (unknown codes contribute nothing — honest over guessed).
- **Run:** `node --experimental-strip-types ingestion/run.ts --source hud-housing --lat 34.05 --long -118.24 --radius 25 --dry-run`
  (drop `--dry-run` + have `.env.seed` Supabase creds to load live).
- **Notes:** HUD also has **Fair Market Rent / Income Limits** APIs (reference data, not places) —
  optional enrichment later, not resource rows.

### 2. HRSA — Community Health Centers (healthcare) ✅ DONE (2026-07-21)
- **Fills:** `healthcare` — federally-funded **sliding-scale clinics** (care for the uninsured), a
  strong complement to VA-only health. **18,892 active sites nationwide.**
- **Key:** **NONE.** ⚠️ Correction: the data.hrsa.gov JSON API redirects to an error page. The
  reliable source is the public **national CSV download** (no key, no token).
- **Endpoint (verified live):** `GET https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv`
  — send `Accept: */*` (it **406s** on `text/csv`). 56 columns; read Site Name/Address/City/State/Zip,
  phone, web, status, and the X (longitude) / Y (latitude) geocode columns.
- **Implementation:** `ingestion/sources/hrsaHealthCenters.ts`, source key **`hrsa-health`**. Inherently
  national (ignores geo): downloads the file, parses with a proper RFC-4180 CSV reader (names/addresses
  contain commas), keeps only `Active` sites with a valid geocode. `source_type:'official'`.
- **Run:** `node --experimental-strip-types ingestion/run.ts --source hrsa-health --dry-run`.
- **Effort:** done. **Priority:** high.

### 3. SAMHSA — FindTreatment.gov (healthcare) ✅ DONE (2026-07-21)
- **Fills:** `healthcare` — **mental health & substance-use treatment** facilities (high veteran need).
- **Key:** **NONE** — the export endpoint is public/keyless (no access form needed for it).
- **Endpoint (verified live):** `GET https://findtreatment.gov/locator/exportsAsJson/v2?pageSize=500&page=N`.
  Called with **no geo limit** it returns the **entire national dataset** (~45k rows) paginated
  (`rows[]`, `totalPages`). The `limitType`/`limitValue` distance filter is unreliable — not needed,
  since the app does ZIP-radius filtering itself.
- **Implementation:** `ingestion/sources/samhsaTreatment.ts`, source key **`samhsa-treatment`**. Two
  live gotchas handled: (a) the export mixes in `typeFacility:"HRSA"` rows (the same health centers
  HRSA already provides) → **filtered out**, keeping only genuine treatment types **SA / MH / OTP**;
  (b) the export returns empty `services[]` → description derived from `typeFacility`. No stable
  provider id → a deterministic key is synthesized from name+address. Non-stigmatizing copy.
- **Run:** `node --experimental-strip-types ingestion/run.ts --source samhsa-treatment --max-pages 1 --dry-run`
  (drop `--max-pages` for the full national sweep, ~92 pages).
- **Effort:** done. **Priority:** high.

### 4. College Scorecard — Education (education) ✅ DONE (2026-07-21)
- **Fills:** `education` — colleges/universities (GI Bill relevance), with location + basics.
  **~6,243 operating schools nationwide.**
- **Key:** **one free DATA.gov key** at <https://api.data.gov/signup/> unlocks College Scorecard **and
  many other federal APIs**. Instant. Env: `DATA_GOV_API_KEY` (`DEMO_KEY` works for testing).
- **Endpoint (verified live):** `GET https://api.data.gov/ed/collegescorecard/v1/schools?api_key=<key>&per_page=100&page=N&fields=...&school.operating=1`.
  ⚠️ `page` is **0-indexed**; `metadata.total` gives the count; fields use flattened dot-notation
  (`school.name`, `location.lat`, …).
- **Implementation:** `ingestion/sources/collegeScorecard.ts`, source key **`college-scorecard`**.
  National (no geo filter → all operating schools; the app filters by ZIP). Ownership code →
  plain-English "Public / Private nonprofit / Private for-profit" + GI Bill eligibility copy.
- **Run:** `DATA_GOV_API_KEY=DEMO_KEY node --experimental-strip-types ingestion/run.ts --source college-scorecard --max-pages 1 --dry-run`
  (use your own key + drop `--max-pages` for the full ~63-page national load).
- **Effort:** done. **Priority:** medium-high (and the DATA.gov key is reusable).

### 5. VA Benefits Reference + Forms (benefits_help enrichment) — reuses your VA key
- **Fills:** enriches `benefits_help` and the detail page's "what to bring" — **reference data**, not
  new place rows (so it feeds summaries/checklists, not the map).
- **Key:** **the VA developer account you already have** (developer.va.gov) — request these two APIs.
- **Endpoint:** VA Benefits Reference Data API + VA Forms API (`api.va.gov/services/...`).
- **Implementation:** optional; a later enrichment path (not a standard adapter — feeds AI/checklists).
- **Effort:** small–medium. **Priority:** medium (polish, not coverage).

### 6. CareerOneStop — American Job Centers (jobs)
- **Fills:** `jobs` — **physical employment-support centers** (résumé help, training, placement) —
  complements USAJOBS *postings* with *places* veterans can walk into.
- **Key:** free **Web API** account from DOL/CareerOneStop (<https://www.careeronestop.org/Developers>) —
  a short registration (userId + token). Slightly more involved than instant, no demo. Env:
  `CAREERONESTOP_USER_ID`, `CAREERONESTOP_TOKEN`.
- **Endpoint:** CareerOneStop "American Job Center Finder" (by zip/radius).
- **Implementation:** `ingestion/sources/americanJobCenters.ts` → `category:'jobs'`, `source_type:'official'`.
- **Effort:** ~half day. **Priority:** medium.

### 7. LSC — Legal Aid Offices (legal) ✅ DONE (2026-07-21)
- **Fills:** `legal` — the ~130 **LSC-funded civil legal-aid nonprofits** + branch offices (854
  offices). Official (Legal Services Corporation, federal). Eviction, benefits, family, consumer —
  civil, not criminal.
- **Key:** **NONE** — LSC's public ArcGIS Feature Service (found via the ArcGIS Online catalog:
  `LSC_offices_grantees_main_branch (Public)`, owner `laytonj_LSCGOV`).
- **Endpoint (verified live):** `GET {layer}/query?where=1=1&outFields=…&resultOffset=&resultRecordCount=1000&f=json`.
  Our **first ArcGIS-backed adapter** — pages on `exceededTransferLimit`; each feature has
  `attributes` (incl. `Latitude`/`Longitude`) + point geometry.
- **Implementation:** `ingestion/sources/lscLegalAid.ts`, source key **`lsc-legal`**. National.
  No phone/website columns → honest null (address + directions still work). Main vs branch office
  distinguished in the name.
- **Run:** `node --experimental-strip-types ingestion/run.ts --source lsc-legal --dry-run`.

## Categories with NO good public API (→ curated fallback, per owner's call)
Verified there is **no viable official/keyless place-locator API** for these — the real data lives in
211 / Feeding America / findhelp (partnership-gated) or is program-based, not a directory:
- **food** — only USDA **SNAP retailer** data (~250k grocery *stores*; wrong fit for "food help").
  Free-food pantries are Feeding America / 211 (no open API).
- **transportation** — VA VTS / DAV / VetRide are reached **through a VA medical center** (already in
  the DB), not a separate locator API.
- **clothing** — no federal API; 211/findhelp territory.
- **community_support** — Vet Centers are already ingested (as healthcare); the rest is 211/NRD.
These are the categories to fill with **hand-verified curated national resources** (real orgs like a
food-bank locator link, VTS, 211) — not simulated data.

---

## TIER 2 — directory/aggregator (breadth for the long tail; partnership-gated)

These fill the categories no single official API covers well — **food, clothing, legal,
transportation, community**. They are the highest-breadth sources but require a relationship, and
their data is directory-grade → ingest as `verification_status:'needs_review'` (amber badge).

### 7. Open Referral / United Way National 211 (food, clothing, legal, transportation, community)
- **Access:** partnership with United Way / a 211 provider; the open standard is **HSDS/HSDA**
  (`openreferral.org`). Some regional 211s expose an Open211/HSDA API directly.
- **Implementation:** `ingestion/sources/openReferral211.ts` — HSDS is standardized (organizations →
  locations → services), so one adapter can serve many regions. `source_type:'directory'`,
  `needs_review`.
- **Effort:** medium (once access exists). **Priority:** high for coverage; blocked on access.

### 8. findhelp (Aunt Bertha) (same long-tail, dense)
- **Access:** contract/partner (business relationship). Hardest to obtain.
- **Implementation:** `ingestion/sources/findhelp.ts`, `directory` / `needs_review`.
- **Priority:** high value, low attainability without a deal.

### 9. National Resource Directory — nrd.gov (community_support, cross-agency veteran services)
- **Access:** varies/has been intermittent; request access. `directory`.
- **Priority:** medium.

---

## TIER 3 — use with caution (trust risk)

### 10. Food (food) — 211/USDA preferred over third-party aggregators
- A no-key "food resource" API exists (feedam.org) but appears **third-party**, not the official
  Feeding America nonprofit — ingesting it as `official` would break the trust promise. Prefer 211
  (Tier 2) or official **USDA / state food-bank directories**; if used at all, mark `directory` /
  `needs_review` with explicit provenance.

---

## Recommended build order

1. **HUD housing** (biggest empty category, instant key).
2. **HRSA** + **SAMHSA** (round out healthcare — high veteran need).
3. **College Scorecard** (education; the DATA.gov key is reusable elsewhere).
4. **CareerOneStop** (job *centers* to complement USAJOBS postings).
5. **VA Benefits/Forms** enrichment (detail-page polish).
6. Pursue **211 / Open Referral** access → unlock food/clothing/legal/transportation/community.
7. VA + others → **production keys** before public launch (VA needs a stakeholder demo, ~1–3 months).

## Refresh schedule (automated — built 2026-07-21)
Re-ingesting keeps rows current and updates each resource's `last_checked` (trust badge). Cadence is
tuned to how fast each source actually changes:

| Source | Data churn | Frequency | Why |
|---|---|---|---|
| USAJOBS (jobs) | **High** — postings expire in ~2–4 wks | **Weekly** + purge >21d | Stale jobs are worse than none |
| SAMHSA treatment | Moderate | Monthly | New/closed facilities |
| HRSA health centers | Low–moderate | Monthly | Site changes |
| HUD housing counseling | Low | Monthly (in the places run) | Agencies rarely move |
| VA facilities | Low | Monthly | Very stable |
| College Scorecard | Annual data release | Monthly is fine (cheap) | Refresh picks up the yearly update |

**Most viable cadence: `jobs` weekly + `places` monthly.** Facilities are stable, so monthly keeps
`last_checked` honest with near-zero effort; only jobs need weekly attention.

**How it runs:**
- `ingestion/refresh.sh [all|places|jobs]` — orchestrates every source (incl. the HUD regional sweep)
  and purges USAJOBS postings not refreshed in 21 days. Reads keys from env or `.env.seed`.
- `.github/workflows/refresh-data.yml` — GitHub Actions cron (weekly jobs, monthly places; manual
  dispatch too). Needs the 6 repo secrets listed in the workflow. Runs even when your machine is off.
- Local alternative: `crontab` → `0 6 * * 1 … refresh.sh jobs` and `0 4 1 * * … refresh.sh places`.

## Freshness & hygiene (applies to all)
- Keep official-first; never present directory/scraped data as `verified`.
- One `DATA.gov` key is reusable across many `api.data.gov` federal APIs — get it once.
- Only USAJOBS rows are auto-purged (they expire); place rows update in place (a transient API
  hiccup must never delete real clinics).

## Env keys summary (all → `.env.seed`, server-side only)
| Var | Source | How to get |
|---|---|---|
| `VA_API_KEY` ✅ | VA Facilities | developer.va.gov (sandbox instant; prod = demo) |
| `USAJOBS_API_KEY` + `USAJOBS_USER_AGENT` ✅ | USAJOBS | developer.usajobs.gov (instant) |
| `HUD_API_TOKEN` | HUD | huduser.gov → create token (instant) |
| `HRSA_APP_TOKEN` (opt) | HRSA | data.hrsa.gov Socrata token (instant) |
| `SAMHSA_API_KEY` (if req) | SAMHSA | FindTreatment.gov developer guide |
| `DATA_GOV_API_KEY` | College Scorecard (+more) | api.data.gov/signup (instant) |
| `CAREERONESTOP_USER_ID` + `_TOKEN` | CareerOneStop | careeronestop.org/Developers (register) |
| (VA account) | VA Benefits/Forms | reuse developer.va.gov |
| partnership | 211 / findhelp | contact United Way / findhelp |

## Related
[[Backend to Production Master Plan]] · [[2026-07-15 WS-7 VA Facilities Ingestion]] ·
[[Resource Data Model]] · [[File Creation Policy]]
