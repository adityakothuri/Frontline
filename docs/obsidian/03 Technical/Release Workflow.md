---
tags: [technical, release, workflow]
status: draft
updated: 2026-07-05
---

# Release Workflow

How Frontline gets built and demoed. Owned by the `release-manager` agent (+ `github-actions`
skill). Kept minimal for the MVP; expands with real backend/AI.

## MVP "release" = a clean demo build

- **Development build (`expo-dev-client`)** is the primary runtime as of 2026-07-07 — built
  locally via `expo run:ios` (managed/CNG prebuild). Expo Go stays a fallback while no native
  module requires the dev build.
- Built **locally** (Xcode + CocoaPods on macOS); no EAS account or `eas.json` yet — EAS cloud
  builds are deferred until cloud builds / OTA updates are actually needed.
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

[[Git Workflow]] · [[Environment Variables]] · [[Phase 10 Backend and Data Ingestion]] · [[Quality Gates]]
