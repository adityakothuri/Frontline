---
tags: [build-log, phase-8, profile, onboarding]
date: 2026-07-08
status: done
---

# 2026-07-08 — Extended profile + multi-step account setup

The single-screen onboarding became a real **account-setup wizard** collecting an **extended
profile**; the Profile tab became a full editable form; and the preferred **radius now personalizes
search**. On-device only, privacy-first (no sensitive data). Architect-reviewed; pure-JS, no rebuild.

## Model + store
- `src/types/profile.ts` — `VeteranProfile` gains optional **`role?` (`VeteranRole`)**,
  **`documentsOnHand?` (`VeteranDocument[]`)**, **`preferredRadiusMiles?`**. Added `VETERAN_ROLE_LABELS`
  + `ROLE_OPTIONS` + `RADIUS_OPTIONS` (5/10/15/25/50 mi) + a `ProfileDetails` edit-subset type.
- `src/types/need.ts` — exported `DOCUMENT_OPTIONS`; `defaultNeedForCategory(category, zip?,
  radiusMiles = DEFAULT_RADIUS_MILES)`.
- `profileStorage.ts` — **tolerant load** of the 3 new fields (validate enum/array/number; legacy
  profiles without them load fine).
- `ProfileContext.tsx` — `saveDetails(details: ProfileDetails)` merge: provided key overwrites,
  omitted untouched; preserves `createdAt`, sets `onboardingComplete`.

## Setup wizard — `app/onboarding.tsx` (rewritten)
A single route driving an internal **step machine + draft** (no route-per-step): **Name (required)
→ ZIP (required, 5 digits) → Role (optional) → Documents (optional, multi) → Radius (optional) →
Done**. Required steps gate Continue; optional steps offer **Skip for now**; Back revises; finish
saves the whole draft once → `replace('/home')`. The `index.tsx` first-run gate is unchanged (new
users / post-reset land here).

## New shared components
- `src/components/TextField.tsx` — labeled styled input (removed the 4× `TextInput` duplication).
- `src/components/OptionGroup.tsx` — generic single/multi-select chip group over `Chip`; option lists
  come from the type files (`ROLE_OPTIONS`/`RADIUS_OPTIONS`/`DOCUMENT_OPTIONS`) so nothing's duplicated.
- `src/features/onboarding/OnboardingStep.tsx` — the step scaffold (progress dots + accessible
  "Step N of M" + prompt + Back/Skip/Continue footer).

## Profile tab — `app/(tabs)/profile.tsx` (full form)
Replaced the view↔edit toggle with **one always-editable form** (name/ZIP `TextField`s + three
`OptionGroup`s), reusing the same components as the wizard. Save (gated on name + 5-digit ZIP) with a
brief "Saved ✓"; Reset unchanged. Syncs from the store on change (handles re-setup).

## Search personalization
`app/results.tsx` **and** `ResourceDetail.tsx` both pass `profile?.preferredRadiusMiles` into
`defaultNeedForCategory`, so the chosen radius reaches search and the two views agree.

## Scope
Fields chosen privacy-first: role, documents, radius. **Disability rating deliberately omitted**
(too sensitive for this pass). Role + documents are stored/shown (natural AI tie-ins later); radius
is wired now. This completes the extended-profile slice of Phase 8.

## Checks
- `npm run verify` (typecheck + lint) — **passes clean**. Pure-JS, no native rebuild.
- App hot-reloaded healthy (Home renders; existing complete profile correctly skips the wizard).
- ⚠️ The wizard + profile form not screenshot-able here (gated behind first-run; no sim tap tooling).

## Risks / follow-ups
- On-device: **Profile → Reset** → Welcome → the **6-step wizard** (Name/ZIP block Continue; the rest
  Skip); finish → greeted Home. Profile form edits all fields + persists across reload. Set a small
  **radius** → Results returns closer/fewer.
- `saveDetails` merge can't *clear* role/radius via `??` (documents clear via empty array) — fine for
  a settings form; note if clearing is wanted later.
- `ui-reviewer` (wizard flow, progress, chip groups, form) + `qa-tester` (required gating, skip,
  persistence, legacy profile) once the account session limit resets.

## Related
[[Phase 8 Saved and Profile]] · [[app_walkthrough]] · [[Decision Log]] · [[Frontline Command Center]] ·
[[Trust Safety and Privacy]]
