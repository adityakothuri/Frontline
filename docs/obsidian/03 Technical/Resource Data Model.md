---
tags: [technical, data-model, source-of-truth]
status: active
updated: 2026-07-24
---

# Resource / Benefit Data Model

The canonical shape of a resource in Frontline. This drives the cards, the map, the detail page,
and the trust surfacing. Built in [[Phase 2 Resource Data Model and Service]].

> **This is no longer mock data.** As of Phase 10 the app reads **real, live resources** from a
> Supabase `resources` table, populated by the standalone ingestion pipeline (`ingestion/`) from
> official/nonprofit sources and refreshed on a schedule. There is no in-memory/simulated fallback.
> See [[Phase 10 Backend and Data Ingestion]] and `ingestion/README.md`.

## `Resource` (canonical fields)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Stable unique id. |
| `name` | string | Resource name. |
| `category` | `ResourceCategory` | See categories below. |
| `description` | string | Original / source description. |
| `ai_summary` | string \| null | Plain-English AI summary (templated in MVP). |
| `address` | string \| null | Street address (null for online-only). |
| `latitude` | number \| null | For map + distance. |
| `longitude` | number \| null | For map + distance. |
| `phone` | string \| null | Callable number. |
| `website` | string \| null | Resource site. |
| `hours` | string \| null | Human-readable hours (structured later). |
| `eligibility` | string \| null | Who may qualify (hedged language). |
| `documents_needed` | string[] | Drives the "What should I bring?" checklist. |
| `source_url` | string \| null | Link to the original/official source. |
| `source_type` | `SourceType` | `official \| directory \| nonprofit \| community \| unverified`. |
| `veteran_relevance` | `VeteranRelevance` | `veteran_specific \| veteran_benefit \| general` — NOT NULL. Drives veteran-first ranking. |
| `verification_status` | `VerificationStatus` | `verified \| needs_review \| unverified`. |
| `last_checked` | string (ISO date) | When info was last confirmed. |
| `last_updated` | string (ISO date) | When the record last changed. |
| `tags` | string[] | Free-form filters (e.g. `walk-in`, `no-appointment`, `spanish`). |
| `created_at` | string (ISO date) | Record created. |
| `updated_at` | string (ISO date) | Record updated. |

Derived at query time (not stored): **distance** (Haversine from the user's point) and **open-now**
(from `hours`, when parseable).

## Enums

```ts
type ResourceCategory =
  | 'food' | 'clothing' | 'housing' | 'healthcare' | 'benefits_help'
  | 'legal' | 'jobs' | 'education' | 'transportation' | 'emergency' | 'community_support';

type SourceType = 'official' | 'directory' | 'nonprofit' | 'community' | 'unverified';
type VerificationStatus = 'verified' | 'needs_review' | 'unverified';
type VeteranRelevance = 'veteran_specific' | 'veteran_benefit' | 'general';
```

> **Need categories vs resource categories.** The home flow shows 11 **need** categories
> (**Essentials** — food + clothing merged — Housing, Healthcare, Disability, Education, Jobs, Legal,
> Transportation, Family/Caregiver, Emergency, General VA benefits). They don't map 1:1 to the 11
> resource categories: Essentials fans out to `food` + `clothing`, Disability → `benefits_help`, etc.
> The explicit need→resource mapping lives in `src/services/resources/needMapping.ts`.

> **Veteran-first, hybrid inclusion.** `veteran_relevance` is NOT NULL and CHECK-constrained. The
> `search_resources` RPC fills each category's result cap with veteran rows first (general rows sort
> last); the UI badges every row "For veterans" vs "Open to everyone". Two datasets are intentionally
> `general` for volume where no veteran-specific dataset exists — Feeding America food and HUD housing
> counseling — and both are capped to the nearest ~20 client-side (`DENSE_GENERAL_CAPS`). See the
> [[2026-07-24 Data cycle final audit and hybrid rebuild]] decision.

## `ResourceService` (implemented by `SupabaseResourceService`)

```ts
interface ResourceService {
  // by need→category, location/ZIP, radius, modality; returns results with
  // query-derived distanceMiles + isOpenNow (see Decision Log 2026-07-07).
  search(query: ResourceQuery): Promise<ResourceSearchResult[]>;
  getById(id: string): Promise<Resource | null>;
}
```

- The live implementation is `SupabaseResourceService` (`src/services/resources/`), which calls the
  `search_resources` Postgres RPC for both search and browse. Server-side: ZIP→centroid, radius, and
  distance. Client-side: open-now, the explainable ordering, and the dense-general caps. Failures
  surface to the error/retry UI — never faked data.
- Populated by the ingestion pipeline ([[Phase 10 Backend and Data Ingestion]]); see `ingestion/README.md`.

## Trust fields power the UI

`source_type`, `verification_status`, and `last_checked` render as badges on cards and detail pages;
`unverified` / stale `last_checked` triggers the amber warning treatment. See
[[Trust Safety and Privacy]] and [[UI Design System]].

## Data sourcing (live)

Resources come from **verified/official** sources via the ingestion pipeline: VA Facilities
(health, benefits, vet centers), VA GI-Bill schools, USAJOBS, HUD housing counseling, VA SSVF
grantees, VA-accredited VSO representatives, Feeding America food, and a hand-curated national
veteran-referral list. Each source hard-codes its `veteran_relevance` and `source_type`. Freshness
is enforced by `ingestion/freshnessGate.ts` and a GitHub Actions cron (`refresh-data.yml`). See
[[Phase 10 Backend and Data Ingestion]], `ingestion/README.md`, and [[Non-MVP Ideas]].

## Related

[[AI Feature Design]] · [[Map and Search Design]] · [[Trust Safety and Privacy]] · [[Technical Architecture]] · [[Phase 2 Resource Data Model and Service]]
