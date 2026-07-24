---
tags: [design, ux, principles]
status: active
updated: 2026-07-07
---

# UX Principles

How Frontline should behave, screen by screen. These serve [[Product Principles]] and feed the
`ui-reviewer` agent's checklist.

1. **Every screen has one clear purpose.** If you can't name it in a sentence, it's doing too much.
2. **Every primary action is obvious.** One clear primary action per screen (Call, Continue,
   Generate call script).
3. **Lead with the need, not the features.** The front door is "What do you need help with?", not a
   tour. Get the veteran to relevant help in as few taps as possible.
4. **AI shows up in context, never as a chatbot.** Summaries, next-step plans, and call scripts
   appear exactly where they help. Label AI output and keep it hedged. See [[AI Feature Design]].
5. **Make trust legible.** Every resource shows source + last-checked + verification; flag
   unverified/outdated clearly. Users should always know how much to trust what they see.
6. **Respect urgency.** "Open now" and "today vs this week vs info" are first-class; make Call and
   Directions effortless.
7. **Avoid text walls.** Short, plain, purposeful copy. Let hierarchy and layout carry meaning.
8. **Use real-feeling mock data.** No `Lorem ipsum`, no `Resource 1 / Resource 2`. Believable
   names, addresses, hours, phone numbers. See [[Anti-AI-Slop Code Rules]].
9. **Never demand sensitive data.** Every profile field is optional; no SSN/VA-login/bank/diagnosis.
10. **Screens look designed, not dumped.** No random component piles. See [[Anti-AI-Slop Design Rules]].

## States are part of UX

Loading, empty, and error states are designed deliberately — they're where cheap apps reveal
themselves. Empty states orient and reassure and suggest a next move (widen radius, try a ZIP).

## Accessibility (first-class)

Sufficient contrast on the dark theme, tap targets ≥44pt, labels for interactive elements, no
meaning by color alone, and support for larger text. This app serves people under stress — treat
accessibility as a requirement, not a nice-to-have.

## Related

[[UI Design System]] · [[Map and Search Design]] · [[Anti-AI-Slop Design Rules]] · [[Product Principles]]
