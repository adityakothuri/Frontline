---
tags: [build-log, phase-2]
date: 2026-07-07
status: done
---

# 2026-07-07 — Phase 2: Resource Data Model & Service Seams

## What was built

The foundation every Frontline screen depends on — typed domain models and the two swappable
service seams the old codebase never had. **No screens** (that's Phase 3+).

### Types (`src/types/`)
- `resource.ts` — the canonical `Resource` model (all fields from [[Resource Data Model]]) +
  `ResourceCategory` / `SourceType` / `VerificationStatus` unions + `RESOURCE_CATEGORY_META`
  (label/icon/blurb) and ordered `RESOURCE_CATEGORIES`.
- `need.ts` — the `Need` produced by the guided flow: 12 `NeedCategory` values, `Urgency`,
  `Modality`, `HelpType`, `VeteranDocument`, `NeedLocation`, display-label maps, `humanizeDocument`,
  and `DEFAULT_RADIUS_MILES`.
- `index.ts` — barrel.

### Utilities (`src/lib/`)
- `geo.ts` — `distanceMiles` (Haversine) + `formatDistance`.
- `hours.ts` — `isOpenNow` parsing a controlled hours format (`Mon-Fri 09:00-17:00; Sat …`),
  returning `true|false|null` (null = unknown; never a misleading guess).

### Resources service (`src/services/resources/`)
- `ResourceService.ts` — interface (`search`, `getById`) + `ResourceQuery` + `ResourceSearchResult`
  (resource + derived `distanceMiles` + `isOpenNow`).
- `seedResources.ts` — **12 simulated** LA-area veteran resources across all categories; honest
  `source_type`/`verification_status` (one intentionally stale to exercise the outdated-warning);
  includes the real, safe Veterans Crisis Line (988).
- `needMapping.ts` — the 12 need categories → resource categories mapping.
- `mockResourceService.ts` — filters by category/radius/modality, derives distance + open-now,
  sorts (for "today": open-now → nearest → most-verified), simulated latency.
- `index.ts` — barrel + singleton `resourceService`.

### AI service (`src/services/ai/`)
- `AiService.ts` — interface (`buildNextStepPlan`, `buildCallScript`, `summarizeBenefit`) + typed
  `NextStepPlan` / `CallScript` / `BenefitSummary` + `AI_NOT_ADVICE_DISCLAIMER`.
- `templatedAiService.ts` — deterministic, **offline**, category-specific templated output; hedged
  eligibility; the not-advice disclaimer on every result.
- `index.ts` — barrel + singleton `aiService`.

## Interface refinements vs the design doc

- `search()` returns `ResourceSearchResult[]` (resource + derived distance/open-now), not bare
  `Resource[]` — the UI needs those derived fields. Recorded in [[Decision Log]].
- `summarizeBenefit({ resource })` takes a `Resource` (the app always has one) rather than raw text.

## Checks

- `npm run verify` (typecheck + lint) — **pass**.
- **Headless smoke test** (throwaway `tsx` script, since there's no UI yet): search food/today → 2
  results sorted by distance; radius=1mi → 0 (filter works); `getById` hit + null miss; 4-step plan;
  standard + short call scripts; emergency/online returns the null-coords crisis line; benefit
  summary on the stale resource produces the "double-check before you rely on it" note. **All pass.**

## Not done (by design)

No screens/UI, no persistence, no real API. Real runtime exercise in-app happens in Phase 3 when the
guided flow consumes `resourceService`.

## Next

[[Phase 3 Guided Need Flow]] — the "What do you need help with?" home + guided questions producing a
`Need`, wired to `resourceService.search`. First visible Frontline screen.

## Related

[[Resource Data Model]] · [[AI Feature Design]] · [[Technical Architecture]] · [[app_walkthrough]]
