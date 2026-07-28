---
tags: [build-log, data, ingestion, veteran-relevance]
date: 2026-07-27
branch: fix/veteran-data-quality-phase1
---

# 2026-07-27 — Veteran data quality, Phase 1

Trigger: the catalogue "sucks" in practice — several need categories return no local results and
jump straight to state/national helplines, and **schools were showing up under Food**. Frontline
serves older veterans, so a result they cannot call or walk into is not a result.

Diagnosis ran against the **live Supabase project**, not the code alone.

## What the data actually looked like

131,655 rows across 8 providers, and the headline number was vanity:

| Finding | Number |
|---|---|
| Rows with phone + hours + coordinates (actually usable) | **1,986 (1.5%)** |
| One general food feed | 116,500 (88.5%) |
| Food rows that were schools / child nutrition | **51,839 (44% of food)** |
| States with any food data | **8** — 42 states, incl. all of New York, had **zero** |
| Food rows with hours | **0** |
| Geocoded `clothing` + `transportation` + `emergency` rows nationwide | **0** |
| Geocoded veteran-specific *housing* rows | **0** (all 235 SSVF lack coords) |
| `legal` rows that are individual people, not places | 7,759 (100%) |

A 25-mile sweep from five points (NYC, Phoenix, San Antonio, rural KY, rural MT) returned **zero**
clothing, transportation and emergency resources at *every* point, and zero food in NYC.

## Root causes found

1. **Schools were in food by design** — `FOOD_TAXONOMIES` in `feedAmericaFood.ts` explicitly
   included `school-meals` and `summer-meals` (NSLP / USDA SFSP sites, served at schools).
2. **Feed ids are reassigned on every rebuild.** 82,193 of 116,500 ingested ids (71%) already
   pointed past the feed's current maximum; 4,099 rows were exact name+address duplicates left by
   earlier runs. Keying on the feed id means each refresh strands the previous set instead of
   updating it.
3. **Upstream mis-tagging** — 5,215 SAMHSA behavioural-health facilities (opioid treatment programs,
   psychiatric clinics) arrived carrying a food taxonomy and were listed under Food with methadone
   intake text in `eligibility`.
4. **Coverage was a hardcoded 8-state string** in `refresh.sh`.
5. **The "national helpline" strip was never a fallback** — `app/results.tsx` and
   `app/(tabs)/discover.tsx` each carried a verbatim copy of the split logic and both rendered the
   strip *above* the local list unconditionally, despite every code comment describing it as a
   fallback.
6. **No radius widening** — one shot at the veteran's radius, then the empty state.

### Two hypotheses that were wrong, and how

Worth recording because both were plausible and both were tested rather than assumed:

- **"A positional join corrupts records."** The adapter derived the service key by rewriting `loc-N`
  to `svc-N`. Tested against all 311 pages of the feed's `service_at_location` table: the alignment
  **holds everywhere**. It was not the cause. It is still an undocumented coincidence rather than a
  real join, so it was replaced with the proper `service_at_location` lookup — but the corrupted
  rows came from causes 2 and 3 above.
- **"SSVF has street addresses we can geocode."** It does not.
  `ingestion/data/ssvf-providers.json` carries only org, FAIN, states, areas served, phone, email —
  the original code comment was right. Pinning to county centroids would send veterans to empty
  fields, so SSVF correctly stays referral-only.

## Work done

### `ingestion/sources/feedAmericaFood.ts`
- Dropped `school-meals` / `summer-meals` from `FOOD_TAXONOMIES` (−44% of the category).
- Added `stableKey()` — identity derived from normalized name + address + state, replacing the
  feed's volatile row ids, so refreshes update in place and duplicates collapse.
  First written with a 32-bit FNV-1a hash and **corrected before review**: a collision here makes
  the `seen` guard silently drop a real pantry, and across ~310k national rows the birthday bound
  predicts ~10 collisions. Now 80 bits of SHA-1 (~1 in 10^11).
- Added `CLINICAL_TEXT` content exclusion for the mis-tagged behavioural-health rows. They are
  dropped rather than re-filed: sending a veteran to a methadone clinic for groceries is worse than
  showing nothing, and healthcare is served by sources we trust.
- Replaced the positional service guess with a real `service_at_location` join.
- Removed the hard `--state` gate; national is now the default, `--state` narrows for spot-checks.

### `supabase/migrations/0023_purge_feed_america.sql`
Clears the whole `feed-america` provider (resources + lineage). Wholesale rather than targeted
because the id-scheme change makes every existing id obsolete — a filtered delete would leave the
survivors permanently stranded. **Leaves Food empty until the national re-ingest runs**; that
sequencing was explicitly chosen with the user.

### `src/services/resources/sortResults.ts`
New `splitLocalsAndReferrals()` — one shared implementation of the split that both screens had
duplicated, now returning `referralsLead`. Referrals lead only when fewer than 3 local results
exist; otherwise they render *below* the local list under "More help by phone".

