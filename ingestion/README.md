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

| `--source` | Provider | Categories | Relevance | Auth | Cadence |
|---|---|---|---|---|---|
| `va-facilities` | VA Lighthouse Facilities API | `healthcare`, `benefits_help`, `community_support` (cemeteries + Vet Centers + social work/caregiver), `housing` (homeless programs), `emergency` (ER/urgent care), `transportation` (travel reimbursement) | veteran_specific | `VA_API_KEY` | monthly |
| `gi-bill` | VA GI Bill Comparison Tool API | `education` | veteran_benefit | keyless | monthly |
| `usajobs` | USAJOBS API | `jobs` | veteran_benefit | `USAJOBS_API_KEY` + `USAJOBS_USER_AGENT` | **weekly** + 21-day purge |
| `hud-housing` | HUD housing counseling locator | `housing` | general | keyless | monthly (21-point national sweep); **capped to nearest ~20 in-app** |
| `ssvf-providers` | VA SSVF grantee list (converted XLSX → `data/ssvf-providers.json`) | `housing` | veteran_specific | none (local file) | **quarterly, manual** |
| `curated-national` | Hand-verified veteran hotlines (`data/curated-national.json`) | thin categories | veteran_specific | none (local file) | **quarterly, manual review** |
| `vso-organizations` | VA OGC accredited-organization export (va.gov/ogc) | `benefits_help` + `legal` | veteran_specific | keyless | monthly — ~7,200 offices; fetched over HTTP, no manual step |
| `feed-america` | Feed America HSDS 3.0 feed (feedam.org) | `food` | general | keyless | monthly — national; **capped to nearest ~20 in-app** |
| `state-veterans-homes` | NASVH `veterans-homes` wp-json (nasvh.org) | `housing` + `healthcare` | veteran_specific | keyless | monthly — 166 homes, all 50 states; Census-geocoded |

**Two general (non-veteran) sources, each kept for a reason.** Both are badged
"Open to everyone", rank below veteran rows, and are **capped to the nearest ~20
per search** in the client (`DENSE_GENERAL_CAPS = { food: 20, housing: 20 }` in
`supabaseResourceService.ts`, which only caps `general` rows — veteran SSVF/curated
rows in the same category are never dropped):
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

**Legal (LSC) was dropped 2026-07-24** — general civil aid; veterans' legal
needs are covered by veteran-specific sources. Its replacement, the VA-accredited
**representative** list, was itself retired on 2026-07-27: 7,759 rows each naming
an individual person with no street address (2,389 with no phone) is a phone book
of strangers, not somewhere to go. `vso-organizations` replaces it with ~7,200
rows naming an organization a veteran recognises — American Legion, VFW, DAV,
their state department of veterans affairs, or their **County Veterans Service
Officer** — and a town near them. Note the export carries one phone per
organization (its national line), so row copy says exactly that rather than
implying a local number.

### Geocoding (exact pins or none)

Sources whose provider gives street addresses but no coordinates (GI Bill
schools) set `geocode` address parts; the runner resolves them through the
**US Census batch geocoder** (`ingestion/censusGeocode.ts`, keyless), cached in
the `geocode_cache` table so re-runs don't re-submit. Addresses that don't
match keep **null coordinates — listed, never pinned** at an approximate spot.
The ZIP-centroid *fallback for street-addressed sources* was removed on
2026-07-24 (VSO organizations, which have only a city/state/ZIP and no street
address, still place at their ZIP centroid on purpose — see below).

### Trust labels (what the app shows)

- Official APIs (VA, HUD, USAJOBS): `source_type: 'official'`,
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
dataset) clear it; general legal aid did not. General sources are always labeled
"Open to everyone", ranked below veteran rows, and dense ones are capped in-app.

## What it does

1. **Fetch** a source (paginated) — `ingestion/sources/*.ts`.
2. **Normalize** each record to the `Resource` shape (category mapping,
   coordinate/field sanity, hours → the app's controlled format).
3. **Geocode** (only sources that need it) — Census batch, cache-first.
4. **Validate** (defense-in-depth), then **upsert** idempotently —
   `ingestion/upsert.ts`. Resources merge on a deterministic id
   (`va:<facility_id>`, `gibill:<facility_code>`, …); raw provider payloads go
   to `resource_sources` for lineage. Re-running never duplicates.

## Scheduled refresh

`.github/workflows/refresh-data.yml` runs `ingestion/refresh.sh`:
**jobs weekly** (Mondays, + purge of postings not seen in 21 days),
**places monthly** (1st). After each run, `ingestion/freshnessGate.ts` fails
the workflow if any source is older than its cadence + slack (jobs 10d,
places 40d, manual lists 120d), and a failure opens/updates a GitHub issue.

For the cron to actually run: the workflow must be on the **default branch**
(`main`) and these repo secrets must be set: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `VA_API_KEY`, `USAJOBS_API_KEY`,
`USAJOBS_USER_AGENT`. Verify with a manual `workflow_dispatch` run.

### Quarterly manual refreshes

- **SSVF**: download the current FY "SSVF Provider Intake List" XLSX from
  <https://department.va.gov/homeless/supportive-services-for-veteran-families/>,
  regenerate `data/ssvf-providers.json` (organization/FAIN/states/areas/intake
  phone + email per row, plus `retrieved_on` = download date), re-run
  `--source ssvf-providers`.
- **Curated referrals**: re-check each entry in `data/curated-national.json`
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

- For **USAJOBS**: a **free, instant** key at <https://developer.usajobs.gov>.
  The `User-Agent` header MUST be the email you registered the key with:

  ```
  USAJOBS_API_KEY=your-key
  USAJOBS_USER_AGENT=you@example.com
  ```

- For a **live write** (not `--dry-run`), `.env.seed` also needs the real
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Settings → API →
  reveal).

## Usage

```bash
# Dry run — fetch + normalize + validate, print a sample, write NOTHING.
node --experimental-strip-types ingestion/run.ts \
  --source va-facilities --state CA --dry-run

# Everything on its normal cadence (what CI runs):
bash ingestion/refresh.sh places   # VA + GI Bill + curated + SSVF + food + HUD sweep
bash ingestion/refresh.sh jobs     # USAJOBS metro sweep + 21-day purge

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
| `--location` | USAJOBS: place name, e.g. `"Dallas, Texas"` | — |
| `--keyword` | USAJOBS: free-text filter | — |
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
approximate. Add the provider to `ingestion/freshnessGate.ts` with its cadence.
