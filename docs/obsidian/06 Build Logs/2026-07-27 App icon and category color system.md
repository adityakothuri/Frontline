---
tags: [build-log]
date: 2026-07-27
phase: "Release engineering / design polish"
task: New app icon set + resource detail UI fixes + distinct category color system
status: done
---

# 2026-07-27 — App Icon and Category Color System

## Task

Set a newly designed Frontline shield icon (`~/Downloads/exports 3/icon-1024.png`) as the app icon
and wire it through the app. Then, from a screenshot of the resource detail screen: shrink or move
the oversized category icon in the hero, make the AI summary's background match the category's
color, and give every category its own color — matching the visual direction in the `exports 3`
design set.

## Scope

- **In scope:** the six brand assets, `app.json` icon config, the resource detail hero, the AI
  guidance block's surface, both category metadata maps, and the follow-up fixes raised by the QA
  and UI reviews.
- **Explicitly out of scope:** the veteran data-quality work already in flight on this branch
  (`ingestion/*`, `src/services/resources/*`, `app/(tabs)/discover.tsx`, `app/results.tsx`,
  `ReferralSection.tsx`, migrations `0023`/`0024`) — untouched here and logged separately in
  [[2026-07-27 Veteran data quality — Phases 1 and 2]].
- **Deferred (noted, not done):** the nav header repeats the resource name ~90px above the hero
  title; `onboardingAccents` in `theme/colors.ts` still holds three retired category hues.

## Changes

| File | Change | New? (approved?) |
|------|--------|------------------|
| `assets/icon.png` | New shield art, 1024², alpha stripped (colorType 2) for App Store | edited |
| `assets/splash-icon.png` | Rounded tile built from the clean art with a real alpha mask | edited |
| `assets/favicon.png` | 196², opaque | edited |
| `assets/android-icon-foreground.png` | Shield lifted off its backdrop, fitted to the 72dp **circle** | edited |
| `assets/android-icon-background.png` | Solid `#3D4A2E` | edited |
| `assets/android-icon-monochrome.png` | Shield silhouette, star knocked out | edited |
| `app.json` | `android.adaptiveIcon.backgroundColor` → `#3D4A2E` | edited |
| `src/types/resource.ts` | 11 distinct category hues + accurate doc comment | edited |
| `src/types/need.ts` | Same 11 hues mirrored across the need categories | edited |
| `src/features/resources/AiContentBlock.tsx` | Optional `color` prop; category-washed surface | edited |
| `src/features/resources/ResourceDetail.tsx` | Medallion inline at 36pt; hue passed to both AI blocks; hero spacing | edited |
| `src/features/resources/CallScriptCard.tsx` | Passes the resource's hue through | edited |
| `app/(tabs)/map.tsx` | Legend count → `textSecondary` (was the hue, ~3:1 at 12px) | edited |
| `src/types/categoryMeta.test.ts` | Invariant test for the palette + map sync | **new — approved** |
| `docs/obsidian/02 Design/UI Design System.md` | "Category identity hues" section | edited |

`ios/` (gitignored prebuild output) had its `AppIcon.appiconset` and `SplashScreenLogo.imageset`
refreshed so the existing local dev build shows the new art without a full prebuild.

## Quality checks

- typecheck: **pass**
- lint: **pass**
- test: **pass** — 8 files / 54 tests (up from 7 / 49; the 5 new ones are the palette invariants)
- manual run: **done** (iPhone 17 Pro sim, iOS 26.5, `npx expo run:ios`, build succeeded 0 errors).
  Verified rendering: the new shield icon on the springboard; Home; Discover with visibly distinct
  category identities (food burnt orange, education dusty blue, community dusty rose, jobs gold,
  benefits indigo, all still on warm paper); a food resource detail with the 36pt medallion inline
  beside the "Food" label and the name high on the page; AI blocks carrying their category hue with
  the olive sparkles glyph constant; the call-script sheet inheriting the same hue.
  Driven by deep link (`frontline:///resource/<id>?category=<need>`) — synthetic taps via System
  Events are unreliable against the Simulator. A stale `com.frontline.app` install (the pre-rename
  bundle id) was uninstalled from the sim because it competed for the `frontline://` scheme.

## Reviews

- **qa-tester: FAIL → resolved.** Found a **blocker** the naive eye check missed: the designer's
  `icon-src.png` — which the first pass used for the splash — has four *opaque black squares* baked
  into its "transparent" corners (23,104 opaque near-black px). They would have shown on every cold
  start. Rebuilt the splash from the clean full-bleed art with a generated alpha mask; corner alpha
  now verified `0`. Also found the adaptive foreground overflowed the 72dp **circle** mask by ~1%
  (max radius 374px vs the 341px limit) — rescaled to 340px — and one real accessibility violation
  in `map.tsx` where a category hue was used as 12px text (9 of 11 hues failed AA there).
- **ui-reviewer: NEEDS REVISION → resolved.** Passed the hero fix. Rejected the first palette and
  the AI block strength: five hues collided with semantic tokens (housing was **ΔE 5.0** from the
  action olive), three failed 3:1 as icons, four pairs weren't actually distinct, and the AI block
  at `alpha 0.14` was within 7/255 of the hero fill — erasing the "guidance vs source" boundary.
  All addressed; see Decisions.
- /slop-check: not run separately — both reviews covered the same ground and the doc comments they
  flagged as inaccurate were rewritten.

## Logs updated

- [x] app_walkthrough → [[app_walkthrough]]
- [x] decision log → [[Decision Log]]
- [ ] bug log — the black-corner splash was caught pre-merge in the same task, recorded here
- [x] Command Center current/next task

## Risks / follow-ups

- **The AI block's category wash reads faint on device.** At `surfaceTint 0.07` the fill is barely
  perceptible; the `alpha 0.45` border carries most of the category signal. That's the deliberate
  trade made to keep it distinct from the hero, but it is close to the floor of "corresponds to the
  category" — worth a second look, and easy to raise to ~0.09 if it should be more obvious.
- **The Home *grid* was never seen.** Home renders the greeting + review prompt; the 11-card
  `NeedCategoryCard` column didn't appear in this pass, so the palette's hardest test — all 11 tints
  stacked — is still unverified. Discover's chips and cards were the closest proxy and looked right.
- `onboardingAccents` (`theme/colors.ts`) still holds `#4E7D5B` / `#8A6A48` / `#A56E24`, three
  retired category hues. Harmless, but the palette now carries 15 hues where 11 were intended.
- The Android adaptive icon is untested on a real launcher; only the geometry was verified.

## Next step

Run the app and walk Home → Discover → detail → call script to confirm the palette and the AI block
read as intended on device, then return to the veteran data-quality work — food and legal are still
empty pending the `feed-america` and `vso-organizations` ingests.
