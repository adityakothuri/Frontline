---
tags: [build-log, phase-5, resources, map, discovery]
date: 2026-07-08
status: done
---

# 2026-07-08 — Phase 5: map + local discovery (List⇄Map toggle)

## What was built

Added a **map view of the same nearby resources** as the list, as a **List⇄Map toggle inside the
Results screen** (not a separate tab). Both views render one result set and share one selection, so
switching preserves context. Located resources become **category pins**; tapping a pin shows a
compact preview that opens the full detail page. See [[Phase 5 Map and Discovery]] and
[[Map and Search Design]].

### New files — `src/features/resources/`
- `useResourceSearch.ts` — hook extracting the Results search (`need` → `{ state, reload }`). Both
  views consume it; selection is kept in the screen, not the hook.
- `ViewToggle.tsx` — small segmented **List / Map** control.
- `ResourceMap.tsx` — `react-native-maps` `MapView`; category **Ionicon markers** (lime accent,
  `tracksViewChanges={false}` after first paint to avoid re-raster jank) for located results;
  `fitToCoordinates` on `onMapReady` with a `SEED_CENTER` first-paint fallback; tap pin → select →
  `ResourcePreview`. Phone/online-only resources (null coords) are surfaced as a **count note**;
  if a category has *only* such resources, an explicit "Phone & online only" empty state shows
  instead of a blank map.
- `ResourceMap.web.tsx` — web fallback placeholder (`react-native-maps` is iOS/Android only; Metro
  resolves `.web.tsx` automatically); the list stays the usable view on web.
- `ResourcePreview.tsx` — compact overlay card on pin tap (category · name · distance · open-now ·
  **View details** → `/resource/[id]?category=`); composes shared primitives, not `ResourceCard`.

### Changed
- `app/results.tsx` — adopts `useResourceSearch`; adds local `view: 'list' | 'map'` + shared
  `selectedId` state; a header row with the result count + `ViewToggle`; renders the `FlatList` or
  `<ResourceMap>` over the same results.

## Key decision — Apple Maps default, no custom style, no Maps key
Verified via Context7: on iOS the default provider is **Apple Maps**, which **ignores
`customMapStyle`**. Styling the map to the paper palette would require `PROVIDER_GOOGLE` + a Google
Maps iOS API key + a native rebuild. For the MVP we **accept Apple Maps' default (already a clean,
light surface)** and did **not** create `src/theme/mapStyle.ts` (it would only style Android and
reads as opaque slop) and did **not** add `expo-location` (map centers by fitting to the pins). See
[[Decision Log]].

## Scope honored
- List⇄Map is a **toggle in Results**, not a bottom-nav tab. State is local — **typedRoutes
  untouched** (no new route; the preview reuses `/resource/[id]`).
- No clustering (12 seed resources). Pins keyed by **category, never severity**.
- Structure + maps API pre-approved by `react-native-architect`.

## Checks
- `npm run verify` (typecheck + lint) — **passes clean**.
- Metro (dev client, iOS sim) — **bundled all 1194 modules** including every new file and
  `react-native-maps` (no "Unable to resolve"); the maps pod is in the native build from Phase 4.
- ⚠️ **Interactive map render not automatable here** (no sim tap tooling; macOS blocks synthetic
  input), so the on-device map + toggle still needs a human tap-through — see risks.

## Risks / follow-ups
- On-device: tap **Map**, confirm pins fit the viewport, tap a pin → preview → detail, the
  phone/online note shows for the **emergency** category (the Veterans Crisis Line has no coords),
  and toggling back preserves selection.
- Marker perf: `tracksViewChanges` flips to `false` ~800 ms after results change — verify icons
  paint before it flips.
- Selection is shared but the **list doesn't visually highlight** the map-selected row yet (minor;
  revisit if it feels disjoint).
- `ui-reviewer` + `qa-tester` still to run once the account session limit resets.

## Related
[[Phase 5 Map and Discovery]] · [[Map and Search Design]] · [[app_walkthrough]] · [[Decision Log]] ·
[[Screens List]] · [[Frontline Command Center]]
