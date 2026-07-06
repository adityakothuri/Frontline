---
tags: [design, quality, anti-slop, source-of-truth]
status: stable
updated: 2026-07-05
---

# Anti-AI-Slop Design Rules

Watchdog must not look AI-generated. This note describes what generic AI UI looks like and how
to avoid it. The `ui-reviewer` agent enforces this. Coding counterpart: [[Anti-AI-Slop Code Rules]].

## What AI-slop UI looks like (avoid)

- The same **default font everywhere** (system default / the one overused sans).
- **Purple-to-blue gradients** and decorative gradients with no meaning.
- **Cards nested in cards nested in cards.**
- **Gray text on colored backgrounds** (poor contrast, cheap feel).
- A **rounded-square icon tile above every heading.**
- Pure black / pure gray with no tint.
- Bounce/elastic easing that feels dated.
- Cramped spacing or wildly inconsistent spacing.
- Every screen looking like a settings list.
- Emoji as UI iconography.
- `Lorem ipsum` or `Camera 1 / Camera 2 / Item` placeholder data.

## What Watchdog does instead

- A deliberate color system where **color means something** (red/orange = real alert, green =
  safe). See [[UI Design System]].
- Tinted darks (navy/charcoal), not pure black; muted gray cards, calm elevation.
- One consistent, non-generic type family with a real scale and hierarchy.
- One spacing scale, applied consistently.
- One icon set, used consistently.
- **Believable mock data** (real-sounding names, streets, times).
- Designed loading/empty/error states on every screen.
- Motion that is subtle and purposeful (no bounce for its own sake).

## Review test

Before a screen passes `ui-reviewer`, ask: *"Would this look out of place in a serious,
funded public-safety product?"* If yes, it's not done. Reviewers must cite the specific file
and the specific spacing/type/hierarchy issue — no vague "make it pop."

## Related

[[UI Design System]] · [[UX Principles]] · [[Anti-AI-Slop Code Rules]] · [[Quality Gates]]
