---
tags: [walkthrough, source-of-truth, living-doc]
status: living
updated: 2026-07-05
---

# App Walkthrough

This file explains how Watchdog works as the codebase grows. It should be updated after every
meaningful feature or architecture change. It is **not just a changelog** — it is a guided
explanation of how the app actually works, so you can understand your own codebase without
digging through files blindly.

## How To Use This File

Read this when you want to understand the codebase without digging blindly through files. Each
feature entry explains:

- purpose
- user flow
- important files
- how the code works
- data flow
- temporary/demo parts
- future improvements

## When Claude MUST update this file

After any **moderate or meaningful** change:

- new screen · new feature folder · new user flow · new state-management logic
- new API/backend logic · new database schema · new navigation structure
- new design-system implementation · new reusable component pattern
- important refactor · a bug fix that changes how a flow works

**Do not** update for typo fixes, formatting-only changes, or trivial copy changes.

Add new feature entries **newest at the bottom** (chronological), using the entry format from
[[App Walkthrough Template]]. Link the related [[Build Log Template|build log]] and
[[Decision Log]].

---

# Feature Walkthroughs

> _The app **foundation** now exists (Expo SDK 57 + TypeScript). No user-facing **features**
> yet — screens, navigation, and the design system arrive in **[[Phase 1 App Shell]]**. Add new
> entries newest at the bottom, using [[App Walkthrough Template]]._

<!-- Copy the entry template from [[App Walkthrough Template]] for each new feature. -->

## App Foundation (Expo + TypeScript shell)

### Date Added
2026-07-06

### Purpose
The minimal, bootable Expo + React Native + TypeScript project that every future feature builds
on. Phase 0's job is a clean, honest starting point — it deliberately contains **no** features,
navigation, state, backend, or designed UI yet.

### User Flow
Launch the app (`npm start`, then a simulator / Expo Go) → it boots to the default Expo blank
screen: a centered _"Open up App.tsx to start working on your app!"_. That is the whole surface
today; the real entry flow (demo mode / sign-in → dashboard) is [[Phase 1 App Shell]].

### Important Files
| File | Purpose |
|---|---|
| [index.ts](../../../index.ts) | Entry point — `registerRootComponent(App)` (Expo's `"main"`). |
| [App.tsx](../../../App.tsx) | Root component — untouched blank-template placeholder screen. |
| [app.json](../../../app.json) | Expo config: app name `Watchdog`, slug `watchdog`, icons/splash. |
| [tsconfig.json](../../../tsconfig.json) | TypeScript `strict: true`, extends `expo/tsconfig.base`. |
| [package.json](../../../package.json) | Deps + scripts (`start`/`typecheck`/`lint`/`format`/`verify`). |
| [eslint.config.js](../../../eslint.config.js) | ESLint 9 flat config (`eslint-config-expo` + Prettier), scoped to app source. |
| [.prettierignore](../../../.prettierignore) | Keeps Prettier to app code (not docs/tooling). |
| assets/ | Expo icon/splash/favicon PNGs from the template. |

### How The Code Works
Expo boots `index.ts`, which calls `registerRootComponent(App)` to register the root React
component with React Native's `AppRegistry`. `App.tsx` renders a single centered `View`/`Text`
plus `expo-status-bar`. There is no navigation, state, or data layer yet — intentionally.
`tsc --noEmit` typechecks and `eslint .` lints (both wired into `npm run verify`); Metro bundles
`index.ts` → `App.tsx` (580 modules) into a working Hermes bundle.

### Data Flow
None yet. No mock services, hooks, or domain types exist — those land per-feature from Phase 1,
behind typed interfaces (see [[Technical Architecture]]).

### Important Types / Components / Functions
Just `App` (the root component) and `registerRootComponent` (Expo). Domain types come later.

### Temporary or Mock Parts
`App.tsx` is the **default Expo placeholder** — honestly a starting point, not a designed
screen. It is replaced in [[Phase 1 App Shell]] once navigation and the design system exist.

### How To Extend This Later
Phase 1: decide navigation (expo-router vs React Navigation — still open in [[Decision Log]]),
add the `src/` feature-based tree ([[Folder Structure]]) with approval, introduce design tokens
([[UI Design System]]), and replace `App.tsx` with the real app shell / first screens.

### Related Logs
Build log: [[2026-07-06 Phase 0 App Foundation]]

### Related Decisions
[[Decision Log]] — "2026-07-06 — Phase 0 app foundation: Expo SDK 57, blank-TypeScript, npm".

### Risks / Notes
- New Architecture is default-on (SDK 57) — re-verify native-module compatibility when maps /
  camera are added.
- `watchman` is not installed locally (Metro falls back to Node's watcher — non-fatal).
- Local Node 24 vs CI Node 20: both satisfy RN 0.86's engine range.

---

## Related

[[Watchdog Command Center]] · [[App Walkthrough Template]] · [[Production Workflow]] · [[Decision Log]]
