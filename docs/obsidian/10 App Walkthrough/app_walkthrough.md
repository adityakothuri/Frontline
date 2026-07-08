---
tags: [walkthrough, source-of-truth, living-doc]
status: living
updated: 2026-07-07
---

# App Walkthrough

This file explains how **Frontline** works as the codebase grows. It is **not just a changelog** — it
is a guided explanation of how the app actually works, so you can understand the codebase without
digging through files blindly. Update it after every moderate or meaningful change.

> **Reset on 2026-07-07 for the Watchdog → Frontline reframe.** At this point Frontline feature
> code has **not** been built yet — only docs and app config changed. What's described as "real"
> below is the **reused design system + app shell**. The legacy Watchdog feature screens still exist
> in the repo but are **slated for replacement** and are not documented as Frontline behavior.

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

## What's coming (planned, not built)

Per [[Feature Priority Order]] and the roadmap:
- **`src/types/` + `src/services/{resources,ai}`** — the typed `Resource` model, `ResourceService`,
  and `AiService` seams ([[Phase 2 Resource Data Model and Service]], [[Resource Data Model]],
  [[AI Feature Design]]).
- **Feature folders** `src/features/{needs,resources,map,saved,profile}` — the guided need flow,
  resource list/cards/detail, map discovery, saved items, and profile.
- Each feature will get its own walkthrough entry here as it's built.

## Related

[[Technical Architecture]] · [[Folder Structure]] · [[Frontline Command Center]] · [[Feature Priority Order]]
