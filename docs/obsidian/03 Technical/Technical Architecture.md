---
tags: [technical, architecture, source-of-truth]
status: stable
updated: 2026-07-05
---

# Technical Architecture

Target stack and shape of the app. **Nothing here is built without approval** (see
[[File Creation Policy]]). This is the intended architecture, kept deliberately simple.

## Stack (intended)

- **React Native + Expo** (managed workflow), **TypeScript-first**.
- **Navigation**: React Navigation (structure decided in [[Phase 1 App Shell]]; use the
  `react-navigation` and `react-native-architect` skills; verify APIs with Context7).
- **State**: start with local component state + lightweight context. Add a state library only
  when a real need appears — record it in [[Decision Log]]. No premature Redux/Zustand.
- **Data (MVP)**: in-memory / local **mock** modules with clearly typed models. No backend.
- **Backend (post-MVP)**: Supabase or Firebase — Priority 9, not before the frontend loop is
  clean. See [[Phase 7 Backend Integration]].
- **AI/vision (post-MVP)**: simulated in MVP; real pipeline is Priority 10.

## Layering

```
UI (screens, components)
      │  reads/writes via
      ▼
Feature modules (hooks, view-models, domain logic)
      │  uses
      ▼
Domain types + mock data (typed models, simulated services)
```

- UI stays thin; logic lives in feature hooks/services.
- Domain **types** are the contract. Mock services return typed data so swapping in a real
  backend later is a drop-in, not a rewrite.

## Warnings (avoid premature complexity)

- ❌ No backend, auth provider, database schema, or real model in the MVP.
- ❌ No global state library, dependency-injection framework, or monorepo tooling "just in case."
- ❌ No abstractions without a second concrete use. See [[Anti-AI-Slop Code Rules]].
- ✅ Keep simulated services behind the same typed interface a real service would implement,
   so the seam is honest and swappable.

## Related

[[Folder Structure]] · [[Environment Variables]] · [[Quality Gates]] · [[Phase 1 App Shell]] · [[File Creation Policy]]
