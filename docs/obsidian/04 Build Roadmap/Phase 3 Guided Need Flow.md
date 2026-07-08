---
tags: [roadmap, phase-3, mvp]
status: planned
updated: 2026-07-07
---

# Phase 3 — "What do you need help with?" Guided Need Flow

## Purpose

The front door. Turn a vague need into a **structured query** through a calm, low-friction guided
flow — the intent that drives all discovery and AI.

## Included

- **Home** screen: "What do you need help with?" + a grid of the 12 need categories (large,
  accessible tiles).
- **Guided flow** after category select: what · urgency (today / this week / info) · in-person /
  online / either · documents on hand · help type (call / visit / apply / understand).
- **Location step**: device location **or ZIP** (ZIP alone must work).
- Produces a typed `Need` object consumed by the resources service.

## Excluded

- Results rendering (Phase 4) and map (Phase 5) — this phase ends at a populated `Need` + navigation
  to results.
- Real AI (uses the `AiService`/`ResourceService` seams from Phase 2).

## Checklist

- [ ] Approve screen/component files with `react-native-architect`.
- [ ] Category grid (reuse tiles/tokens; big tap targets).
- [ ] Guided questions (short, skippable where sensible); build the `Need`.
- [ ] ZIP/location step with privacy-first copy.
- [ ] Loading/empty/error + `ui-reviewer` + `/slop-check`.
- [ ] `/finish-task`: build log + [[app_walkthrough]].

## Definition of done

- A veteran can go from home → structured `Need` (category + answers + location/ZIP) in a few taps.
- Accessible, calm, one clear action per step.

## Risks

- Too many questions → drop-off. Keep it short; default sensibly.

## Related

[[App Flow|Core User Flows]] · [[Screens List]] · [[Resource Data Model]] · [[Phase 4 Resource List and Detail]]
