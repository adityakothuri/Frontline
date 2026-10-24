# Frontline resource ingestion

Standalone backend tooling that pulls **real** resources from provider APIs and
upserts them into the live `resources` table — the same data the app already
reads through the unchanged `ResourceService`. This is **not** part of the app
bundle (it never ships to a device); it runs like `scripts/seed.ts`.

## The hybrid inclusion rule (2026-07-23)

Veteran resources come first, always: veteran rows fill the per-category result
cap before any general row and win distance ties. Categories with no
veteran-specific local dataset are backfilled with high-quality **general**
sources, labeled `veteran_relevance: 'general'` and shown as "Open to everyone"
in the app. Every row MUST carry a `veteran_relevance`
(`veteran_specific` / `veteran_benefit` / `general`) — the DB rejects anything
unlabeled. This supersedes the 2026-07-22 strict veteran-only rule (see
`docs/obsidian/08 Decisions/Decision Log.md`).

## Sources

20 active sources, all registered in the `SOURCES` map in `ingestion/run.ts`. Row counts are
from the 2026-07-28 data audits and drift with each refresh. The `source_provider` stored on each
row (the key the freshness gate and reaper use) can differ from the `--source` flag:
`gi-bill` → `va-gi-bill`, `hud-housing` → `hud-housing-counseling`, `american-job-centers` →
`careeronestop-ajc`.

| `--source` | Provider | Categories | Relevance | Auth | Cadence |
|---|---|---|---|---|---|
| `va-facilities` | VA Lighthouse Facilities API | `healthcare`, `benefits_help`, `community_support` (cemeteries + Vet Centers + social work/caregiver), `housing` (homeless programs), `emergency` (ER/urgent care), `transportation` (travel reimbursement) | veteran_specific | `VA_API_KEY` | monthly |
| `gi-bill` | VA GI Bill Comparison Tool API | `education` | veteran_benefit | keyless | monthly |
| `hud-housing` | HUD housing counseling locator | `housing` | general | keyless | monthly (21-point national sweep); **capped to nearest ~20 in-app** |
| `ssvf-providers` | VA SSVF grantee list (converted XLSX → `ingestion/data/ssvf-providers.json`) | `housing` | veteran_specific | none (local file) | **quarterly, manual** |
| `curated-national` | Hand-verified veteran hotlines (`ingestion/data/curated-national.json`) | thin categories | veteran_specific | none (local file) | **quarterly, manual review** |
| `vso-organizations` | VA OGC accredited-organization export (va.gov/ogc) | `benefits_help` + `legal` | veteran_specific | keyless | monthly — ~1,200 organization × state **referrals** (84 distinct organizations). The export has no street addresses, so these carry **null coordinates** and appear in the app's state-scoped "Statewide & national veteran help" section. They are never pinned |
| `feed-america` | Feed America HSDS 3.0 feed (feedam.org) | `food` | general | keyless | monthly — national; **capped to nearest ~20 in-app** |
| `state-veterans-homes` | NASVH `veterans-homes` wp-json (nasvh.org) | `housing` + `healthcare` | veteran_specific | keyless | monthly — 166 homes, all 50 states; Census-geocoded |
| `samhsa-veteran-bh` | SAMHSA FindTreatment.gov, `sCodes=VET` | `healthcare` + `community_support` | veteran_specific | keyless | monthly — **6,253 facilities reporting a veterans program**; coordinates included, no hours |
| `usaspending-va-grants` | USAspending awards by CFDA (64.024 GPD, 64.033 SSVF, 17.805 HVRP, 17.801 JVSG, 64.056 legal, 64.055 SSG Fox, 64.015/64.014 state homes) | `housing`, `jobs`, `legal`, `healthcare`, `community_support` | veteran_specific | keyless | monthly — 1,346 grantee organizations; recipient addresses, Census-geocoded, no phone |
| `fisher-houses` | Fisher House Foundation `/api/houses/current` | `housing` + `community_support` | veteran_specific | keyless | monthly — 72 US houses; coordinates + manager phone |
| `lsc-legal-aid` | LSC `Programs.json` | `legal` | veteran_benefit | keyless | quarterly — 131 grantees. Service areas only, no addresses → state-scoped referrals |
| `hud-pha` | HUD Public Housing Authorities ArcGIS layer | `housing` | general | keyless | monthly — 3,477 offices that issue HUD-VASH vouchers; `LAT`/`LON` + phone |
| `nacvso-cvso` | NACVSO member directory (sitemap + profile HTML) | `benefits_help` + `legal` | veteran_specific | keyless | quarterly — **673 County Veterans Service Offices, 600 with a phone**, across 30 member states. robots.txt disallows the Novi `/api/` + `/novi-api/` JSON backend (never touched); the profile HTML is permitted and the sitemap is advertised in robots.txt. ~2,900 throttled fetches |
| `osm-clothing` | OpenStreetMap via Overpass | `clothing` | general | keyless | monthly — **6,748 charity/second-hand shops, 2,225 with real opening hours**, incl. ~2,252 Goodwill and ~495 Salvation Army that those sites block. **ODbL: "© OpenStreetMap contributors" is rendered by `resourceStatus.ts` off the `osm` tag** |
| `va-transportation` | VA Veterans Transportation Program representatives page | `transportation` | veteran_specific | keyless | monthly — 163 medical centres, **all 163 with a ride-scheduling phone**. Phones are in `<va-telephone contact="…">` ATTRIBUTES; a text-only scrape finds zero |
| `fta-ntd` | FTA National Transit Database (Socrata `ccvf-fykn` + `uk25-sge7`) | `transportation` | general | keyless | **annual** — 2,867 transit agencies, 1,171 rural §5311, **1,799 with real per-day service hours**. `transit.dot.gov` 403s non-browsers; the Socrata copy is open. No phone field |
| `catholic-charities` | Catholic Charities USA local-agency directory | `community_support` + `clothing` + `food` | general | keyless | quarterly — 165 agencies, 100% with coordinates, 167/168 with a phone |
| `american-job-centers` | CareerOneStop American Job Center workbook (bulk XLSX) | `jobs` | veteran_specific where the centre has a veterans' employment rep, else veteran_benefit | keyless (needs a browser User-Agent) | monthly — **2,169 open centres, 1,536 with a DVOP/LVER veterans' rep**; coordinates + phone included. **Attribution to US DOL ETA + Minnesota DEED is a licence condition** and is carried in every row's `description` |
| `hrsa-health-centers` | HRSA health-centre service-site CSV | `healthcare` | general | keyless | monthly — 17,139 sliding-scale clinics; **capped to nearest 20 in-app**. Mobile vans excluded; the file's "hours per week" is a weekly total, not a schedule, so `hours` is null |

