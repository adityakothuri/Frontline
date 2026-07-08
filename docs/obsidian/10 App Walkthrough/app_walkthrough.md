---
tags: [walkthrough, source-of-truth, living-doc]
status: living
updated: 2026-07-07
---

# App Walkthrough

This file explains how **Frontline** works as the codebase grows. It is **not just a changelog** — it
is a guided explanation of how the app actually works, so you can understand the codebase without
digging through files blindly. Update it after every moderate or meaningful change.

> **Reset on 2026-07-07 for the Watchdog → Frontline reframe.** The **reused design system + app
> shell** and the new **data/AI service layer** (Phase 2) are real; **no Frontline screens exist
> yet** (Phase 3 next). The legacy Watchdog feature screens still exist in the repo but are
> **slated for replacement** and are not documented as Frontline behavior.

## How to use this file

Each feature entry explains: purpose · user flow · important files · how the code works · data flow ·
temporary/demo parts · future improvements. Read it to understand the app without opening every file.

## When Claude MUST update this file

After any **moderate or meaningful** change: new screen · feature folder · user flow · state logic ·
service/AI logic · data schema · navigation change · design-system implementation · reusable
component pattern · important refactor · a bug fix that changes a flow. Not for typos or formatting.

---

## What exists today (real, reused)

### Design system — `src/theme/`
- **Purpose:** one source of visual truth. `colors` (dark navy palette; semantic `success`/`warning`/
  `danger` re-mapped for Frontline as verified/unverified/emergency), `spacing` + `radii`,
  `typography` (Manrope 400/500/600/700 + a type scale), `mapStyle` (muted dark map), aggregated in
  `index.ts` as `theme`.
- **Reuse:** product-agnostic; carried over intact. Prefer these tokens over inline styles.

### Generic components — `src/components/`
- `ScreenContainer`, `AppText`, `Card`, `PrimaryButton`, `ScreenHeader`, `EmptyState`, `ErrorState`,
  `Loading` — reusable primitives that depend only on the theme. These stay.
- `AlertMarker`, `CategoryBadge` and the legacy alert screens are **Watchdog-specific** and will be
  replaced (do not extend them for Frontline).

### App shell — `app/`
- `expo-router` file-based routing; `_layout.tsx` (root stack + font/splash gate), `(tabs)/_layout.tsx`
  (bottom tabs), a `loading | error | ready` screen pattern. The **navigation mechanics** are reused;
  the **tab set and screens** become Frontline as feature phases land.

### App config
- `app.json` / `package.json` now identify the app as **Frontline** (`com.frontline.app`, slug/scheme
  `frontline`). The native `ios/` project is regenerated from this config.

## Data & AI service layer — `src/types`, `src/services`, `src/lib` (Phase 2, real)

The foundation the UI builds on. Screens will depend on these **interfaces**, never on the
concrete mocks — so mock → real backend/AI is a drop-in later.

- **Domain types** — `src/types/resource.ts` (canonical `Resource` + category meta),
  `src/types/need.ts` (the `Need` from the guided flow + the 12 need categories, urgency/modality/
  help-type/document enums, label maps). See [[Resource Data Model]].
- **Utilities** — `src/lib/geo.ts` (Haversine `distanceMiles`, `formatDistance`) and
  `src/lib/hours.ts` (`isOpenNow`, returning `true|false|null`).
- **Resources service** — `src/services/resources/`. `ResourceService` interface (`search`,
  `getById`); `mockResourceService` implements it over `seedResources.ts` (12 **simulated** LA-area
  veteran resources, honestly labeled). `search` filters by need→category, radius, and modality,
  derives distance + open-now per result, and sorts (for "today": open-now → nearest → verified).
  Consumed via the singleton `resourceService`. Data flow: `Need` → `resourceService.search` →
  `ResourceSearchResult[]` → (future) list/map screens.
- **AI service** — `src/services/ai/`. `AiService` interface (`buildNextStepPlan`,
  `buildCallScript`, `summarizeBenefit`) with a deterministic **templated** implementation
  (`templatedAiService`, offline, category-specific, hedged, disclaimer on every output). Consumed
  via the singleton `aiService`. A real Claude-backed implementation swaps in behind the same
  interface later (via a proxy — keys never in the client). See [[AI Feature Design]].
- **What's mock vs production:** all resource data is simulated; all AI is templated. Both are
  labeled. The **interfaces** are production-shaped.

## What's coming (planned, not built)

Per [[Feature Priority Order]] and the roadmap:
- **Feature folders** `src/features/{needs,resources,map,saved,profile}` — the guided need flow
  ([[Phase 3 Guided Need Flow]]), resource list/cards/detail, map discovery, saved items, profile.
- Each feature will get its own walkthrough entry here as it's built.

## Related

[[Technical Architecture]] · [[Folder Structure]] · [[Frontline Command Center]] · [[Feature Priority Order]]
