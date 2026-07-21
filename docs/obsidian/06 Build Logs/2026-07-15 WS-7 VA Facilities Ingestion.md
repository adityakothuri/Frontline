---
tags: [build-log, backend, ingestion, supabase, phase-12, ws-7]
date: 2026-07-15
phase: "Phase 12 — Real data ingestion (WS-7, slice 1: VA Facilities)"
task: VA Lighthouse Facilities ingestion pipeline behind the unchanged ResourceService
status: done
---

# 2026-07-15 — WS-7 slice 1: VA Facilities Ingestion

## Task
Begin real veteran-resource data ingestion (Master Plan §WS-7). Build a standalone
pipeline that pulls the **VA Lighthouse Facilities API** (official, nationwide),
normalizes each facility to the existing `Resource` shape, and upserts it into the live
`resources` table with honest provenance — feeding the app through the **unchanged**
`ResourceService`. Google auth (WS-6) is explicitly skipped; the anonymous device-based
sync stays as the identity model. Status **partial**: the live production load needs a
real VA API key + a real `service_role` key (both owner actions).

## Scope
- **In:** provenance schema (migration 0008), the `ingestion/` runner + VA Facilities
  adapter, verification/dedup/idempotency, sandbox verification, env docs.
- **Out:** other sources (211, findhelp, HUD), scheduled/cron freshness automation,
  cross-provider geo-dedup, any app-source or dependency change, WS-6 auth.

## Changes
| File | Change | New? (approved?) |
|------|--------|------------------|
| `supabase/migrations/0008_provenance.sql` | `resource_sources` lineage table; `external_id`/`source_provider`/`ingested_at` on `resources`; partial dedup unique index; deny-all RLS | new — approved (applied live) |
| `ingestion/types.ts` | source-agnostic contract (`IngestionSource`, `NormalizedResource`, `SourceFactory`) | new — approved |
| `ingestion/sources/vaFacilities.ts` | VA adapter: paginated `apikey` fetch + normalize (category map, coord sanity, VA hours → controlled format, provenance) | new — approved |
| `ingestion/upsert.ts` | service-role idempotent PostgREST upsert of `resources` + `resource_sources` | new — approved |
| `ingestion/run.ts` | CLI orchestrator (fetch → validate → upsert; `--dry-run`, `--state`/`--lat`/`--long`/`--radius`) | new — approved |
| `ingestion/README.md` | how to get a VA key + run/dry-run | new — approved |
| `tsconfig.json` | `allowImportingTsExtensions: true` (Node TS type-stripping needs `.ts` on relative imports) | edited |
| `.env.example` | document `VA_API_KEY` + `VA_FACILITIES_BASE_URL` (server-side only) | edited |

## Quality checks
- typecheck: **pass** (`tsc --noEmit`; `ingestion/**` typechecks under the same config as `scripts/`)
- lint: **pass** (`eslint .`)
- test: n-a (repo has no test runner yet — WS-5)
- manual run — **stubbed end-to-end** (`scratchpad/verify-va.ts`, canned VA JSON:API, no key): all
  assertions passed — category map (health + Vet Center → `healthcare`), VA hours
  `800AM-430PM` Mon–Fri → controlled `Mon-Fri 08:00-16:30` (parseable by `src/lib/hours.ts`),
  `8:00AM-6:00PM`/`24/7` handled, **cemeteries + no-coord sites skipped** (4→2), provenance stamped,
  `source_type: official` / `verification_status: verified`, id namespaced `va:<id>`, `raw` preserved.
- manual run — **live endpoint wiring**: a real call to the VA **sandbox** with a bogus key returned
  **HTTP 401** (surfaced cleanly), proving the endpoint path `/facilities?state=&per_page=&page=`,
  the `apikey` header, and error handling are correct. Control paths (missing key, unknown source)
  print friendly messages and exit non-zero.
- schema: migration applied via `apply_migration`; `get_advisors(security)` → **no lints**.

## Reviews
- ui-reviewer: n/a (no UI change).
- qa-tester: not spawned — QA performed inline (typecheck, lint, assertion-based E2E, live endpoint
  probe, advisor pass). Recommend a `qa-tester` pass if a live production load is run.
- /slop-check: not run this session; code is small, typed, single-purpose (no premature `normalize.ts`
  abstraction for one source — folded into the adapter, per anti-slop).