### Retired providers

- `vso-representatives` — retired 2026-07-27 (migration 0024). It held 7,759 individual people
  with no street address, and 2,389 of them had no phone. It was replaced by `vso-organizations`.
- `usajobs` — retired 2026-07-28 (migration 0033). These were expiring postings with no phone
  or street address, superseded by the 2,169 American Job Centers. `refresh.sh jobs` is kept
  as an alias for `places`.
- `irs-veterans-orgs` — retired 2026-07-28 (migration 0033). It had 23,923 chartered
  posts and 0% of them had a phone number.

### General (non-veteran) sources

Seven sources are labeled `general`: `hud-housing`, `hud-pha`, `feed-america`,
`hrsa-health-centers`, `osm-clothing`, `catholic-charities`, and `fta-ntd`. All are badged "Open to everyone" and rank below veteran rows. Dense general categories
(`food`, `housing`, `healthcare`, `clothing`) are **capped to the nearest 20 per search inside
the `search_resources` RPC** (moved server-side in migration 0037). Veteran rows in the same
category are never dropped. The two original backfills show the reasoning:
- `hud-housing` — HUD-VASH is a veteran voucher program and homelessness is a
  signature veteran issue; veteran SSVF providers rank above it.
- `feed-america` — veterans face food insecurity and **no veteran-specific food
  dataset exists**. Runs nationally as of 2026-07-27; the in-app cap keeps it
  from dominating the veteran feed. It previously ran in 8 states only, which
  left 42 states — including all of New York — with zero food resources, so a
  veteran there saw nothing but a national hunger hotline.

  Two properties of this feed shape the adapter. Its **row ids are reassigned on
  every rebuild** (71% of ingested ids had gone stale by 2026-07-27), so rows are
  keyed on normalized name + address instead. And its **taxonomies are not always
  right** — 5,215 SAMHSA behavioural-health facilities arrived tagged as food —
  so clinical rows are excluded on content. Child-nutrition taxonomies
  (`school-meals`, `summer-meals`) are **not** ingested: they are served at
  schools, and they were 44% of the category.

**Legal.** LSC legal aid was dropped on 2026-07-24 and then **reinstated** in the 2026-07-28
audit as `lsc-legal-aid` (veteran_benefit, state-scoped referrals). It sits alongside
`vso-organizations` (American Legion, VFW, DAV, state departments of veterans affairs), NACVSO
County Veterans Service Offices, and USAspending veteran legal-services grantees. The VSO export
carries one phone per organization (its national line), so row copy says exactly that rather
than implying a local number.

