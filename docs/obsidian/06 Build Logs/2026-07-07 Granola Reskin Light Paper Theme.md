---
tags: [build-log, design-system, theme, typography]
date: 2026-07-07
status: done
---

# 2026-07-07 — Re-skin to a warm light "paper" theme (Granola-inspired)

## What was built

Flipped Frontline's whole visual identity from the original **dark navy** theme to a warm light
**"paper"** theme modeled on [granola.ai](https://www.granola.ai): off-white near-paper background,
an acid-lime accent for primary actions, near-black text, and a **Fraunces** (serif) + **Inter**
(sans) type pairing. Because every screen consumes design tokens and renders text through `AppText`,
the entire re-skin was a **centralized token swap** — no per-screen edits. See [[Decision Log]] and
[[UI Design System]].

### Palette repaint — `src/theme/colors.ts`
- Same token keys, new values. Foundation `background #F5F1E8` / `backgroundElevated #EFEADD`;
  surfaces `#FBF8F0` / `#EDE8DA` / border `#DED8C7`; text `#1A1A17` / `#57564F` / `#6F6D63`.
- Accent = Granola lime `#B5C832` (`accentPressed #9BAE24`); **`textOnAccent #1A1A17`** — dark text
  on lime (white fails contrast).
- Semantic retuned for a light background and kept meaningful: `success` = **deep emerald `#2E7D32`**
  (deliberately distinct from the lime accent so "verified" ≠ "primary action"), `warning #B7791F`,
  `danger #C0392B`. `overlay` → dark scrim `rgba(26,26,23,0.45)`.

### Typography swap — `src/theme/typography.ts`
- `fonts` now spans two families: Inter (`regular/medium/semibold/bold` = 400/500/600/700) for
  body/UI + Fraunces serif (`serifSemibold/serifBold` = 600/700) for display.
- `textVariants.display` and `.title` use the serif (line-heights nudged to 40/32 for the serif
  metrics); everything else stays Inter. Serif reserved for the largest statement headers only.

### Font loading + chrome — `app/_layout.tsx`
- `useFonts` now loads Inter 400/500/600/700 + Fraunces 600/700 (splash-hold guard unchanged).
- `<StatusBar style="light" />` → `"dark"` (dark icons on the light background).

### App config — `app.json`
- `userInterfaceStyle` `dark` → `light`; splash `backgroundColor` and Android adaptive-icon
  `backgroundColor` `#0B1220` → `#F5F1E8`.

### Dependencies — `package.json` / `package-lock.json`
- Removed `@expo-google-fonts/manrope`; added `@expo-google-fonts/inter ^0.4.2` and
  `@expo-google-fonts/fraunces ^0.4.1` (fraunces has no 0.4.2). `npm install` run.

### Stale-comment cleanup
- `src/components/AppText.tsx` and `app/(tabs)/_layout.tsx` comments updated from "Manrope" to the
  new families (no code change).

## Checks

- `npm run verify` (typecheck + lint) — **passes clean**.
- `npx expo export --platform web` — **bundles clean**; all 6 font TTFs resolve, no Manrope asset.
- Grep sweep — **no** remaining Manrope references or old dark hex values, and **no** hardcoded
  hex/rgba anywhere outside `src/theme/`.
- WCAG AA contrast on paper (`#F5F1E8`), computed by hand: `textPrimary` 15.5:1, `textSecondary`
  6.5:1, `textMuted` 4.6:1, `textOnAccent` on lime 9.4:1 — **all pass**.

> `ui-reviewer` / `qa-tester` subagents were launched but hit the account session limit before
> finishing; the equivalent contrast + regression checks above were done directly instead.

## Risks / follow-ups

- **Splash & app-icon artwork** still reads dark-era; only their background color changed. Redraw the
  foreground art for paper as a non-blocking follow-up.
- Fraunces at display/title sizes should get a real device visual pass (serif metrics differ from
  Manrope) — verify no clipping in the greeting hero / results header on a physical build.
- `serifSemibold` (Fraunces 600) is loaded but currently only `serifBold` is used by variants; kept
  for near-term heading use — drop the 600 weight if it stays unused.

## Related
[[UI Design System]] · [[Decision Log]] · [[app_walkthrough]] · [[Frontline Command Center]]
