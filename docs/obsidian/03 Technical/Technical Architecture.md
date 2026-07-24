---
tags: [technical, architecture, source-of-truth]
status: active
updated: 2026-07-07
---

# Technical Architecture

Target stack and shape of the app. **Nothing here is built without approval** (see
[[File Creation Policy]]). Kept deliberately simple; the MVP is frontend + typed mock services
behind interfaces a real backend/AI can later implement.

## Stack

- **React Native + Expo** (managed workflow / CNG), **TypeScript-first**. Runtime is a local
  **development build** (`expo-dev-client`) built with `expo run:ios`; Expo Go is a fallback.
- **Navigation**: `expo-router` (file-based, in `app/`), `expo-router/entry` as main — reused shell.
- **State**: local component state + lightweight context. Add a state library only when a real need
  appears — record it in [[Decision Log]]. No premature Redux/Zustand.
- **Design system**: reused `src/theme/` tokens + generic components (see [[UI Design System]]).
- **Data (MVP)**: in-memory / on-device **mock** modules behind a typed `resources` **service
  interface** (see [[Resource Data Model]]). No backend.
- **AI (MVP)**: a typed **`AiService`** interface with a **templated** implementation (deterministic,
  offline). Real Claude API sits behind the same interface later — via a **proxy** (keys never ship
  in the client). See [[AI Feature Design]].
- **Maps (MVP)**: `react-native-maps` (Apple Maps on iOS, no API key), dark-styled from the design
  tokens, category pins; ZIP or device location. See [[Map and Search Design]].
- **Persistence (MVP)**: saved items + profile stored **on-device** (e.g. AsyncStorage), added with
  approval when Phase 8 lands.
- **Backend (Phase 10 slice 1, built 2026-07-12)**: **Supabase** — Postgres (curated resources +
  ZIP centroids, RLS read-only anon) behind `SupabaseResourceService`, and a Deno Edge Function
  Claude proxy behind `ClaudeAiService`, both implementing the unchanged service interfaces. The
  client uses plain `fetch` (no supabase-js). Env absent → full offline mock/templated mode;
  resource runtime failures → error/retry UI (never silent mock data); AI failures → templated
  fallback. See [[2026-07-12 Phase 10 Supabase Backend and Claude Proxy]] and
  [[Environment Variables]]. Ingestion/accounts remain future slices —
  [[Phase 10 Backend and Data Ingestion]].

## Layering

```
UI (screens, components)
      │  reads/writes via
      ▼
Feature modules (hooks, view-models, domain logic)
      │  uses
      ▼
Service interfaces:  resources  ·  ai   (typed contracts)
      │  implemented by
      ▼
MVP: typed mock data (resources)  ·  templated responses (ai)
Later: real backend / real Claude API (behind the SAME interfaces)
```

- UI stays thin; logic lives in feature hooks/services.
- **Service interfaces are the contract.** Screens depend on `ResourceService` and `AiService`, not
  on concrete implementations — so swapping mock → real is a drop-in, not a rewrite. (The previous
  codebase imported mock data directly with no seam; Frontline fixes that in [[Phase 2 Resource Data Model and Service]].)

## Directory intent

`app/` routes · `src/theme` tokens · `src/components` shared UI · `src/features/*` feature modules ·
`src/services/{resources,ai}` typed service seams · `src/types` domain types · `src/lib` utils. See
[[Folder Structure]].

## Warnings (avoid premature complexity)

- ❌ No backend, auth provider, database schema, or **real LLM calls from the client** in the MVP.
- ❌ No global state library, DI framework, or monorepo tooling "just in case."
- ❌ No abstractions without a second concrete use. See [[Anti-AI-Slop Code Rules]].
- ✅ Keep simulated services behind the same typed interface a real service would implement.

## Related

[[AI Feature Design]] · [[Resource Data Model]] · [[Folder Structure]] · [[Environment Variables]] · [[Quality Gates]] · [[File Creation Policy]]
