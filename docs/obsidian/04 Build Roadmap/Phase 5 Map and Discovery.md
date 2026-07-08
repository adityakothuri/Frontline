---
tags: [roadmap, phase-5, mvp]
status: planned
updated: 2026-07-07
---

# Phase 5 — Map & Local Resource Discovery

## Purpose

Add place. Show the same resource results as **category pins** on a map, synchronized with the list.

## Included

- Map tab/view reusing `react-native-maps` + the muted dark `mapStyle` and the platform-split
  (`maps.tsx` / `maps.web.tsx`).
- **Category pins** for the current result set; tap → preview card → detail.
- **List ⇄ map toggle** sharing one result set + selection state.
- Web fallback (placeholder + list); designed empty/loading/error.

## Excluded

- Real geocoding services (ZIP → coarse center is fine for MVP).
- New backend.

## Checklist

- [ ] Approve map component/screen changes with `react-native-architect`.
- [ ] Render pins from `ResourceService` results; keep list + map in sync.
- [ ] Preview card + navigation to detail.
- [ ] Empty/loading/error + web fallback; `ui-reviewer` + `/slop-check`.
- [ ] `/finish-task`: build log + [[app_walkthrough]].

## Definition of done

- The same nearby resources appear on list and map; switching views preserves context.

## Risks

- Pin clutter — cluster or cap density; keep pins legible.
- Re-introducing the old alert-severity semantics — pins are keyed by **category**, not severity.

## Related

[[Map and Search Design]] · [[Resource Data Model]] · [[UI Design System]] · [[Phase 6 AI Plans and Call Scripts]]
