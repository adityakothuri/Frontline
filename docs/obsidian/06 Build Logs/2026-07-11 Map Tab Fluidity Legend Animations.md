---
tags: [build-log, map, motion, design-system]
date: 2026-07-11
phase: "Polish — post-Phase-8 UI refinement"
task: Map tab fluidity — spacing, category legend, staggered entrance
status: done
---

# 2026-07-11 — Map tab fluidity: legend, olive footer pill, staggered entrance

User feedback on yesterday's framed Map tab ([[2026-07-10 UI Refinement Olive Categories Map Frame
Profile Card]]): "looks odd — more space within the margins, more color and animations, more fluid."
No new files, no new dependencies.

## Changes
| File | Change | New? |
|------|--------|------|
| `app/(tabs)/map.tsx` | Staggered entrance (header → map frame → footer) from one driver + a second `reveal` driver when results land, both honoring reduce-motion (same pattern as onboarding). New **category legend strip** above the map — one tinted pill per pinned category (its olive-family color + icon + count), skeleton pills while loading, fixed-height slot so the map never reflows. Footer became an **olive `accentSoft` pill** ("N places nearby — tap a pin to preview"). Map frame: `radii.xl`, whisper shadow, map fades in inside it. | edited |
| `src/features/resources/ResourceMap.tsx` | Recenter button: `Pressable` → `PressableScale` (spring-down press) + whisper shadow | edited |

## Quality checks
- typecheck / lint: pass (`npm run verify`); test: n/a
- manual run: not yet exercised on device

## Logs updated
- [x] app_walkthrough (Map tab bullet) → [[app_walkthrough]]
- [ ] decision log — no new decision (extends the existing framed-map direction)
- [ ] Command Center — phase unchanged

## Risks / follow-ups
- Legend is display-only — if users try to tap it as a filter, consider wiring it to filter pins
  (would mirror Discover's shell row).
- Verify the frame's `overflow: hidden` + shadow and the reveal fade against the native map view on
  Android (elevation + clipping interactions).

## Next step
- On-device pass over the Map tab entrance, legend scroll, and recenter spring.
