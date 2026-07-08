---
tags: [design, source-of-truth]
status: active
updated: 2026-07-07
---

# UI Design System

The visual identity of Frontline: **calm, premium, serious, trustworthy, accessible.** Not childish,
cluttered, alarmist, or template-like. This is the reference for every screen. See
[[Anti-AI-Slop Design Rules]] for what to avoid.

> The concrete token module already exists from the reused shell (`src/theme/`): `colors`,
> `spacing`/`radii`, `typography` (Manrope), aggregated in `src/theme/index.ts`. Prefer these tokens
> over inline styles. New tokens are added with approval — see [[File Creation Policy]].

## Color direction

The existing dark palette carries over; the **meaning** of the semantic colors is re-mapped for a
resource navigator (not alert severity).

| Role | Token | Meaning in Frontline |
|------|-------|----------------------|
| Foundation | `background` / `backgroundElevated` (navy/charcoal) | Calm default surface. |
| Surface / cards | `surface` / `surfaceMuted` / `border` | Quiet, rounded resource cards. |
| Primary text | `textPrimary` | High legibility on dark. |
| Secondary / muted text | `textSecondary` / `textMuted` | Hierarchy without noise (WCAG AA). |
| Accent (primary action) | `accent` / `accentPressed` / `accentSoft` (blue) | Buttons, links, active states. |
| Verified / confirmed | `success` (green) | Verified sources, confirmed / saved. |
| Unverified / outdated / caution | `warning` (amber) | "Check the source", stale `last_checked`. |
| Emergency only | `danger` (red) | Reserved for genuine emergencies — never decorative. |

Rule: color carries **meaning**, and **never color alone** — pair with text/icons for accessibility.
Green = verified, amber = unverified/outdated, red = emergency. Don't use these for ordinary chrome.

## Typography

- Manrope (400/500/600/700) via `typography.ts`; type scale display / title / heading / subtitle /
  body / label / caption. Titles do real hierarchical work; readable line lengths; no text walls.

## Spacing & layout

- Single spacing scale (`xs…xxxl`) and `radii`; generous, consistent rhythm — no cramped screens.
- Rounded cards with calm elevation; avoid heavy shadows and card-in-card nesting.
- Every screen has **one clear purpose** and **one obvious primary action** (usually Call, Continue,
  or Generate call script).

## Key component patterns

Reuse the existing generic components (`ScreenContainer`, `AppText`, `Card`, `PrimaryButton`,
`ScreenHeader`, `EmptyState`, `ErrorState`, `Loading`). New Frontline patterns (built as approved):

- **Need category tile** — icon + label, large tap target, in the home grid.
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
