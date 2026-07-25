---
tags: [build-log]
date: 2026-07-24
phase: "Frontend polish — extreme final audit"
task: Frontend audit — no overlap/spacing issues, unified tokens, "See in map" on every opportunity
status: done
---

# 2026-07-24 — Frontend audit: See-in-map, overlap fixes, design tokens

## Task
An "extreme, final" frontend pass: the app should look magnificent with **no spacing issues and no
overlapping text anywhere**, and **every opportunity must carry a "See in map" button** — struck
through (a cross) + disabled when the resource has no map location.

## Audit result
Three parallel Explore sweeps found a disciplined design system already in place (single 4/8 spacing
scale, warm paper palette, near-universal `AppText` variants, designed loading/empty/error states,
≥44pt targets). So this was **targeted hardening + one new feature**, not a redesign.

## Scope
- **A** Eliminate text overlap/truncation risks. **B** Design-system hardening (new tokens).
  **C** New "See in map" feature (context-aware). No pin clustering (deferred — no new dependency).

## Changes
| File | Change | New? |
|------|--------|------|
| `src/features/resources/SeeInMapButton.tsx` | **NEW** — reusable See-in-map control; enabled vs struck/"Not on map" disabled state; `card` + `pill` variants | new — approved in plan |
| `src/theme/spacing.ts` | Add `shadows` (sm/md/lg) token set + `xxs: 2` optical step | edited |
| `src/theme/index.ts` · `colors.ts` · `typography.ts` | Export shadows; add `onboardingAccents` (earth quartet); add `displayLarge` variant | edited |
| `src/components/Card.tsx` · `ResourceMap.tsx` · `app/(tabs)/map.tsx` | Replace 3 hand-rolled shadow recipes with `shadows.*` | edited |
| `src/features/resources/ResourceCard.tsx` | name `numberOfLines={2}`; category label truncation + `flexShrink`; `rightCluster flexShrink:0`; `actions flexWrap`; See-in-map button + `onSeeInMap` prop | edited |
| `VeteranBadge.tsx` · `StatusPill.tsx` | `numberOfLines={1}` on labels; `paddingVertical` → `xxs` | edited |
| `ResourceDetail.tsx` | ContactRow `numberOfLines={2}` + `ellipsizeMode`; `gap:2`→`xxs`; See-in-map via `ActionRow` | edited |
| `ActionRow.tsx` | Add See-in-map pill → Map tab focus | edited |
| `ResourceMap.tsx` | Focus effect (`animateToRegion` on `selectedId`, gated on `onMapReady`); `fitToPins` skips only when the selected pin exists in-set | edited |
| `app/(tabs)/map.tsx` | Read `?focus=` param → `selectedId`; legend fixed `height`→`minHeight`; footer pill `numberOfLines`; `+2`→`xxs` | edited |
| `app/results.tsx` | `onSeeInMap` flips to in-place map view + focuses the pin | edited |
| `app/onboarding.tsx` · onboarding titles · discover/profile/NeedCategoryCard/SelectableOption | Wire `onboardingAccents`; titles → `displayLarge`; `gap:2`/`padding:3`→tokens; InfoRow value truncation | edited |

## "See in map" behavior (context-aware, confirmed with user)
- On **Results**, the card flips that screen to its own map view and zooms the pin (preview open).
- On the **detail page** and in **Discover/Saved**, it opens the **Map tab** centered on the pin
  via `router.navigate({ pathname: '/map', params: { focus: id } })`.
- **On the map** = `latitude !== null && longitude !== null` (stricter than the existing
  `hasDirections`, which also allows address-only rows). Off-map → struck "Not on map", disabled.

## Quality checks
- typecheck: **pass** · lint: **pass** · test: n-a (placeholder)
- **Ran the app on iOS (iPhone 17 Pro sim), exercised the flow, screenshotted:**
  - Home + Discover: cards render, action row wraps cleanly (Call/Directions on line 1, See-in-map +
    "View details" on line 2), no header overlap.
  - Emergency results: Veterans Crisis Line (phone/online-only) shows the **struck "Not on map"**
    disabled button next to an active Call.
  - Map tab via `?focus=<food id>`: opened centered on the pin with its **preview card open** —
    confirms the `mapReady`-gated `animateToRegion` fires.

## Reviews
- qa-tester: **PASS** (no blocking/real-bug defects). Flagged focus-before-map-ready (**fixed** via
  `mapReady` gate) and a not-in-set edge case (**fixed** — `fitToPins` now still fits all pins).
- ui-reviewer: **Ship**, fix item 1 first — off-map affordance too subtle. **Fixed**: label now
  "Not on map", strike drawn in `textSecondary`, opacity 0.5, explicit strike geometry. Also
  **fixed**: `radius` onboarding accent collided with the olive brand accent → retuned to clay
  `#9C5D3B`; hero titles unified on `displayLarge`.

## Logs updated
- [x] app_walkthrough → [[app_walkthrough]] · [x] decision log → [[Decision Log]] · [x] Command Center

## Risks / follow-ups
- Detail-page "See in map" for a coords-bearing resource that falls **outside** the Map tab's
  browse radius: focus is set but the pin isn't in-set, so it won't zoom (still fits all pins + no
  crash). Theoretical for in-radius locals. A future improvement could pass the resource through.
- Map **pin clustering** deferred (dense co-located pins can still stack) — no new dependency this pass.
- Kept the struck "Not on map" button on cards per the explicit request ("each opportunity"); the
  distance line already says "Phone / online", so it's mild redundancy by design.

## Next step
Commit on `feature/frontend-audit-see-in-map` and open a PR (independent of the Essentials branch —
different files). Optional future pass: pin clustering.
