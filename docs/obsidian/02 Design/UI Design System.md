---
tags: [design, source-of-truth]
status: stable
updated: 2026-07-05
---

# UI Design System

The visual identity of Watchdog: **calm, premium, serious, trustworthy.** Not childish,
cluttered, fearmongering, or template-like. This is the reference for every screen. See
[[Anti-AI-Slop Design Rules]] for what to avoid.

> Tokens below are **design direction**, not committed code. Concrete token files/values are
> created in Phase 1 with approval — see [[File Creation Policy]]. Prefer a small typed token
> module over scattered inline styles.

## Color direction

| Role | Direction | Notes |
|------|-----------|-------|
| Foundation | Dark **navy / charcoal** | The app's default surface. Calm, serious. |
| Surface / cards | Muted grays on the foundation | Rounded, low-contrast, quiet. |
| Primary text | Crisp **white** / near-white | High legibility on dark. |
| Secondary text | Muted gray | Hierarchy without noise. |
| Serious alert | **Red / orange** | Reserved for genuine alert emphasis only — never decorative. |
| Safe / confirm | **Green** | Approvals, safe/all-clear states. |
| Accent | One restrained accent | Used sparingly for primary actions. |

Rule: color carries **meaning**. Red/orange = a real alert. Green = safe/confirmed. Don't use
alert colors for ordinary UI chrome.

## Typography direction

- One strong, modern sans family; avoid overused defaults (see [[Anti-AI-Slop Design Rules]]).
- A clear type scale (display / title / body / caption). Consistent weights.
- Wide, readable line lengths. No 6-line text walls. Titles do real hierarchical work.

## Spacing & layout

- A single spacing scale (e.g. 4/8-based). Generous, consistent rhythm — no cramped screens.
- Rounded cards with calm elevation; avoid heavy shadows and card-in-card nesting.
- Every screen has **one clear purpose** and **one obvious primary action**.

## Component direction

- Reusable but **not over-abstracted**: `Screen`, `Card`, `AlertBadge`, `StatusPill`,
  `PrimaryButton`, `EmptyState`, `Loading`, `ErrorState`. Build these as they're needed and
  approved — not speculatively.
- Consistent iconography, one icon set.

## Alert state styling

- **Severity/category** drives styling (color + icon), calmly. A serious incident reads as
  serious without shouting. Pending vs posted vs expired are visually distinct.

## Map direction

- Subtle, muted map styling that recedes so **markers** are the focus.
- Markers reflect severity/category. Tap → preview card → detail sheet.
- Polished empty state when no alerts are nearby. The map is a key demo visual — keep it
  simple, visual, and clean.

## State coverage (every screen)

Design **loading**, **empty**, and **error** states for every screen — not just the happy
path. Empty states are polished, not blank.

## Related

[[UX Principles]] · [[Anti-AI-Slop Design Rules]] · [[Screens List]] · [[App Flow]] · [[Product Principles]]
