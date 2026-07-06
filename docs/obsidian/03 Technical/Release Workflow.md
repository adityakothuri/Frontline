---
tags: [technical, release, workflow]
status: draft
updated: 2026-07-05
---

# Release Workflow

How Watchdog gets built and demoed. Owned by the `release-manager` agent (+ `github-actions`
skill). Kept minimal for the MVP; expands with real backend/AI.

## MVP "release" = a clean demo build

- **Run locally / Expo Go** for development demos.
- A **development build** (EAS dev client) when native modules appear.
- Goal: a reliably launchable, polished demo of the [[App Flow]] loop.

## Pre-release checklist (MVP)

- [ ] Quality gates pass ([[Quality Gates]]).
- [ ] App launches clean; core loop demo-able end to end.
- [ ] Simulated systems clearly labeled ([[MVP Definition]]).
- [ ] No secrets in the bundle ([[Environment Variables]]).
- [ ] Build log + [[app_walkthrough]] current.

## Post-MVP (Priority 9+)

- **EAS Build** for iOS/Android binaries; **EAS Submit** for store readiness.
- Versioning (`app.json` / `app.config`), release notes, crash/error monitoring.
- CI via the `github-actions` skill (iOS simulator / Android emulator builds + artifacts).
- Verify all build/EAS commands with **Context7** (don't rely on memory).

## Related

[[Git Workflow]] · [[Environment Variables]] · [[Phase 7 Backend Integration]] · [[Quality Gates]]
