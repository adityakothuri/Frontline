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
| `va-facilities` | VA Lighthouse Facilities API | `healthcare`, `benefits_help`, Vet Centers also cross-listed → `community_support` | veteran_specific | `VA_API_KEY` | monthly |
| `gi-bill` | VA GI Bill Comparison Tool API | `education` | veteran_benefit | keyless | monthly |
| `usajobs` | USAJOBS API | `jobs` | veteran_benefit | `USAJOBS_API_KEY` + `USAJOBS_USER_AGENT` | **weekly** + 21-day purge |
| `hud-housing` | HUD housing counseling locator | `housing` | general | keyless | monthly (21-point national sweep) |
| `ssvf-providers` | VA SSVF grantee list (converted XLSX → `data/ssvf-providers.json`) | `housing` | veteran_specific | none (local file) | **quarterly, manual** |
| `curated-national` | Hand-verified veteran hotlines (`data/curated-national.json`) | thin categories | veteran_specific | none (local file) | **quarterly, manual review** |
| `feed-america` | Feed America HSDS 3.0 feed (feedam.org) | `food` | general | keyless | monthly — 8 veteran-dense states; **capped to nearest ~20 in-app** |

**Two general (non-veteran) sources, each kept for a reason:**
- `hud-housing` — HUD-VASH is a veteran voucher program and homelessness is a
  signature veteran issue; veteran SSVF providers rank above it.
- `feed-america` — veterans face food insecurity and **no veteran-specific food
  dataset exists**. Kept scoped: 8 states only, badged "Open to everyone", and
  **capped to the nearest ~20 general pantries per search** in the client
  (`DENSE_GENERAL_CAPS` in `supabaseResourceService.ts`), with the veteran food
  referral always shown. So it's useful without dominating the veteran feed.

**Legal (LSC) was dropped 2026-07-24** — general civil aid; veterans' legal
needs are covered by the veteran-specific referrals (Stateside Legal,
VA-accredited). A veteran-specific legal source (VA-accredited representatives)
is the planned replacement (manual export → committed file, like SSVF).

### Geocoding (exact pins or none)

Sources whose provider gives street addresses but no coordinates (GI Bill
schools) set `geocode` address parts; the runner resolves them through the
**US Census batch geocoder** (`ingestion/censusGeocode.ts`, keyless), cached in
the `geocode_cache` table so re-runs don't re-submit. Addresses that don't
match keep **null coordinates — listed, never pinned** at an approximate spot.
ZIP-centroid placement was removed on 2026-07-24.

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

## Prerequisites

- **Node ≥ 22** (uses native TS type-stripping — the repo standard).
- A **free VA API key**: sign up at <https://developer.va.gov>, request the
  **VA Facilities API**. Put it in the git-ignored `.env.seed`:

  ```
  VA_API_KEY=your-key
  # optional — omit to use the sandbox; set for production data:
  VA_FACILITIES_BASE_URL=https://api.va.gov/services/va_facilities/v1
  ```

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
node --experimental-strip-types ingestion/run.ts --source feed-america --state "TX,FL,CA"  # comma list; hard-fails without --state
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
