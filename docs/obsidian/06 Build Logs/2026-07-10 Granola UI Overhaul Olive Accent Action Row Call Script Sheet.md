---
tags: [build-log, design-system, resources, onboarding, motion]
date: 2026-07-10
status: done
---

# 2026-07-10 — Granola UI overhaul: olive accent, action row, call-script sheet, motion

Full UI/UX polish pass over the whole app (user-requested), preserving all MVP functionality.
Four approved new files, zero new dependencies. Architecture pass by `react-native-architect`;
reviewed by `ui-reviewer` + `qa-tester`, with their findings and the user's on-device feedback
(gray-ish first olive, stretched action tiles) fixed in the same task.

## Theme — olive accent + text-grade amber (`src/theme/colors.ts`)
- `accent` acid-lime `#B5C832` → **true olive `#5F7326`** (first candidate `#5A6440` read gray on
  device and was replaced). `accentPressed #4C5C1E`, `accentSoft rgba(95,115,38,0.14)`,
  `textOnAccent` flipped dark → paper-white `#FBF8F0` (5.0:1 on olive; 4.7:1 accent-on-background).
- New **`warningText #8F5D16`** — amber as small text was 3.4:1 (AA fail) on the trust labels;
  `STATUS_TONE_COLOR.warning` now maps to it (5.3:1). `warning #B7791F` remains for dots/icons.
- `AiContentBlock` tag/disclaimer and `SummaryLine` labels moved `textMuted` → `textSecondary`
  (the muted gray composited to 3.8:1 over the accent-tinted block).

## Resource detail restructure (`src/features/resources/`)
- **Pinned Call/Directions footer removed.** New **`ActionRow.tsx`**: compact auto-sized pills
  directly under the header — Call (olive-filled) · Directions · Save · Share · Call script.
  Share uses RN's built-in `Share` API; Save moved here from the route header (exactly one Save
  control; `app/resource/[id].tsx` header bookmark deleted). `recordEngagement` still fires for
  call/directions via props from `ResourceDetail`. Pills wrap on narrow screens, ≥44pt.
- **Call script now opens in a bottom sheet.** New generic **`src/components/BottomSheet.tsx`**
  (RN `Modal` + `Animated`, no deps): slide-up + backdrop fade, exit-animation-before-unmount,
  Android back via `onRequestClose`, safe-area bottom, inner ScrollView, reduce-motion honored.
  New **`CallScriptSheet.tsx`** hosts the unchanged `CallScriptCard` (still generates on open
  only). The script trigger is hidden for phone-less resources (qa-tester finding).
- Contact rows bumped to ≥44pt; AI block titles promoted to `heading` (they were quieter than the
  lesser sections — hierarchy inversion, ui-reviewer finding).

## Skeleton loading (`src/components/Skeleton.tsx` new)
- Opacity-pulse placeholder (native driver, loop stopped on unmount, hidden from screen readers;
  containers keep `progressbar` role + label). Used by `AiContentBlock` and a card-shaped
  `ResultsSkeleton` in `app/results.tsx` (replaces the centered spinner).

## Motion & transitions
- Stack pushes: `ios_from_right` + `fullScreenGestureEnabled` on results/detail; entry
  gate/onboarding/tabs swap with `fade` (`app/_layout.tsx`). Tabs cross-`fade`
  (`'shift'` avoided — shimmers against the native map).
- Results list⇄map toggle eased with a one-shot `LayoutAnimation` (`app/results.tsx`).
- `PrimaryButton` presses now spring down slightly (scale 0.97) on top of the color shift.
- Onboarding progress bar animates from the previously shown step **in both directions**
  (`previousStepIndex` prop; back-nav used to snap low then grow — qa-tester finding); track 5→4px;
  `accessibilityValue` added.

## Visual polish
- `Card` gains a whisper shadow (0.05/r10/y3, elevation 1) over the hairline border;
  `NeedCategoryCard` + Discover's `MiscCard` now compose `Card` (duplicate card styling deleted).
- Home greeting promoted to `display` (32pt Fraunces) — the front-door moment.
- Card quick-action icons unified to the olive "actionable" color.
- Official Online Sources widget untouched (already matches the spec: per-category, 3–5 links,
  supporting — not a tab).

## Checks
- `npm run verify` (typecheck + lint) — **passes clean** after every batch.
- Full iOS JS bundle exported to Hermes bytecode successfully (runtime import sanity).
- `qa-tester`: PASS (its two minor findings fixed in-task). `ui-reviewer`: needs-revision on three
  contrast/tap-target findings — all fixed in-task. `/slop-check`: pass.
- ⚠️ Still needs an on-device tap-through: sheet open/close on Android (back button), share sheet,
  pill wrap on small screens, list⇄map LayoutAnimation on Android hardware.