### `src/features/resources/ReferralSection.tsx` (new file, approved)
Extracting the logic left both screens with ~25 lines of near-identical referral *markup* — the
same duplication in a different place, and the reason the placement rule drifted from the
2026-07-24 decision in the first place. Now one presentational component; `leads` drives both
placement and heading.

### `app/results.tsx`, `app/(tabs)/discover.tsx`
Both now use the shared split and component; their dead `referralSection` / `nearYouLabel` styles
were removed.

### `src/services/resources/supabaseResourceService.ts`
Radius widening: 25 → 50 → 100 miles while fewer than 3 **located** results come back (referrals are
excluded from the count, or an empty area would look covered). Never searches a smaller ring than
the veteran asked for.

## Checks

`npm run verify` (typecheck + lint) clean. `npm test` **49 passed** — 4 new tests on the split and
its lead/no-lead threshold, 6 on the widening loop.

## QA review — two real defects found and fixed

`qa-tester` returned **does-not-pass** on the first submission. Both high-severity findings were in
code written today, and both are now fixed with regression tests:

1. **Widening fired 4 identical RPC calls for any veteran without a ZIP.** With no origin the RPC
   returns *every* row with a null distance and applies no radius at all (per `0021`), so
   `countLocated()` read 0 forever and all three steps re-fetched the same unfiltered payload. Now
   gated on `hasOrigin()`.
2. **A failed widening query destroyed a good narrow result set.** `results = await runAt(step)` was
   unguarded, so a timeout on the 100-mile query turned two usable local results into an error
   screen. Each step is now wrapped, keeping what was already found.