### Geocoding (exact pins or none)

Sources whose provider gives street addresses but no coordinates (GI Bill
schools) set `geocode` address parts; the runner resolves them through the
**US Census batch geocoder** (`ingestion/censusGeocode.ts`, keyless), cached in
the `geocode_cache` table so re-runs don't re-submit. Addresses that don't
match keep **null coordinates — listed, never pinned** at an approximate spot.
The ZIP-centroid fallback was removed on 2026-07-24. The last ZIP-centroid
rows (VSO organizations) were purged by migration 0028 and re-ingested as
state-scoped referrals with null coordinates. No source invents a location.

### Trust labels (what the app shows)

- Official APIs (VA, HUD, HRSA, and similar): `source_type: 'official'`,
  `verification_status: 'verified'`, `last_checked` = fetch date. The app
  renders this as "From official VA/gov data · updated <date>" — the label
  claims a fresh pull, not a human visit.
- Hand-maintained lists (`curated-national`, `ssvf-providers`):
  `last_checked` = the file's real human-review date (`verified_on` /
  `retrieved_on`), NOT the run date — an unreviewed entry goes stale on
  schedule (the app warns after 90 days; the freshness gate fails at 120).

### The general-source bar

A general (non-veteran) source earns a place only if veterans disproportionately
need it AND there's a concrete veteran tie-in — "does it really apply," not "is
it available." Housing (HUD-VASH) and food (veteran food insecurity, no veteran
dataset) were the first to clear it. General sources are always labeled
"Open to everyone", ranked below veteran rows, and dense ones are capped in-app.

## What it does