## Logs updated
- [x] app_walkthrough → [[app_walkthrough]] (Resource Ingestion Pipeline entry)
- [x] decision log → [[Decision Log]] (WS-6 skip; official-source `last_checked` = fetch date)
- [ ] bug log — n/a
- [x] Command Center current/next task

## Risks / follow-ups
- **Two owner actions block the live load:** a real `VA_API_KEY` (developer.va.gov) and the real
  `SUPABASE_SERVICE_ROLE_KEY` in `.env.seed` (still the `REPLACE_…` placeholder — same WS-2.1 gap).
- **VA field drift:** the adapter is verified against a stubbed sample + a live 401; the exact
  attribute names should be reconfirmed against a real sandbox payload on the first keyed `--dry-run`.
- **Hours coverage:** days the parser can't read are omitted (honest "unknown" over a wrong "open now");
  a day that reads as closed-but-actually-open would show closed. Acceptable; revisit if noisy.
- **Volume:** nationwide is large — always pilot-scope with `--state` or `--lat/--long/--radius`
  and `--max-pages` before a broad pull.
- `created_at` is re-stamped on re-ingest (cosmetic; upsert merges all provided columns).

## Next step
- ✅ Done below (2026-07-17). Remaining: layer a second source (211 / findhelp / HUD → `needs_review`)
  + freshness automation; and request VA **production** access (a demo) before public launch to lift
  the sandbox rate limit and confirm nationwide coverage.

---

## Update — 2026-07-17: sandbox key stored + live load (slice 1 DONE)

Owner supplied a VA **sandbox** key and the real `service_role` key. Both are stored in the
git-ignored `.env.seed` (verified untracked; `.gitignore:12`). Slice 1 is now **live** end-to-end.

**Two corrections found by verifying against live sandbox data (before any write):**
1. **Field casing** — the VA Facilities API v1 serializes attributes in **camelCase**
   (`facilityType`, `address1`/`address2`, `operatingStatus`), not the snake_case I'd guessed. The
   adapter's `VaFacility` type + accessors were corrected. (This is exactly why the "verify against a
   live sample" step exists — the earlier stubbed test used the wrong shape and would have written 0 rows.)
2. **Sandbox rate limit** — added throttling: `SourceConfig.throttleMs`/`maxRetries`, a
   sandbox-aware default (1.1s between pages), and **HTTP 429 backoff** honoring `Retry-After`
   (`VA_THROTTLE_MS` env override).

**Live pilot load** (`--lat 34.05 --long -118.24 --radius 50 --per-page 100 --max-pages 3`):
- **41 real VA facilities near LA** upserted — **27 healthcare + 14 benefits_help**, all
  `source_type: official` / `verification_status: verified`, with 41 `resource_sources` lineage rows.
- `resources` now **53** (12 curated + 41 VA). Sandbox has 1,398 health / 445 benefits / 417 vet
  center / 318 cemetery nationwide (cemeteries correctly skipped).
- **Idempotent**: an identical re-run kept counts at 53/41/41 (no duplicates).
- **App-visible**: `search_resources(zip=>'90012')` now returns the real "Los Angeles VA Clinic"
  (official, 1.0 mi) interleaved with curated nonprofits — real hours `700AM-400PM` → controlled
  `Mon-Fri 07:00-16:00`. `npm run verify` green throughout.

**Security note:** both keys were pasted into chat; consider rotating the Supabase `service_role`
key post-demo (Dashboard → Settings → API) as hygiene. The VA sandbox key is low-risk (read-only,
public data, rate-limited).

---

## Update — 2026-07-20/21: nationwide VA + USAJOBS (real results by ZIP)

**Problem reported:** with profile ZIP **75034** (Frisco/Dallas TX), the app still showed the LA
curated seed rows — because the pilot VA load was LA-scoped, so there was no real data near the
user's ZIP.

**Fix 1 — nationwide VA.** Added a `--national` mode to the VA adapter (pages every usable facility
type with no geo filter; `IngestionQuery.national`/`types`, `NATIONAL_TYPES`). Loaded the full
sandbox: **2,261 VA facilities nationwide** (1,816 `healthcare` + 445 `benefits_help`). Now **any**
ZIP returns real, distance-ranked results. Verified 75034 → Sam Johnson VA Clinic (Plano, 8.3 mi),
Dallas/Denton/Garland facilities — all `official`/`verified`. **Confirmed on the simulator**
(healthcare list shows the real DFW facilities with the "Official source · checked Jul 20" badge).

