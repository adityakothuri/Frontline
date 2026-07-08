---
tags: [build-log, phase-3]
date: 2026-07-07
status: done
---

# 2026-07-07 — Phase 3: Guided Need Flow (first visible Frontline screens)

## What was built

The first tappable Frontline flow: **Home → pick a category → guided questions → nearby resources**,
wired to the Phase 2 `resourceService`. Also replaced the legacy Watchdog navigation/screens.

### New screens & flow
- `app/(tabs)/home.tsx` — **"What do you need help with?"** with a 2-column grid of the 12 need
  categories (icon tiles). Tapping pushes the guided flow.
- `app/need/[category].tsx` — the guided flow: urgency · in-person/online · help type · documents on
  hand (multi-select chips) · optional ZIP. Sensible defaults pre-selected so it's fast. Builds a
  `Need` and pushes results.
- `app/results.tsx` — reconstructs the `Need` from route params, calls `resourceService.search`, and
  renders loading / error / empty / list states with `ResourceCard`s in a `FlatList`.
- `app/(tabs)/saved.tsx` + reframed `app/(tabs)/profile.tsx` — polished placeholders (Phase 8).

### New components
- `src/components/Chip.tsx` — selectable pill (accent tint + check, never color alone). Added to the
  barrel.
- `src/features/resources/ResourceCard.tsx` — the scannable card: category, distance, open-now pill,
  description, **source/verification badge**, and working **Call** + **Directions** actions.
- `src/features/resources/resourceStatus.ts` — open-now + source/verification presentation
  (+ stale-after-90-days warning).
- `src/features/resources/resourceActions.ts` — real `tel:` + maps deep links via `Linking`.

### Navigation / shell
- `app/(tabs)/_layout.tsx` → **Home · Saved · Profile**.
- `app/_layout.tsx` → registers `need/[category]` + `results` with a themed header; dropped the
  Watchdog `report` / `alert/[id]` modals.
- `app/index.tsx` → Frontline welcome (wordmark, tagline, "not the VA" disclaimer, "Get started").

### Removed (legacy Watchdog, replaced by this navigation)
`app/(tabs)/{map,alerts,cameras,review}.tsx`, `app/report.tsx`, `app/alert/[id].tsx`,
`src/components/{AlertMarker,CategoryBadge,maps,maps.web}.tsx`, `src/mock/alerts.ts`,
`src/theme/mapStyle.ts`. (A Frontline map returns in Phase 5.)

## Checks

- `npm run verify` (typecheck + lint) — **pass** (after regenerating `.expo/types` typed routes via a
  Metro start; the stale route types were the only hiccup).
- **`expo export --platform ios`** — **pass**: the full JS graph bundles through Metro with no
  import/resolution errors (every screen + route resolves).
- Not yet eyeballed in the Simulator — recommended next (the dev build needs a rebuild since the
  native identity is now Frontline).

## Notes / scope

- Card tap does not open a detail page yet — **resource detail + "Generate call script"** is Phase 4
  (the `aiService` is ready). Phase 3 keeps Call/Directions as the working actions so the flow is
  useful now with no dead links.
- ZIP isn't geocoded in the MVP; searches fall back to the seed-data city center (Downtown LA) so
  distances are meaningful. Real geocoding is Phase 10.

## Next

[[Phase 4 Resource List and Detail]] — the resource **detail page** (AI summary, eligibility,
documents checklist, trust, generated call script) reachable by tapping a card.

## Related

[[Phase 3 Guided Need Flow]] · [[Resource Data Model]] · [[UI Design System]] · [[app_walkthrough]]