1. **Fetch** a source (paginated) — `ingestion/sources/*.ts`.
2. **Normalize** each record to the `Resource` shape (category mapping,
   coordinate/field sanity, hours → the app's controlled format).
3. **Geocode** (only sources that need it) — Census batch, cache-first.
4. **Validate** (defense-in-depth), then **upsert** idempotently —
   `ingestion/upsert.ts`. Resources merge on a deterministic id
   (`va:<facility_id>`, `gibill:<facility_code>`, …); provenance goes to
   `resource_sources` for lineage. Re-running never duplicates.
5. **Reap** — `ingestion/reap.ts` (run by `refresh.sh` after each source)
   deletes that provider's rows not seen in the run. It refuses to delete more
   than a fifth of a provider's rows, so a partial fetch fails loudly instead of
   emptying a category.

## Scheduled refresh

`.github/workflows/refresh-data.yml` runs `ingestion/refresh.sh places`
**monthly** (1st, 04:00 UTC; 90-minute budget), or on demand via
`workflow_dispatch`. After the run, `ingestion/freshnessGate.ts` fails the
workflow if any provider's newest `last_checked` is older than its limit:
40 days for monthly sources, 120 for quarterly and hand-reviewed lists
(Catholic Charities, NACVSO, LSC, curated referrals, SSVF), and 400 for the
annual FTA NTD release. A failure opens or updates a GitHub issue.

For the cron to actually run: the workflow must be on the **default branch**
(`main`) and these repo secrets must be set: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `VA_API_KEY`, and optionally `DATA_GOV_API_KEY`
(College Scorecard enrichment for GI Bill schools). Verify with a manual
`workflow_dispatch` run.

### Quarterly manual refreshes

- **SSVF**: download the current FY "SSVF Provider Intake List" XLSX from
  <https://department.va.gov/homeless/supportive-services-for-veteran-families/>,
  regenerate `ingestion/data/ssvf-providers.json` (organization/FAIN/states/areas/intake
  phone + email per row, plus `retrieved_on` = download date), re-run
  `--source ssvf-providers`.
- **Curated referrals**: re-check each entry in `ingestion/data/curated-national.json`
  against its official site, bump its `verified_on`, re-run
  `--source curated-national`.

**No longer manual:** VSO representatives used to be a quarterly browser
download into a committed JSON file, with no parser in the repo. As of
2026-07-27 `vso-organizations` fetches the VA OGC **organization** export
directly over HTTP and rolls it up, so it refreshes on the normal monthly
schedule with everything else.

## Radius behavior (2026-07-24)

Every **located** result is strictly within the search radius — the RPC drops
anything beyond it, and rows that have an address but failed geocoding (no
coords) too. Veteran resources with **no pinpoint** location (SSVF providers,
national hotlines — null coords AND null address) are kept and surface in the
app's separate "Statewide & national veteran help" section, state-filtered
(`state:XX` tags + `src/lib/zipState.ts`) so a veteran sees only what serves
their state. Non-veteran / general no-coord rows never appear.

## Prerequisites

- **Node ≥ 22** (uses native TS type-stripping — the repo standard).
- A **free VA API key**: sign up at <https://developer.va.gov>, request the
  **VA Facilities API**. Put it in the git-ignored `.env.seed`:

  ```
  VA_API_KEY=your-key
  ```

  **Use the sandbox host (the default) — it is the correct, complete source.**
  VA facility locations are public, so the sandbox mirrors real production data:
  verified 2026-07-24 it returns the full national set (health 1,399, benefits
  444, vet_center 417), matching the live table. The free key is sandbox-scoped
  (`api.va.gov` returns 401). Only set `VA_FACILITIES_BASE_URL=https://api.va.gov/services/va_facilities/v1`
  if you have separately provisioned a **production** VA key — otherwise ingestion
  will break.

- Optional: a free `DATA_GOV_API_KEY` (<https://api.data.gov/signup/>) for the
  GI Bill College Scorecard enrichment (websites and coordinates). Without it the
  adapter still runs.
- Every other source is keyless.

- For a **live write** (not `--dry-run`), `.env.seed` also needs the real
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Settings → API →
  reveal).

## Usage

```bash
# Dry run — fetch + normalize + validate, print a sample, write NOTHING.
node --experimental-strip-types ingestion/run.ts \
  --source va-facilities --state CA --dry-run

# Everything on its normal cadence (what CI runs):
bash ingestion/refresh.sh places   # all 20 sources, each reaped after its run, then the HUD sweep
                                   # (`all` and the legacy `jobs` are aliases)

# Freshness gate on its own:
node --experimental-strip-types ingestion/freshnessGate.ts

# Individual sources:
node --experimental-strip-types ingestion/run.ts --source gi-bill
node --experimental-strip-types ingestion/run.ts --source hud-housing --lat 40.7 --long -74.0 --radius 500
node --experimental-strip-types ingestion/run.ts --source ssvf-providers
node --experimental-strip-types ingestion/run.ts --source feed-america                     # national
node --experimental-strip-types ingestion/run.ts --source feed-america --state "TX,FL,CA"  # narrow, for spot-checks
```

Feed America is CC BY-SA 4.0 — attribution "Data from Feed America, feedam.org,
EIN 92-1761881" is carried in each row's `source_url`.

### Flags

| Flag | Meaning | Default |
|------|---------|---------|
| `--source` | one of the sources table above | `va-facilities` |
| `--national` | VA: pull the whole dataset (no geo filter) | off |
| `--type` | VA: comma-separated types for `--national` (`health,benefits,vet_center`) | all three |
| `--lat` / `--long` | search center (both together) | — |
| `--radius` | miles from the center / location | provider default |
| `--state` | VA: two-letter state filter | — |
| `--per-page` | page size | per-source default |
| `--max-pages` | page cap (volume bound) | per-source default |
| `--dry-run` | fetch + normalize only, no writes (skips geocoding) | off |

## Adding a source

Create `ingestion/sources/<name>.ts` exporting a `SourceFactory` (see
`ingestion/types.ts`), map the provider's records to `NormalizedResource` —
**including a `veteran_relevance`** — and register it in the `SOURCES` map in
`ingestion/run.ts`. Non-official sources must set `source_type` to
`directory`/`nonprofit` and `verification_status: 'needs_review'`. If the
provider has addresses but no coordinates, set `geocode` parts and never
approximate. Add the provider to `ingestion/freshnessGate.ts` with its cadence, and add a
`$RUN --source …` + `reap …` pair to `ingestion/refresh.sh`. Shared helpers
(field normalization, CSV, XLSX, opening hours, display names, stable keys,
HTTP backoff) live in `ingestion/lib/`.

## Layout

```text
ingestion/
├── run.ts              # CLI runner + the SOURCES registry
├── refresh.sh          # scheduled sweep: run + reap each source
├── upsert.ts           # validate + idempotent upsert with provenance
├── reap.ts             # remove rows a provider stopped serving (1/5 floor)
├── freshnessGate.ts    # fail CI when a provider is past its cadence
├── censusGeocode.ts    # Census batch geocoder, cached in geocode_cache
├── zipCentroid.ts      # ZIP → centroid lookup (no adapter uses it any more)
├── types.ts            # NormalizedResource, SourceFactory, …
├── sources/            # one adapter per provider (+ tests)
├── lib/                # normalize (shared field helpers), csv, xlsx, openingHours,
│                       #   displayName, stableKey, http, env
└── data/               # hand-maintained inputs: curated-national.json, ssvf-providers.json
```
