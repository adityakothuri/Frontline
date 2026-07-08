---
tags: [roadmap, phase-2, mvp]
status: planned
updated: 2026-07-07
---

# Phase 2 — Resource Data Model & Mock Service

## Purpose

Establish the **data and AI seams** every later screen depends on — before building any screens. The
previous codebase imported mock data directly with no interface; Frontline fixes that here so mock →
real is a drop-in swap. ⚠️ New app files/deps need approval ([[File Creation Policy]]).

## Included

- `src/types/` — `resource.ts` (canonical `Resource` + enums), `need.ts`, `profile.ts`.
- `src/services/resources/` — `ResourceService` interface (`search`, `getById`) + an in-memory mock
  implementation over **~8+ realistic seeded resources** across categories (believable names,
  addresses, hours, phones), plus a need→category mapping and a shared `distance`/`open-now` helper.
- `src/services/ai/` — the `AiService` interface + a **templated** implementation (offline).
- Extract reusable helpers worth keeping from the legacy mock (`formatRelativeTime`, distance).

## Excluded

- Any screens/UI (Phases 3+).
- Real network calls, real Claude API, persistence.

## Checklist

- [ ] Approve file plan (types + two service folders) with `react-native-architect`.
- [ ] Implement `Resource` model per [[Resource Data Model]].
- [ ] Implement `ResourceService` mock + seed data (honest `mock`/`seed` naming).
- [ ] Implement `AiService` interface + templated stubs per [[AI Feature Design]].
- [ ] `npm run verify` passes; unit-check the service shapes.
- [ ] `/finish-task`: build log + [[app_walkthrough]] entry.

## Definition of done

- Typed `Resource`, `ResourceService`, and `AiService` exist; a screen could consume them.
- Seed data is realistic and labeled; no `Resource 1`.

## Risks

- Over-modeling — keep it to the fields in [[Resource Data Model]].
- Coupling screens to the mock later — always depend on the **interface**.

## Related

[[Resource Data Model]] · [[AI Feature Design]] · [[Technical Architecture]] · [[Phase 3 Guided Need Flow]]
