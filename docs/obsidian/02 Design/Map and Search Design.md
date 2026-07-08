---
tags: [design, map, search, source-of-truth]
status: active
updated: 2026-07-07
---

# Map and Search Design

How Frontline finds and shows **nearby resources** — the list, the map, and the search/filter model.
The map reuses the existing `react-native-maps` dependency and the platform-split pattern
(`src/components/maps.tsx` / `maps.web.tsx`) from the previous build.

## Inputs → results

A search is driven by the structured **need** from the [[Phase 3 Guided Need Flow]]:

- **category** (one of the 12 need categories)
- **location** — device location **or** ZIP (ZIP alone must work; privacy-first)
- **radius** — from profile (`preferred radius`) or a sensible default (e.g. 10 mi)
- **modality** — in-person / online / either
- **urgency** — today / this week / info (affects sort + "open now" emphasis)

Results come from the typed `resources` service ([[Resource Data Model]]); MVP data is seeded/mock.

## Two synchronized views (same data)

- **List** — the primary view. Resource **cards** sorted by relevance then distance; "open now"
  and best next action surfaced. Fast to scan on a phone.
- **Map** — category **pins** for the same result set. Tapping a pin opens a compact preview →
  resource detail. A visible toggle switches list ⇄ map.

Both share one result set and one selection state, so switching views never loses context.

## Sorting & filtering

- **Sort:** open-now + urgency first, then distance, then verification strength (verified above
  unverified). Keep it explainable — no opaque ranking.
- **Filters (MVP, minimal):** category (from the flow), radius, modality, and "open now". Avoid a
  filter zoo; the guided flow already narrows intent.
- **Distance:** Haversine from the user's point (a `formatDistance` helper already exists in the old
  mock and should be extracted into a shared util).

## Map styling

- Reuse the muted dark map style (`src/theme/mapStyle.ts`) so it recedes and **pins are the focus**.
- **Pins are keyed by resource category** (icon + accent), not by severity. Keep them legible and
  consistent with the category iconography in [[UI Design System]].
- Tap → preview card (name · category · distance · open? · next action) → full detail.

## States

- **Loading:** skeleton cards / map placeholder.
- **Empty:** "No <category> resources found near <ZIP>" with a clear action (widen radius, change
  ZIP, switch modality to online).
- **Error:** retry with a friendly message; never a raw stack trace.
- **Web:** the map falls back to a placeholder (react-native-maps is iOS/Android only); the list
  covers the same data.

## Privacy

- Prefer **ZIP entry**; if requesting device location, ask clearly and always allow ZIP instead.
- Never store precise location beyond the session; see [[Trust Safety and Privacy]].

## Related

[[App Flow|Core User Flows]] · [[Screens List]] · [[Resource Data Model]] · [[Phase 5 Map and Discovery]] · [[UI Design System]]
