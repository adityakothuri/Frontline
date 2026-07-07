---
tags: [build-log]
date: 2026-07-06
phase: "Phase 1 — App Shell"
task: expo-router app shell + Manrope design system
status: done
---

# 2026-07-06 — Phase 1 App Shell

## Task
Build the polished, navigable app shell on top of the Phase 0 foundation: navigation, an entry
flow, a design-token system, reusable components, and a Home dashboard — designed, not templated.

## Scope
- **In scope:** expo-router navigation (welcome → bottom tabs), Manrope typography, dark design
  tokens, reusable UI primitives, Home dashboard with believable mock data, and loading/empty/
  error states.
- **Explicitly out of scope:** real cameras/detection/map data/alert posting/backend/auth/AI
  (Phases 2–7); state-management library; gesture-handler/reanimated; tests.

## Decisions (see [[Decision Log]])
- **Navigation → expo-router** (confirmed with user) — resolves the open navigation decision.
- **Typography → Manrope** (confirmed with user), loaded behind a splash gate.
- Design tokens as a plain typed module (no context); one static dark theme.

## Changes
| File | Change | New? (approved?) |
|------|--------|------------------|
| package.json | `main` → `expo-router/entry`; +10 deps via `expo install` | edited |
| app.json | scheme, dark UI, expo-router/splash plugins, typedRoutes, metro web | edited |
| tsconfig.json | `@/*` path alias + typed-routes include | edited |
| index.ts, App.tsx | **deleted** (replaced by expo-router `app/`) | removed |
| app/_layout.tsx | root Stack + Manrope/splash font gate | new — approved |
| app/index.tsx | welcome / demo-entry screen | new — approved |
| app/(tabs)/_layout.tsx | bottom tabs (dark, Ionicons, Manrope) | new — approved |
| app/(tabs)/{home,cameras,map,review,profile}.tsx | Home dashboard + 4 placeholder tabs | new — approved |
| src/theme/{colors,spacing,typography,index}.ts | typed design tokens | new — approved |
| src/components/*.tsx (8) | AppText, ScreenContainer, ScreenHeader, Card, PrimaryButton, EmptyState, Loading, ErrorState | new — approved |
| src/mock/dashboard.ts | labeled simulated Home summary | new — approved |

Deps added (SDK-57 pinned): expo-router, react-native-safe-area-context, react-native-screens,
expo-linking, expo-constants, expo-status-bar, @expo/vector-icons, expo-font, expo-splash-screen,
@expo-google-fonts/manrope. **Not** added: gesture-handler, reanimated, any state lib.

## Quality checks
- **verify** (`tsc --noEmit` + `eslint .`): ✅ pass (exit 0)
- **prettier** (`--check .`): ✅ clean
- **expo-doctor**: ✅ 20/20
- **eslint** under `--max-warnings 0`: ✅ zero warnings (fixed a `react-hooks/set-state-in-effect`
  error in home.tsx and `import/first` in theme/index.ts during the build)
- **test**: n-a (placeholder, skipped by CI + hook)
- **boot / bundle proof**: ✅ `expo export --platform ios` bundled `expo-router/entry.js`
  (**1139 modules**), all 4 Manrope weights + Ionicons exported, no errors.

## Reviews
- **ui-reviewer:** ✅ **PASS with minor revisions** — confirmed the shell does not look
  AI-generated and clears every anti-slop tell. Two "before done" items **applied**:
  - **P1 (a11y):** `textMuted` `#647087` → `#7A8699` (now 5.08 / 4.83 / 4.54:1 — clears WCAG AA).
  - **P2 (consistency):** stopped using the interactive accent as a neutral data color in
    `home.tsx` (split into `statValueColor` neutral→textPrimary + `dotColor` neutral→textSecondary).
  - P3 items logged as backlog (skeleton loading, `+not-found`, route pending-review into Review).
- **qa-tester:** ✅ **PASS (genuinely done)** — re-ran all gates (verify/prettier/expo-doctor
  exit 0, bundle 1139 modules), confirmed entry integrity (old files gone, no dangling refs),
  scope discipline (no Phase 2+ logic/deps), token/type safety (no hex outside colors.ts, no
  `any`, all text via AppText), and the Manrope splash gate end-to-end.
- **/slop-check:** ✅ pass — small focused files (largest 145 lines), honest labeled mock data,
  no unauthorized files/deps.

## Logs updated
- [x] app_walkthrough → [[app_walkthrough]] ("App Shell — Navigation & Design System")
- [x] decision log → [[Decision Log]] (Phase 1 entry; navigation open-decision resolved)
- [ ] bug log — none
- [x] Command Center → [[Watchdog Command Center]] (phase → Phase 1 done; next → Phase 2)

## Risks / follow-ups
- **Not committed at time of writing on a Phase 1 branch** — see next step. Push still blocked on
  `gh auth login` (no remote).
- **11 moderate npm audit vulns** — all trace to one upstream `uuid` advisory via Expo build
  tooling only (0 high/critical, not in runtime app code). Deferred.
- **ui-review P3 backlog:** Home skeleton loading; themed `app/+not-found.tsx`; give Home one
  primary action by routing the pending-review stat into Review (once Review exists).
- Home's error branch is defensive (the mock never rejects) — real failure paths arrive with a
  real service. typedRoutes' strict types generate on `expo start` (gitignored).

## Next step
**Phase 2 — Camera Simulation:** build `src/features/cameras/` (simulated camera list + status +
mock feed/timeline) behind the Cameras tab, reusing the tokens/components. See
[[Phase 2 Camera Simulation]].