Also corrected from the review: the hash comment said 80 bits (it's 96); the `state`-in-key comment
described an unreachable case; the non-leading referral heading said "More help by phone" when 3 of
235 SSVF grantees have no phone; and three doc/comment sites still asserted the 8-state gate
(`run.ts`, `freshnessGate.ts`, Command Center).

## Risks / follow-ups

- **Food is empty between the migration and a successful national re-ingest.** Must not reach a
  release in that state. The freshness gate will fail CI and auto-open an issue during that window —
  that is the gate working, not a fault.
- **The purge cascades `resource_votes` and orphans on-device saved ids.** Zero votes exist today so
  nothing is lost now, but a veteran's saved pantry will vanish from the Saved tab, and the dead id
  is re-requested on every mount. Pruning null-resolving saved ids should land before this ships
  widely.
- **The widened radius has no UI signal.** A veteran who set 5 miles can be shown a 97-mile result;
  only the per-card distance says so, while the header still reads "N resources". Worth a
  "nothing closer than X miles" line — deliberately not done here to keep the change scoped.
- **Discover does not widen, Results does.** Same category, two different outcomes. Share or document.
- **Nothing reaps rows that vanish from a feed.** `upsert.ts` only upserts, so any future key drift
  (a renamed pantry, `"St"` → `"Street"`) adds a duplicate rather than replacing. A per-provider
  "delete where `ingested_at < run_date`" sweep is the durable fix — Phase 2.
- The national run downloads 6 full tables concurrently from a feed the adapter itself notes "500s
  under parallel load", holds ~1.8M row objects at once, and upserts ~170k rows inside the workflow's
  90-minute timeout. **Do one real national run locally before the next cron fires.**
- The `~130k resources` claim in docs and store copy needs revisiting once the row count drops.
- `clothing`, `transportation`, `emergency` are **still empty** — no source at all. Phase 2.
- `legal` is still 7,759 individual people; roll-up to organizations is Phase 2.

---

# Phase 2 — veteran-specific sources

Phase 1 cleaned the data; the categories were still empty. Phase 2 fills them, veteran-first.

## What was actually obtainable

I probed every candidate source before building. Most third-party directories **actively block
automation** — Goodwill's locator 403s, DAV's office finder 403s, NACVSO 403s, the Salvation Army
corps directory is gone (404), and the VFW/American Legion post finders are Google-Maps-driven pages
with no clean API. `data.va.gov` turned out to be 2,086 datasets of *statistics*, not directories.

So the volume came from two places that do work.

### 1. The VA Facilities API we already call was throwing data away

No new source, no new dependency — the adapter was discarding most of what the API returns.

- **318 national cemeteries** were mapped to `null` and skipped as "not a help resource". For an
  aging veteran and their survivors, burial and survivor benefits are exactly the thing they need to
  plan. Now `community_support`.
- **Each facility publishes the services it offers**, and the adapter ignored the field entirely.
  Facilities are now cross-listed on it (generalizing the existing `crossListVetCenter` into
  `crossListService`), each with copy describing that service rather than repeating the hospital's:

  | Service | → category | Facilities |
  |---|---|---|
  | Homeless Veteran care | `housing` | 262 |
  | Social work | `community_support` | 482 |
  | CaregiverSupport | `community_support` | 142 |
  | Emergency care | `emergency` | 69 |
  | Urgent care | `emergency` | 38 |
  | Travel reimbursement | `transportation` | 83 |

- **Phone fallback** to `patientAdvocate` / `enrollmentCoordinator` where a clinic publishes no main
  line. An older veteran's first move is to call.

Deliberately **not** mapped: "Nutrition, food, and dietary care" is clinical dietetics, not a food
pantry. Mapping it to `food` would repeat exactly the mistake that put schools there.

Result: **2,678 → 4,160 rows, every one with a phone number.**

### 2. `ingestion/sources/stateVeteransHomes.ts` (new file, approved)

State Veterans Homes are the long-term care system built for veterans — skilled nursing,
domiciliary, adult day care — state-run, VA-certified and part-funded. The most on-mission resource
there is for an aging veteran, and the app had nothing like it.

The VA publishes no machine-readable list. NASVH exposes its `veterans-homes` post type over
`wp-json`, so the adapter reads that rather than scraping rendered pages. Bodies are WPBakery
shortcode soup wrapping a flat `LABEL:` → value sequence, which `parseSections` walks.

**166 homes across all 50 states**, 163 with phones, 0 missing ZIPs, 332 rows (cross-listed into
`healthcare` as well as `housing`). Addresses only, so the runner Census-geocodes them.

The parser fails the run if fewer than 80% of records yield an address, so a NASVH redesign surfaces
as a loud failure instead of silently emptying the table.

### 3. `ingestion/sources/vsoOrganizations.ts` — the biggest win, and the one I nearly got wrong

VA's Office of General Counsel publishes *two* accreditation exports. The repo was using the
**representative** one (7,759 individual people, no street address, 2,389 with no phone — the entire
`legal` category). It also publishes an **organization** export at a stable URL, which maps every
accredited rep to the organization they represent: 18,867 rows, **84 organizations**.

Rolled up by organization × town, that is **7,158 rows** naming something a veteran recognises —
American Legion, VFW, DAV, their state department of veterans affairs — near them. And critically,
**NACVSO's 2,134 representatives are in it**, which is the County Veterans Service Officer data that
NACVSO's own site blocks automated access to. 970 rows now surface as
"County Veterans Service Officer — <town>".

It also fixes provenance: the rep list was a manual browser download into a committed JSON file with
**no parser in the repo**. This export is fetched over HTTP, so it refreshes on the normal schedule.

**The mistake I caught before shipping:** my first version named rows
"American Legion — Phoenix, AZ" and presented the org phone as that office's number. Checking the
data showed there is exactly **one phone per organization** — its national line (all 3,739 American
Legion rows share 202-861-2700) — and **none at all** for CVSOs. That copy would have sent a veteran
in Illinois to a Washington-state number believing it was local. Rows now read
"American Legion — accredited rep in Painesville, OH" and say plainly that the number is the
organization's main line and to ask to be connected locally.

Retired: `vsoRepresentatives.ts`, `data/vso-representatives.json`, `data/repexcellist.asp`, and the
manual quarterly step in the README. Migration `0024_retire_vso_representatives.sql` purges the old
rows (ids differ, so they cannot be updated in place).

## Category impact

Excluding `food` (empty pending the Phase 1 re-ingest):

| Category | Before | After |
|---|---|---|
| `benefits_help` | 448 | **7,604** |
| `emergency` | 1 hotline, 0 local | **108** |
| `transportation` | 2 national, 0 local | **85** |
| `community_support` | 419 | **1,361** |
| `housing` | 1,554 (0 veteran+geocoded) | **2,068** (352 VA + 166 homes geocoded) |
| `healthcare` | 1,816 | **1,982** |
| `legal` | 7,761 individual people | **7,160 organizations** |
| `clothing` | 1 | **1** — unsolved |
| **Total (excl. food)** | **15,154** | **23,521** |

The `legal` number barely moves, which is the point: roughly the same count, but every row is now a
recognisable organization near the veteran instead of a stranger's name.

## Still unsolved

**`clothing` remains empty.** No accessible national dataset exists, veteran-specific or otherwise —
Goodwill's locator 403s, the Salvation Army corps directory is gone. Needs a licensing decision, a
curated per-metro list, or an accepted gap. It should not be papered over.

**`jobs` is still 358 USAJOBS postings**, which are job adverts rather than places — zero have a
phone, and a live search from Austin returns none at 15 or 50 miles. Retiring it for American Job
Centers needs a CareerOneStop API key.

**`education`** is 2,794 GI Bill schools with no phone and no website.

Sources still blocked on **access, not effort**: VFW/American Legion post locators (Google-Maps
pages, no API), GPD housing providers (PDF award lists), Veterans Treatment Courts. The National
Resource Directory (nrd.gov) is explicitly off-limits — its `robots.txt` disallows `/resources`.

## Checks

`npm run verify` clean; `npm test` 49 passed. Both new/changed adapters dry-run verified against the
live APIs (VA: 4,160 rows; NASVH: 166 homes).
