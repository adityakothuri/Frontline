# Frontline resource ingestion

Standalone backend tooling that pulls **real, verified** resources from provider
APIs and upserts them into the live `resources` table — the same data the app
already reads through the unchanged `ResourceService`. This is **not** part of
the app bundle (it never ships to a device); it runs like `scripts/seed.ts`.

Sources so far:
- **VA Lighthouse Facilities API** — official VA health, benefits, and Vet Center
  locations (→ `healthcare`, `benefits_help`).
- **USAJOBS API** — official federal job openings, veteran-preference relevant
  (→ `jobs`). Postings **expire**, so this is a location-scoped snapshot.

See `docs/obsidian/04 Build Roadmap/Backend to Production Master Plan.md` §WS-7.

## What it does

1. **Fetch** a source (paginated) — `ingestion/sources/*.ts`.
2. **Normalize** each record to the `Resource` shape (category mapping,
   coordinate/field sanity, hours → the app's controlled format).
3. **Validate** (defense-in-depth), then **upsert** idempotently —
   `ingestion/upsert.ts`. Resources merge on a deterministic id
   (`va:<facility_id>`); raw provider payloads go to `resource_sources` for
   lineage. Re-running never duplicates.

**Trust:** VA is an official API, so its rows are `source_type: 'official'`,
`verification_status: 'verified'`, with `last_checked` = the fetch date (for an
official source, the fetch *is* the confirmation). Future non-official sources
must default to `needs_review`.

## Prerequisites

- **Node ≥ 22** (uses native TS type-stripping — the repo standard).
- A **free VA API key**: sign up at <https://developer.va.gov>, request the
  **VA Facilities API**. A sandbox key is instant; a production key is a short
  approval. Put it in the git-ignored `.env.seed`:

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
  reveal). ⚠️ The committed placeholder key must be replaced first.

## Usage

```bash
# Dry run — fetch + normalize + validate, print a sample, write NOTHING.
# Verifies the mapping against live data before any DB change.
node --experimental-strip-types ingestion/run.ts \
  --source va-facilities --state CA --dry-run

# VA — nationwide load (all usable facility types; any ZIP gets real results).
node --experimental-strip-types ingestion/run.ts \
  --source va-facilities --national

# VA — a single metro (alternative to nationwide).
node --experimental-strip-types ingestion/run.ts \
  --source va-facilities --lat 34.05 --long -118.24 --radius 25

# USAJOBS — federal jobs near a place (postings churn, so scope by location).
node --experimental-strip-types ingestion/run.ts \
  --source usajobs --location "Dallas, Texas" --radius 50
```

### Flags

| Flag | Meaning | Default |
|------|---------|---------|
| `--source` | `va-facilities` or `usajobs` | `va-facilities` |
| `--national` | VA: pull the whole dataset (no geo filter) | off |
| `--type` | VA: comma-separated types for `--national` (`health,benefits,vet_center`) | all three |
| `--lat` / `--long` | search center (both together) | — |
| `--radius` | miles from the center / location | provider default |
| `--state` | VA: two-letter state, e.g. `CA` | — |
| `--location` | USAJOBS: place name, e.g. `"Dallas, Texas"` | — |
| `--keyword` | USAJOBS: free-text filter | — |
| `--per-page` | page size | VA `100`, USAJOBS `25` |
| `--max-pages` | page cap (volume bound) | `5` (national `20`, USAJOBS `4`) |
| `--dry-run` | fetch + normalize only, no writes | off |

**Scope required:** VA needs `--national`, or `--lat`+`--long`, or `--state`.
USAJOBS needs `--location` (and usually `--radius`).

> **Freshness note:** USAJOBS postings expire (`ApplicationCloseDate`). Re-run
> periodically; a scheduled re-ingest + purge of closed postings is future work.

## Adding a source

Create `ingestion/sources/<name>.ts` exporting a `SourceFactory` (see
`ingestion/types.ts`), map the provider's records to `NormalizedResource`, and
register it in the `SOURCES` map in `ingestion/run.ts`. Non-official sources
should set `source_type` to `directory`/`nonprofit` and
`verification_status: 'needs_review'`.
