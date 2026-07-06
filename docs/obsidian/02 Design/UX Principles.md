---
tags: [design, ux, principles]
status: stable
updated: 2026-07-05
---

# UX Principles

How Watchdog should behave, screen by screen. These serve [[Product Principles]] and feed the
`ui-reviewer` agent's checklist.

1. **Every screen has one clear purpose.** If you can't name it in a sentence, it's doing too
   much.
2. **Every primary action is obvious.** One clear primary action per screen.
3. **Alerts are serious, not panic-inducing.** Inform calmly. No red-everywhere dashboards.
4. **Review screens prioritize trust.** In the detection/review flow, make it obvious the user
   is in control: clear Approve/Reject, editable description, visible confidence.
5. **The map is simple and visual.** Markers over text. Let the map recede; let alerts pop.
6. **Avoid text walls.** Short, purposeful copy. Let hierarchy and layout carry meaning.
7. **Use real-feeling mock data.** No `Lorem ipsum`, no `Camera 1 / Camera 2`. Believable
   names, places, timestamps. See [[Anti-AI-Slop Code Rules]].
8. **Reusable but not over-abstracted components.** Shared patterns, not a component zoo.
9. **Code structure makes the UI understandable.** A reader should map screen → files easily.
10. **Screens look designed, not dumped.** No random component piles. See
    [[Anti-AI-Slop Design Rules]].

## States are part of UX

Loading, empty, and error states are designed deliberately — they're where cheap apps reveal
themselves. Empty states should orient and reassure.

## Accessibility basics

Sufficient contrast on the dark theme, adequate touch targets, and labels for interactive
elements. Not full WCAG for MVP, but no obvious failures.

## Related

[[UI Design System]] · [[Anti-AI-Slop Design Rules]] · [[Product Principles]]
