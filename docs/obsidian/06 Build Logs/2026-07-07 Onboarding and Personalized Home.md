---
tags: [build-log, onboarding, profile]
date: 2026-07-07
status: done
---

# 2026-07-07 — One-time setup + personalized home greeting

## What was built

A **one-time account setup** that captures the veteran's first name, and a home screen that greets
them by name (**time-aware**: "Good morning / afternoon / evening, {name}") above the existing
category grid. This is the onboarding + lightweight-profile slice of [[Phase 8 Saved and Profile]]
pulled forward at the user's request. It introduces the app's **first persistence layer**
(AsyncStorage) and **first shared state** (a small React Context) — both minimal and privacy-first
(first name only, nothing sensitive).

> Tracked as its own step, **not** roadmap "Phase 4" (which is resource detail pages). The user's
> "state 4" referred to this personalization feature.

### New dependency
- `@react-native-async-storage/async-storage` (via `npx expo install` — pinned Expo-compatible
  version). The documented Phase 8 persistence choice.

### New files
- `src/types/profile.ts` — `VeteranProfile` (`firstName`, `onboardingComplete`, `createdAt`).
  Minimal now; ZIP/role can be added as optional fields later without breaking stored data.
- `src/services/profile/profileStorage.ts` — typed AsyncStorage `loadProfile` / `saveProfile` /
  `clearProfile`, versioned key `frontline.profile.v1`, tolerant of missing/corrupt values.
- `src/services/profile/ProfileContext.tsx` — `ProfileProvider` + `useProfile()`. Hydrates from
  storage on mount, exposes `{ profile, isHydrated, saveFirstName, resetProfile }`. `saveFirstName`
  preserves the original `createdAt` when editing.
- `src/services/profile/index.ts` — barrel (provider, hook, type).
- `src/lib/greeting.ts` — pure `timeGreeting(date?)` helper (morning/afternoon/evening).
- `app/onboarding.tsx` — the setup screen: one name `TextInput` (styling mirrors the ZIP field in
  `need/[category].tsx`), "Continue" disabled until non-empty → `saveFirstName` → `replace('/home')`.

### Modified
- `app/_layout.tsx` — wraps the stack in `ProfileProvider`; registers the `onboarding` route.
- `app/index.tsx` — now a **first-run gate**: waits for hydration; returning users
  (`onboardingComplete`) `replace('/home')`; first-timers see the welcome → "Get started" pushes
  `/onboarding`.
- `app/(tabs)/home.tsx` — greeting title from `timeGreeting()` + `profile.firstName` (falls back to
  "What do you need help with?"); the category prompt moved into the subtitle. Grid unchanged.
- `app/(tabs)/profile.tsx` — replaces the stub: shows the saved name, inline **Edit name**, and
  **Reset setup** (confirm `Alert` → `resetProfile` → back to setup). Empty-state fallback if no
  profile (e.g. right after a reset).

## Checks

- `npm run verify` (typecheck + lint) — **pass**. As in Phase 3, the new `onboarding` route needed
  `.expo/types` regenerated via a brief Metro start (`expo export` does not write typed routes);
  once regenerated, tsc is clean.
- **`expo export --platform ios`** — **pass**: full JS graph bundles with no resolution errors.
- Not yet eyeballed in the Simulator — recommended next (dev build rebuild).

## Notes / scope

- **Privacy:** only `firstName` is stored on-device; no ZIP/role, no accounts/login/cloud sync.
- ZIP is still asked in the need flow as before (not captured at setup).
- The AI call-script "Hi, my name is ___" blank is **not** auto-filled from the profile yet — a
  natural follow-up once this lands.
- No reusable `TextField` component yet; the inline input is enough for one field (revisit in
  Phase 8 when ZIP/radius/documents arrive here).

## Next

Continue the documented roadmap: [[Phase 4 Resource List and Detail]] (resource detail page + call
script). Optional follow-up: autofill the veteran's name into the generated call script.

## Related

[[Phase 8 Saved and Profile]] · [[app_walkthrough]] · [[Decision Log]] · [[UI Design System]] ·
[[Trust Safety and Privacy]]
