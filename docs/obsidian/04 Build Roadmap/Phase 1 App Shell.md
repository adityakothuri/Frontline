---
tags: [roadmap, phase-1, mvp]
status: not-started
updated: 2026-07-05
---

# Phase 1 — Polished App Shell

## Purpose

Make Watchdog feel real and premium from the first demo. Establish the visual identity — not a
default template. ⚠️ This phase creates the **first app source + dependencies**; each new file
and dependency needs approval ([[File Creation Policy]]).

## Included

- Welcome / onboarding direction.
- Auth / **demo-mode** entry flow.
- Home dashboard.
- Clean navigation (bottom tabs or equivalent) — Cameras, Map, Review/Alerts, Profile.
- Consistent layout + reusable screen patterns.
- Loading / empty / error states.
- Design-system implementation (tokens: colors, spacing, typography — [[UI Design System]]).

## Excluded

- Real camera feeds, detection, posting, or map data (later phases).
- Backend / auth provider / AI.

## Checklist

- [ ] **Approve** app scaffolding approach (Expo + TS; expo-router vs React Navigation) →
  record in [[Decision Log]]. Use `react-native-architect` + `react-navigation`; verify via Context7.
- [ ] Scaffold Expo + TypeScript project (approved).
- [ ] Add `typecheck` + `lint` scripts so [[Quality Gates]] engage.
- [ ] Implement theme/design tokens.
- [ ] Build navigation shell + placeholder tab screens.
- [ ] Home dashboard with believable mock summary data.
- [ ] Welcome + demo-entry screens.
- [ ] Loading/empty/error patterns.
- [ ] `ui-reviewer` pass ([[Anti-AI-Slop Design Rules]]).
- [ ] `/finish-task`: build log + [[app_walkthrough]] entry.

## Definition of done

- App launches; navigation works; identity reads as Watchdog (not a template).
- Design tokens exist and are used consistently.
- All shell screens have loading/empty/error states.
- Logged in build log + app_walkthrough.

## Risks

- Template-looking shell (biggest risk) — enforce [[Anti-AI-Slop Design Rules]].
- Over-scaffolding folders before features need them ([[Folder Structure]]).
- Adding state/nav libraries prematurely.

## Related

[[Screens List]] · [[UI Design System]] · [[Technical Architecture]] · [[Phase 2 Camera Simulation]]
