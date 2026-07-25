---
tags: [build-log]
date: 2026-07-25
phase: "Visual polish — beautiful upgrade"
task: Per-category visual identity + warm depth (make different opportunities look different)
status: done
---

# 2026-07-25 — Beautiful upgrade: per-category identity + warm depth

## Task
Make the app "really amazing" — the user's instinct was *"maybe different opportunities look
different?"* Two exploration sweeps + the `impeccable` design skill + the app's own `PRODUCT.md`
confirmed the biggest lever: category color is defined for every category but used only on ~14px
glyphs. Turn it into a **per-category visual identity** while staying calm/premium ("a steady
caseworker, not a startup"). Chosen with the user: *richer & warmer*, *full cohesive pass*.

## Design guardrails honored
- Category color is a **semantic identity layer** (like green=verified); **olive stays the only
  action color** (buttons/links unchanged). Verified no category hue leaks onto an action.
- **No colored side-rails** (an explicit design-rule ban) — identity comes from **medallions + soft
  tints**, not stripes.
- **AA contrast**: tints stay light (`surfaceTint` ~6–14%, `withAlpha` ≤0.16); text stays on ink.
- **Restrained motion** (product register: no orchestrated page-load) — one quiet fade on Home; a
  press/preview spring; a shared reduce-motion source.

## Changes
**Foundation (new):**
- `src/theme/categoryVisual.ts` — `categoryVisual(hue)` → `{ tint, wash, border }`, `surfaceTint()`
  (alpha-composites a hue over the paper surface → a solid, AA-safe wash), `medallionStyle()`. No
  duplicated hexes — consumers pass `meta.color`.
- `src/components/CategoryMedallion.tsx` — the shared category glyph (icon in its hue on a soft tint),
  generalizing the old NeedCategoryCard pattern.
- `src/hooks/useReducedMotion.ts` — one shared reduce-motion hook (also fixes `ResourcePreview`, which
  ignored the setting).
- `AppText` — optional `rawColor` for the rare category-hued text.

**Surfaces:**
- `ResourceCard` / `ResourcePreview` / `NeedCategoryCard` — medallion-led layout + a whisper
  `surfaceTint` card wash + a divider; a list now reads as a color-coded, varied set.
- `ResourceDetail` — a full-bleed **category hero** (soft `surfaceTint(color,0.14)` zone, rounded
  bottom, 60px medallion, Fraunces title) so each resource type opens with a distinct identity.
- `home.tsx` — a soft olive-washed hero panel + compass brand mark + a quiet fade (was bare text).
- `CategoryShells` — a shell chip that **keeps its icon on select** and wears its category hue as
  tint+border.
- `EmptyState` — a warm olive medallion (not a cold gray circle).
- `AiContentBlock` — accent-tinted border + soft lift (an "intelligent" surface).
- `ResourceMap` — a ground shadow on pins (lifted cartography).

## Dependency decision
Started with `expo-linear-gradient` for gradient washes, but it's a **native module** — the running
dev client predates it, so `LinearGradient` rendered as an "Unimplemented component" error box (would
need a full native dev-client rebuild). Pivoted to **dependency-free solid category tints**
(`surfaceTint`), which achieve the warm, per-category look without the native rebuild and keep the
minimal-deps discipline. `expo-linear-gradient` uninstalled.

## Quality checks
- `npm run verify` (typecheck + lint) **green**; `npm test` **35/35 green**.
- **Validated on the iOS sim**: healthcare vs legal detail heroes read as distinct premium pages; the
  Discover list reads as color-coded (ochre Food medallion + wash vs green Legal); the Home hero panel
  has real presence. Contrast holds on every tint.
- ui-reviewer + `/slop-check`.

## Logs updated
- [x] this build log · [x] `app_walkthrough` · [x] Decision Log · [x] Command Center

## Risks / follow-ups
- Kept the Skeleton opacity pulse (a clean dep-free shimmer really wants a gradient) and left
  Discover's spinner as-is — deliberate light-touch, low ROI.
- The pre-existing Discover deep-link-before-profile race still applies (documented earlier; not a
  regression of this branch).

## Next step
On branch `feature/beautiful-category-identity` — ready to PR/merge. Optional future: a gradient
vocabulary if a native rebuild is done.
