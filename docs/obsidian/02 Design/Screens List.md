---
tags: [design, screens]
status: draft
updated: 2026-07-05
---

# Screens List

The screens needed for the MVP demo loop, grouped by area. Screens are **created with approval**
during their roadmap phase — this list is the plan, not a build order to run unattended.

## Entry

| Screen | Purpose | Phase |
|--------|---------|-------|
| Welcome / Onboarding | Establish identity; enter demo mode | [[Phase 1 App Shell]] |
| Auth / Demo entry | Sign in or continue as demo | [[Phase 1 App Shell]] |

## Core tabs (bottom navigation)

| Screen | Purpose | Phase |
|--------|---------|-------|
| Home dashboard | Calm overview: recent activity, quick actions | [[Phase 1 App Shell]] |
| Cameras | List of simulated cameras + status | [[Phase 2 Camera Simulation]] |
| Camera detail | Mock feed + event timeline | [[Phase 2 Camera Simulation]] |
| Review (Alerts) | Pending detection queue | [[Phase 3 Detection Review]] |
| Detection detail / Review | Clip, AI description, approve/reject, expiration | [[Phase 3 Detection Review]] |
| Map | Neighborhood alerts on a map | [[Phase 5 Map Alerts]] |
| Alert detail sheet | Tapped alert details | [[Phase 5 Map Alerts]] |
| Profile / Settings | Account, privacy, notifications, defaults | [[Phase 6 Polish]] |

## Supporting

| Screen / element | Purpose | Phase |
|------------------|---------|-------|
| Post alert (confirm) | Edit description + expiration, confirm public post | [[Phase 4 Alert Posting]] |
| Empty / Loading / Error states | Every screen has all three | All phases |

## Notes

- Navigation structure (bottom tabs vs stack) is decided in [[Phase 1 App Shell]] with the
  `react-native-architect` and `react-navigation` skill; record the call in [[Decision Log]].
- Keep the tab bar minimal and legible. See [[UI Design System]].

## Related

[[App Flow]] · [[UI Design System]] · [[User Stories]]
