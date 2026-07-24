---
tags: [technical, data-model, source-of-truth]
status: active
updated: 2026-07-07
---

# Resource / Benefit Data Model

The canonical shape of a resource in Frontline. This drives the mock service, the cards, the map,
the detail page, and the trust surfacing. Built in [[Phase 2 Resource Data Model and Service]].

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
```

> **Need categories vs resource categories.** The home flow shows 12 **need** categories (Food,
> Clothing, Housing, Healthcare, Disability, Education, Jobs, Legal, Transportation,
> Family/Caregiver, Emergency, General VA benefits). Several map onto `benefits_help` /
> `community_support` resource categories. Keep an explicit need→category mapping in `services/resources`.

## `ResourceService` (interface the mock implements)

```ts
interface ResourceService {
  // by need→category, location/ZIP, radius, modality; returns results with
  // query-derived distanceMiles + isOpenNow (see Decision Log 2026-07-07).
  search(query: ResourceQuery): Promise<ResourceSearchResult[]>;
  getById(id: string): Promise<Resource | null>;
}
```

- MVP: an in-memory implementation over ~8+ realistic **seeded** resources spanning categories,
  with believable names, addresses, hours, and phone numbers (no `Resource 1`). Simulated latency ok.
- Later: a real implementation over verified/official sources ([[Phase 10 Backend and Data Ingestion]]).

## Trust fields power the UI

`source_type`, `verification_status`, and `last_checked` render as badges on cards and detail pages;
`unverified` / stale `last_checked` triggers the amber warning treatment. See
[[Trust Safety and Privacy]] and [[UI Design System]].

## Data sourcing (later, not MVP)

Prioritize **verified/official** sources — VA pages/APIs, state veteran affairs, county VSOs, 2-1-1,
National Resource Directory, vetted nonprofits. Scraping is a **secondary** source, never the sole
source of truth. See [[Phase 10 Backend and Data Ingestion]] and [[Non-MVP Ideas]].

## Related

[[AI Feature Design]] · [[Map and Search Design]] · [[Trust Safety and Privacy]] · [[Technical Architecture]] · [[Phase 2 Resource Data Model and Service]]
