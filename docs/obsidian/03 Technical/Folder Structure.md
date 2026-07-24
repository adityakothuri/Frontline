---
tags: [technical, structure, source-of-truth]
status: active
updated: 2026-07-07
---

# Folder Structure

Preferred **feature-based** organization. This is the *intended* layout — actual folders are created
per feature **with approval** (see [[File Creation Policy]]). Do not scaffold the whole tree up front.

## Current (reused shell)

```
app/                     # expo-router routes (entry = expo-router/entry)
  _layout.tsx            # root stack + fonts/splash
  index.tsx              # welcome / entry
  (tabs)/_layout.tsx     # bottom tabs
src/
  components/            # shared UI primitives (ScreenContainer, AppText, Card, PrimaryButton,
                         #   Chip, ScreenHeader, EmptyState, ErrorState, Loading)  ← reused
  theme/                 # design tokens (colors, spacing, typography, index) ← reused
  types/                 # domain types (resource, need)
  lib/                   # small utilities (geo, hours)
  services/              # resources + ai service seams (see below)
  features/              # feature modules (resources, …)
```

> The legacy feature screens have been removed; Frontline screens are built per phase under
> `app/` and `src/features/`.

## Proposed Frontline layout (added with approval, per phase)

```
src/
  types/                 # cross-feature domain types (resource.ts, need.ts, profile.ts)
  services/
    resources/           # ResourceService interface + mock implementation + seed data
    ai/                  # AiService interface + templated implementation (real API later)
  features/
    needs/               # "What do you need help with?" guided flow
    resources/           # list, cards, detail, "what to bring" checklist
    map/                 # map + discovery (reuses react-native-maps)
    saved/               # saved resources/benefits/scripts/checklists
    profile/             # optional-only veteran preferences
  components/            # shared UI primitives (grows only on 2nd real use)
  theme/                 # design tokens
  lib/                   # small shared utilities (distance, time formatting, etc.)
```

## Rules

- **Feature-first.** A feature owns its screens, components, hooks, and types.
- **Services are shared seams.** `services/resources` and `services/ai` expose typed interfaces;
  screens depend on the interface, never the concrete mock. See [[Technical Architecture]].
- **Shared only when reused.** Promote to `components/` or `lib/` on the *second* real use.
- **Small, focused files.** Split when a file stops being scannable. No giant files.
- **Consistent naming.** `PascalCase` components, `camelCase` functions, feature-consistent file
  names. No `Thing`, `Data`, `Card2`.
- **Mock/templated data is labeled.** Exports named `mock*` / `seed*` / `templated*`; kept out of
  production paths conceptually. See [[Anti-AI-Slop Code Rules]].
- **One place per concept.** No duplicate components doing the same job.

## Related

[[Technical Architecture]] · [[Resource Data Model]] · [[AI Feature Design]] · [[Anti-AI-Slop Code Rules]] · [[File Creation Policy]]
