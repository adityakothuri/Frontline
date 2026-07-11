---
tags: [build-log, ui, onboarding, profile, design]
date: 2026-07-09
status: done
---

# 2026-07-09 — Setup wizard + profile UI redesign

The multi-step setup and the profile edit screen were functional but plain. This pass makes them
feel premium, using the `impeccable` skill's **product register** (earned familiarity, one consistent
control vocabulary, motion that conveys state 150–250 ms). No structural/flow change — visuals only.

## New shared control
- `src/components/SelectableOption.tsx` — a full-width selectable **row**: leading tinted icon chip +
  label (+ optional description) + a trailing check (radio for single / checkbox for multi). Clear
  default vs selected states (accent border + `accentSoft` fill when selected); springs on press
  (`PressableScale`). This is now the shared premium control for list-style choices.
- `src/components/OptionGroup.tsx` — gained a **`variant`** prop: `pill` (compact `Chip`s, default,
  e.g. radius) or `row` (renders `SelectableOption`, e.g. role/documents). Same single/multi selection
  logic drives both looks, so wizard and profile stay consistent.
- `ROLE_OPTIONS` (`src/types/profile.ts`) now carry per-role **icons** (ribbon/shield/people/heart/…).

## Setup wizard — `src/features/onboarding/OnboardingStep.tsx` (redesigned)
- A **slim progress bar** that fills by step + a "Step N of M" label and a **back chevron** in a top
  bar (Back moved out of the footer).
- A per-step **icon hero** (large tinted rounded square, a distinct category color per step) over a
  big **Fraunces** prompt + Inter subtitle.
- Content **springs in** on every step (Animated fade + 14px rise, `Easing.out`, reduce-motion
  aware via `AccessibilityInfo`); the wizard keys each `OnboardingStep` by `step` so it replays.
- Scrollable body with a **pinned footer** (Continue + a centered "Skip for now" link), keyboard-aware.
- `app/onboarding.tsx` — role/documents now use the `row` variant; the **done** step shows a green
  check hero + a **recap** of what was entered (ZIP, role, documents, radius) before "Start exploring".

## Profile — `app/(tabs)/profile.tsx` (redesigned)
- A **profile header**: an avatar circle with the first initial (lime-tinted) + name (Fraunces) + a
  "Role · Near ZIP" subline.
- Clean **grouped sections** (Your details / I am a… / Documents / Search radius) using the same
  `TextField` + `OptionGroup` (row + pill) controls — one consistent vocabulary with the wizard.
- A prominent **Save changes** (with "Saved ✓") and a subtle destructive **Reset setup** at the
  bottom.

## Checks
- `npm run verify` (typecheck + lint) — **passes clean**. Pure-JS, no native rebuild; app reloaded
  healthy.
- ⚠️ **Not screenshot-able in this environment** — the wizard is gated behind first-run/reset and the
  Profile tab behind a nav tap (no sim tap tooling). Needs a human visual pass.

## Risks / follow-ups
- On-device: **Profile → Reset** → the redesigned 6-step wizard (icon heroes, progress, smooth step
  transitions, big selectable rows, recap on the last screen). Tap the **Profile** tab to see the new
  header + sectioned form. Confirm contrast + spacing feel right on a real device.
- `ui-reviewer` (hierarchy, contrast, selected states, motion) + `qa-tester` once the session resets.

## Related
[[2026-07-08 Extended Profile Multi-Step Setup]] · [[UI Design System]] · [[app_walkthrough]] ·
[[Frontline Command Center]]
