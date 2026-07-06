---
tags: [roadmap, phase-8, post-mvp, research]
status: not-started
updated: 2026-07-05
---

# Phase 8 — Real AI & Camera Research

> **Priorities 10 & 11 — Post-MVP. Not built without explicit approval.** Research-first.

## Purpose

Replace simulation with a real detection pipeline and, eventually, real camera integrations —
carefully, honestly, and only when the product is ready.

## Included

**Real AI / video (Priority 10)**
- Video upload or stream sample; detection API; confidence score.
- Event clipping; thumbnail generation; AI-suggested descriptions.
- False-positive handling; model/provider evaluation.

**Real camera integrations (Priority 11)**
- Ring-style integrations; RTSP support; smart-home integrations.
- Camera permissions; live-stream handling; storage/security concerns.

## Excluded (until approved)

- Everything here is future work. The MVP stays **simulated and clearly labeled**.

## Checklist (research → spec → approval → build)

- [ ] Research options; capture findings in `09 Research/`.
- [ ] Write a [[Feature Spec Template|feature spec]] per capability.
- [ ] Record model/provider and integration decisions in [[Decision Log]].
- [ ] Swap simulated services for real ones **behind the same interfaces** (the honest seam).
- [ ] Keep `mock` vs real clearly separated; never disguise simulation as production.
- [ ] `qa-tester` (false positives, edge cases, permissions) + `/finish-task`.

## Definition of done

- Real detection/camera capabilities replace simulation where approved.
- Code + docs clearly distinguish simulation from production AI/cameras.
- Decisions and specs recorded.

## Risks

- High complexity, real privacy/security stakes — do not build casually.
- Pretending the MVP has real AI (explicitly forbidden — [[MVP Definition]]).
- Camera SDK/security surface area.

## Related

[[Non-MVP Ideas]] · [[Phase 7 Backend Integration]] · [[Product Principles]] · [[Feature Spec Template]]
