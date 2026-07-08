---
tags: [roadmap, phase-1, mvp]
status: done
updated: 2026-07-07
---

# Phase 1 — App Shell & Design System

## Purpose

A polished, premium app shell and a reusable design system. **Built in the previous product and
reused by Frontline** — the tokens, generic components, and navigation shell are product-agnostic
and carry over intact. Frontline reframes the *content*, not the shell.

## Reused as-is

- **Design tokens** — `src/theme/` (colors, spacing/radii, Manrope typography, mapStyle, index).
- **Generic components** — `ScreenContainer`, `AppText`, `Card`, `PrimaryButton`, `ScreenHeader`,
  `EmptyState`, `ErrorState`, `Loading`.
- **Navigation shell** — `expo-router` root stack + bottom tabs, fonts/splash gating, the
  `loading | error | ready` screen pattern.

## Changing in Frontline (later phases, not here)

- The **welcome** copy/wordmark and the **tab set** become Frontline (Home "What do you need help
  with?", Resources, Map, Saved, Profile) — done as those feature phases land.
- Legacy Watchdog feature screens (home/map/alerts/report) are **replaced**, not extended, starting
  in [[Phase 2 Resource Data Model and Service]].

## Definition of done (met)

- App launches; navigation works; design tokens exist and are used consistently.
- All shell screens have loading/empty/error states.

## Risks

- Carrying over Watchdog product *semantics* by accident — re-check color meanings (green=verified,
  amber=unverified, red=emergency) per [[UI Design System]] as screens are rebuilt.

## Related

[[Screens List]] · [[UI Design System]] · [[Technical Architecture]] · [[Phase 2 Resource Data Model and Service]]
