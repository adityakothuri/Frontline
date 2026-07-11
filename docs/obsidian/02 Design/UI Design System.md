---
tags: [design, source-of-truth]
status: active
updated: 2026-07-07
---

# UI Design System

The visual identity of Frontline: **calm, premium, serious, trustworthy, accessible — and warm.** Not
childish, cluttered, alarmist, or template-like, but inviting rather than cold. Warmth comes from a
warm off-white **"paper"** foundation, generous spacing, roomy rounded cards, a friendly time-aware
greeting, and plain supportive copy — **within** the paper base and the single-accent color rules
below (not from decorative color). This is the reference for every screen. See
[[Anti-AI-Slop Design Rules]] for what to avoid.

> **Aesthetic (2026-07-07):** re-skinned from the original dark navy to a warm light "paper" theme
> inspired by [granola.ai](https://www.granola.ai) — off-white near-paper background, an olive
> accent for primary actions, and near-black text. See [[Decision Log]] for the pivot rationale.
> **(2026-07-10):** the accent moved acid-lime → a true **olive green** `#5F7326` (the lime read
> harsh; a first muted-olive candidate read gray) with paper-white text on it, and a text-grade
> amber `warningText` was added so trust-layer warnings meet AA as small text.

> The concrete token module already exists from the reused shell (`src/theme/`): `colors`,
> `spacing`/`radii`, `typography` (Inter + Fraunces), aggregated in `src/theme/index.ts`. Prefer
> these tokens over inline styles. New tokens are added with approval — see [[File Creation Policy]].

## Color direction

A warm light "paper" palette; the **meaning** of the semantic colors is mapped for a resource
navigator (not alert severity). All body/small text meets WCAG AA on the paper background.

| Role | Token | Meaning in Frontline |
|------|-------|----------------------|
| Foundation | `background` `#F5F1E8` / `backgroundElevated` `#EFEADD` (warm paper) | Calm default surface. |
| Surface / cards | `surface` / `surfaceMuted` / `border` (soft off-white) | Quiet, rounded resource cards. |
| Primary text | `textPrimary` `#1A1A17` | Warm near-black on paper (15.5:1). |
| Secondary / muted text | `textSecondary` / `textMuted` | Hierarchy without noise (WCAG AA). |
| Accent (primary action) | `accent` `#5F7326` / `accentPressed` / `accentSoft` (olive) | Buttons, links, active states; paper-white text on olive. |
| Verified / confirmed | `success` `#2E7D32` (deep emerald) | Verified sources, confirmed / saved. |
| Unverified / outdated / caution | `warning` `#B7791F` (amber dots/icons) / `warningText` `#8F5D16` (amber text) | "Check the source", stale `last_checked`. |
| Emergency / destructive | `danger` `#C0392B` (red) | Genuine emergencies, plus confirmed destructive actions (e.g. "Reset setup" behind an alert) — never decorative. |

Rule: color carries **meaning**, and **never color alone** — pair with text/icons for accessibility.
Olive = primary action, **deep emerald** = verified (kept distinct from the olive accent so the two
greens never blur), amber = unverified/outdated, red = emergency. Don't use these for ordinary chrome.

## Typography

- **Inter** (400/500/600/700) for body/UI and **Fraunces** (serif, 600/700) for big display/title
  headers, via `typography.ts`; type scale display / title / heading / subtitle / body / label /
  caption. The serif is reserved for the largest statement headers (display/title); everything else
  is Inter. Titles do real hierarchical work; readable line lengths; no text walls.

## Spacing & layout

- Single spacing scale (`xs…xxxl`) and `radii`; generous, consistent rhythm — no cramped screens.
- Rounded cards with calm elevation; avoid heavy shadows and card-in-card nesting.
- Every screen has **one clear purpose** and **one obvious primary action** (usually Call, Continue,
  or Generate call script).

## Key component patterns

Reuse the existing generic components (`ScreenContainer`, `AppText`, `Card`, `PrimaryButton`,
`ScreenHeader`, `EmptyState`, `ErrorState`, `Loading`). New Frontline patterns (built as approved):

- **Need category card** — a **single-column** list card: accent-tinted icon chip + label +
  one-line description + chevron. Large tap target; reads warm and scannable. (Replaced the tighter
  2-column tile grid in Stage 4, 2026-07-07 — see [[Decision Log]].)
- **Resource card** — name · category · distance · open/closed(or unknown) · short description ·
  **best next action** · action buttons (Call · Directions · Save · View details · Generate call
  script). Fast to scan.
- **Source / verification badge** — source type + last-checked; amber when unverified/outdated,
  green when verified; always with text.
- **AI content block** — visually distinct, with an "AI-generated — verify with source" label.
- **Document checklist** — "What should I bring?" as checkable rows.
- **Category pin** — map marker keyed by resource category (see [[Map and Search Design]]).

## Trust & AI styling

- Trust signals are **always visible**, never buried. Unverified/outdated resources are visibly
  flagged.
- AI output is set apart from official/source text so users never mistake guidance for the source.

## State coverage (every screen)

Design **loading**, **empty**, and **error** states for every screen — not just the happy path.
Empty states orient and reassure ("No food resources found near this ZIP — try a wider radius").

## Accessibility (first-class, not optional)

Large tap targets (≥44pt), high contrast, screen-reader labels on interactive elements, no meaning
by color alone, scalable text. See [[UX Principles]] and [[Product Principles]] #6.

## Related

[[UX Principles]] · [[Map and Search Design]] · [[Anti-AI-Slop Design Rules]] · [[Screens List]] · [[Product Principles]]
