---
tags: [technical, structure, source-of-truth]
status: proposed
updated: 2026-07-05
---

# Folder Structure

Preferred **feature-based** organization. This is the *intended* layout — actual folders are
created per feature **with approval** (see [[File Creation Policy]]). Do not scaffold the whole
tree up front.

## Proposed layout (Expo + TS)

```
app/                # (or src/) — expo-router or navigation entry
  ...
src/
  features/
    cameras/        # camera simulation feature
      components/
      hooks/
      data/         # mock cameras
      types.ts
      screens/
    detection/      # AI detection simulation + review flow
    alerts/         # posting + alert models
    map/            # map viewing
    profile/        # settings
  components/        # shared, reusable UI primitives (Card, Button, EmptyState...)
  theme/             # design tokens (colors, spacing, typography) — see [[UI Design System]]
  lib/               # small shared utilities
  navigation/        # navigators, route types
  types/             # cross-feature domain types
  mock/              # shared mock/demo data, clearly labeled
```

## Rules

- **Feature-first.** A feature owns its screens, components, hooks, types, and mock data.
- **Shared only when reused.** Promote to `components/` or `lib/` on the *second* real use, not
  speculatively.
- **Small, focused files.** Split when a file stops being scannable. No giant files.
- **Consistent naming.** `PascalCase` components, `camelCase` functions/vars, `kebab-case` or
  feature-consistent file names — pick one and keep it. No `Thing`, `Data`, `Card2`.
- **Mock data is labeled.** Files/exports named `mock*` / `demo*` and kept out of production
  paths conceptually. See [[Anti-AI-Slop Code Rules]].
- **One place per concept.** No duplicate components doing the same job.

## Decision hook

The exact root (`app/` with expo-router vs `src/` with React Navigation) is decided in
[[Phase 1 App Shell]] and recorded in [[Decision Log]].

## Related

[[Technical Architecture]] · [[Anti-AI-Slop Code Rules]] · [[File Creation Policy]]
