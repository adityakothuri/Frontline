---
tags: [build-log, polish, color, animation, detail]
date: 2026-07-08
status: done
---

# 2026-07-08 — Polish: category color, tap motion, tighter detail page

Three UX-polish passes on user feedback ("feels rigid; add more color; the detail page feels random —
give it structure and put the call script behind a button").

## 1. Category color system
- Added a per-category **`color`** to `RESOURCE_CATEGORY_META` (`src/types/resource.ts`) and
  `NEED_CATEGORY_META` (`src/types/need.ts`) — 11/12 distinct muted hues that read on the paper base.
- New pure helper **`withAlpha(hex, alpha)`** in `src/theme/colors.ts` for soft tints.
- Applied: `NeedCategoryCard` icon chip (tinted bg + colored icon), `ResourceCard` /
  `ResourcePreview` / `ReviewPrompt` category icons, `ResourceDetail` header, and **map pins**
  (each pin now carries its category color; selected fills with it). This is a **categorization**
  color layer — distinct from the semantic verified/warning/danger colors, which keep their meaning.

## 2. Tap / entrance motion (RN `Animated`, no native dep)
- New **`PressableScale`** (`src/components/`) — springs the target down slightly while held, so taps
  feel tactile. Applied to the big cards: `ResourceCard`, `NeedCategoryCard`, Discover's `MiscCard`.
- **Map preview** (`ResourcePreview`) now **springs up + fades in** when a pin is tapped (keyed by
  resource id so it replays on each new pin) — fixes the "clicking places on the map feels rigid."

## 3. Detail page — structured + shorter + call script behind a button
- Reordered top-down: **header → what it is → what to do → what to bring → contact → trust →
  (optional) call script → Call/Directions**.
- **Header** now carries the category chip + name + a compact meta row (open-now + the simulated
  rating, moved up from the trust section).
- **Shorter AI summary**: dropped "Who it helps" and the duplicate "Source check" (trust owns that);
  kept What it is / Who may qualify / Heads-up. **Removed the separate Eligibility section** — it
  duplicated "Who may qualify."
- **Call script is now behind a button**: a "Get a call script" secondary button reveals
  `CallScriptCard`, which **auto-generates on reveal** (`need` memoized to keep the mount-generate
  stable) with the standard ⇄ "keep it simple" toggle — less thrown at the user up front.
- `need` is now `useMemo`'d; footer Call/Directions use a small `recordAnd` helper (dedup of the
  engagement-record wiring).

## Checks
- `npm run verify` (typecheck + lint) — **passes clean**.
- iOS Simulator — reloaded (pure-JS, no rebuild); app healthy, the **5-tab bar** (…·Map·…) renders.
- ⚠️ Interior screens (Discover/detail/map colors + the animations) not screenshot-able here (no sim
  tap tooling) — needs a human pass.

## Risks / follow-ups
- Eyeball on-device: card/preview spring feel; category colors on Discover cards + map pins + the
  detail header; the reordered detail page and the "Get a call script" reveal.
- The map marker `tracksViewChanges` window (~800 ms) must still cover the new per-pin colored icon
  render — verify pins paint their color before tracking stops.
- `ui-reviewer` + `qa-tester` once the account session limit resets.

## Related
[[app_walkthrough]] · [[Decision Log]] · [[UI Design System]] · [[Frontline Command Center]]
