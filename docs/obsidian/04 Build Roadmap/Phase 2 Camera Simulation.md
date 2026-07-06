---
tags: [roadmap, phase-2, mvp]
status: not-started
updated: 2026-07-05
---

# Phase 2 — Camera Feed Simulation

## Purpose

Prove the user can view a camera feed **without** real Ring/smart-camera integration. It must
feel believable for a demo, while being clearly simulated in code and docs.

## Included

- Simulated camera screen + camera card/list.
- Camera status (connected/disconnected).
- Mock feed preview.
- Realistic event timeline.
- Basic camera-settings mock.
- A clear, typed `Camera` model + `mock`/`demo` data.
- A seam toward real integrations (typed service interface).

## Excluded

- Real RTSP/Ring/live streaming (Priority 11 — [[Phase 8 Real AI and Camera Research]]).

## Checklist

- [ ] **Approve** new files: `features/cameras/` (types, mock data, screens, components).
- [ ] Define `Camera` type + believable mock cameras (real-sounding names/locations).
- [ ] Camera list with status pills.
- [ ] Camera detail: mock feed preview + event timeline.
- [ ] Connected/disconnected + empty/error states.
- [ ] Label all simulation honestly (`mock`/`demo`).
- [ ] `ui-reviewer` + `/finish-task` (build log + app_walkthrough).

## Definition of done

- Cameras list and detail render from typed mock data and feel believable.
- Simulation is clearly labeled; a real service could implement the same interface.
- Logged.

## Risks

- Making the fake feed look like a real integration (forbidden — [[MVP Definition]]).
- Bloated camera-settings screen (keep it minimal).

## Related

[[Technical Architecture]] · [[Folder Structure]] · [[Phase 3 Detection Review]] · [[UI Design System]]