**Fix 2 — new source: USAJOBS** (official federal jobs → `jobs`). New `ingestion/sources/usaJobs.ts`
+ registered in `run.ts` (registry refactored to a per-source `resolveConfig` reading each
provider's env; `SourceConfig.userAgent`, `IngestionQuery.locationName`/`keyword`). USAJOBS auth is
two headers (`Authorization-Key` + `User-Agent` = registered email). Verified live shape near Dallas
before coding. Loaded **100 federal jobs near Dallas** (`--location "Dallas, Texas" --radius 50`) —
real openings (Staff Psychologist 18.2 mi, Dietitian, Nursing Assistant…) now interleave with VA
healthcare in the 75034 results. Remote jobs come back at `(0,0)` → mapped to null coords (sort last,
like crisis lines). **Freshness caveat:** postings expire; re-run + purge is future work.

**Totals now:** `resources` = 2,373 (12 curated + 2,261 VA + 100 jobs); `resource_sources` lineage
in step. `npm run verify` green throughout; idempotent re-runs confirmed (no duplicates).

**Keys stored** in `.env.seed` (git-ignored, untracked): `USAJOBS_API_KEY` + `USAJOBS_USER_AGENT`.

**Still sandbox data.** Both VA and USAJOBS run against real-but-sandbox/live-public endpoints;
VA **production** access (a demo) is still the pre-launch step to lift limits + guarantee coverage.

---

## Update — 2026-07-20: browse tabs weren't ZIP-scoped (bug fix)

After the nationwide load, the **Discover** and **Map** tabs still showed nationwide (incl. LA)
results for ZIP 75034, because `listResources` applied **no radius filter** — fine at 12 seed rows,
broken at 2,373. Fixed: `listResources(category?, zip?, radiusMiles?)` now scopes browse to the
profile ZIP + radius (both service impls + Discover/Map callers; crisis lines / null-coord rows
still pass). Verified on device — Discover + Map are now DFW-local; **0 LA rows** near 75034 at any
radius. `npm run verify` green. Full write-up: [[2026-07-20 Browse tabs show nationwide results ignoring ZIP]].

---

## Update — 2026-07-20: card descriptions de-jargoned + job-card polish

Cards showed jargon/filler under the title. **Fixed in the adapters + re-ingested:**
- **VA:** new `describeVaFacility()` — plain-English, type-aware copy instead of raw `classification`.
  "Multi-Specialty CBOC, operated by…" → **"VA outpatient clinic providing medical care and health
  services to enrolled veterans."**; Vet Centers now say **"Vet Center — free, confidential
  counseling and readjustment support…"** (were generic "VA facility"); benefits offices get real
  copy. Also set honest, hedged `eligibility` per type (was null). 0 "CBOC" strings remain; 417 Vet
  Centers fixed.
- **USAJOBS:** salary formatted with separators (**$50,420–$81,198 per year**) and **dup postings
  collapsed** by title+org+location (re-announcements) → 100 → 89 rows. Cleared old job rows first to
  avoid dedupe orphans, then reloaded.
- **Card UI:** the open-now / "Hours unknown" pill is **hidden for `jobs`** (a posting has no
  visiting hours) — in `ResourceCard`, `ResourceDetail`, and `ResourcePreview`. Verified on device:
  clean VA + job cards, no stray pill. `npm run verify` green.

---

## Update — 2026-07-21: AI → Haiku (speed) + full data-quality audit

- **AI on Haiku** for all tasks (summary/plan/script) via secrets — see [[Decision Log]]
  (2026-07-21). Verified a `plan` call at ~10s (was Opus+thinking). Detail-page AI now loads faster.
- **Data-quality audit (all 2,362 rows):** 0 null/short descriptions, 0 empty names, 0 half/absent
  coordinate pairs, 0 null-island, 0 bad categories. The 23 rows outside the CONUS box are all
  **legitimate overseas/territory** facilities (American Samoa, Guam, Saipan, Manila) + a few
  overseas DoD jobs — correct coords, distance-filtered out of US searches.
- **Descriptions confirmed perfect** everywhere: VA de-jargoned, jobs clean + formatted, and the 12
  curated rows are hand-written and correctly categorized.
- **Category placement + map:** distribution correct (1,817 healthcare / 446 benefits / 90 jobs +
  curated singletons); sparse categories degrade gracefully — verified **food near 75034** shows a
  clean "No food resources nearby" empty state + the "Official online sources" fallback (SNAP,
  Feeding America), no LA leftovers.
