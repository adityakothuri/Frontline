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

> _The app **shell** now exists — expo-router navigation, a Manrope + dark design system, an
> entry flow, and the five tab screens (see the two entries below). Real features (cameras,
> detection, map, posting) are Phases 2+. Add new entries newest at the bottom, using
> [[App Walkthrough Template]]._

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

## App Shell — Navigation & Design System

### Date Added
2026-07-06

### Purpose
Turn the bare foundation into a navigable, on-brand app: an entry flow, bottom-tab navigation, a
design-token system, reusable UI primitives, and a Home dashboard — all _designed, not templated_.
Still shell-only: no real cameras, detections, map data, or posting.

### User Flow
Launch → the native splash holds until Manrope loads → **Welcome** ([app/index.tsx](../../../app/index.tsx)):
wordmark + tagline + "Enter demo mode" → `router.replace('/home')` into the **bottom tabs**. Tabs:
Home (live dashboard) and Cameras / Map / Review / Profile (designed placeholders). Home shows a
brief loading state, then a greeting, three stat cards, and a recent-activity list; a failed load
shows a retry-able error state.

### Important Files
| File | Purpose |
|---|---|
| [app/_layout.tsx](../../../app/_layout.tsx) | Root Stack; loads 4 Manrope weights behind an expo-splash-screen gate; renders null until ready. |
| [app/index.tsx](../../../app/index.tsx) | Welcome / demo-entry screen; `router.replace('/home')`. |
| [app/(tabs)/_layout.tsx](../../../app/%28tabs%29/_layout.tsx) | Bottom Tabs; dark-themed bar, Ionicons, Manrope labels. |
| [app/(tabs)/home.tsx](../../../app/%28tabs%29/home.tsx) | Home dashboard; loading/error/content over the mock summary. |
| app/(tabs)/{cameras,map,review,profile}.tsx | Placeholder tabs with designed empty states. |
| src/theme/{colors,spacing,typography,index}.ts | Typed design tokens (single source of truth). |
| src/components/*.tsx | Reusable primitives: AppText, ScreenContainer, ScreenHeader, Card, PrimaryButton, EmptyState, Loading, ErrorState. |
| [src/mock/dashboard.ts](../../../src/mock/dashboard.ts) | Clearly-labeled simulated Home summary + `getDashboardSummary()`. |

### How The Code Works
expo-router boots `expo-router/entry` → `app/_layout.tsx`. The root Stack keeps the native splash
up (`SplashScreen.preventAutoHideAsync()`), loads Manrope via `useFonts`, hides the splash when
ready, and renders the Stack (welcome → tabs). Every screen wraps content in `ScreenContainer`
(SafeArea + dark background + padding) and renders text through `AppText`, which applies a Manrope
weight + a scale variant — so type and color never drift from the tokens. Home calls
`getDashboardSummary()` in an effect and switches between `Loading`, `ErrorState` (retry), and
content; state is only set from the async callbacks (never synchronously in the effect).

### Data Flow
`src/mock/dashboard.ts` → `getDashboardSummary()` (a labeled _simulated_ async call) →
`home.tsx` local state → stat cards + activity list. No global state, no backend. The other four
tabs render static `EmptyState`s (no data source yet).

### Important Types / Components / Functions
Tokens: `colors`, `spacing`, `radii`, `fonts`, `textVariants` (+ `theme`) — all `as const`, with
`ColorToken` / `TextVariant` / `Tone` types. Components: `AppText` (variant + color),
`ScreenContainer` (SafeArea edges), `EmptyState` / `Loading` / `ErrorState` (shared state
patterns). Domain: `DashboardSummary`, `DashboardStat`, `ActivityItem`, `Tone`.

### Temporary or Mock Parts
`src/mock/dashboard.ts` is entirely simulated (labeled in-file and on-screen: "Demo mode —
simulated"). `getDashboardSummary()` uses a `setTimeout` to mimic a network call so Home can
exercise its loading state — a real service replaces it behind the same signature. The four
placeholder tabs are intentionally featureless (their real screens are Phases 2–6).

### How To Extend This Later
Add a screen = add a file under `app/`. Feature screens (cameras, detection review, map, posting)
each get a `src/features/<name>/` folder (with approval) owning their screens/hooks/types/mock,
consumed by the matching route. Swap the mock service for a real one behind the same typed
interface. Build new shared components only on the second real use.

### Related Logs
Build log: [[2026-07-06 Phase 1 App Shell]]

### Related Decisions
[[Decision Log]] — "2026-07-06 — Phase 1 app shell: expo-router navigation + Manrope + typed design tokens".

### Risks / Notes
- typedRoutes' strict route types generate on `expo start` (gitignored); typecheck passes without them.
- Home's error branch is defensive wiring — the mock never rejects, so it isn't hit in the demo.
- Backlog (from ui-review): skeleton loading for Home, a themed `app/+not-found.tsx`, and routing
  the "pending review" stat into the Review tab once it exists (gives Home one primary action).

---

## Related

[[Watchdog Command Center]] · [[App Walkthrough Template]] · [[Production Workflow]] · [[Decision Log]]
