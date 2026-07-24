---
tags: [product, principles, source-of-truth]
status: active
updated: 2026-07-07
---

# Product Principles

These ten principles guide **every** design and coding decision. When a tradeoff is unclear,
resolve it in favor of the higher principle. Record notable calls in the [[Decision Log]].

1. **Veteran-first clarity.** Plain language, low cognitive load, one obvious next action per
   screen. If a veteran can't tell what to do next, the design failed.
2. **AI in workflows, not a chatbot.** AI powers next-step plans, call scripts, and summaries at the
   moment they're useful — never a blank "ask me anything" box. See [[AI Feature Design]].
3. **Trust by verification.** Every resource shows its **source type**, **last-checked date**, and
   **verification status**, with a link to the original source.
4. **Not advice.** AI output is **simplified guidance**, never legal, medical, financial, or
   government-certified. Use "you *may* qualify… confirm with the official source."
5. **Privacy by default.** Collect the minimum. **Never** SSN, VA login, bank info, or diagnosis.
   Profile fields are optional and used to personalize, never to gatekeep.
6. **Accessibility always.** Large tap targets, high contrast, screen-reader labels, no reliance on
   color alone. This app serves people in stressful situations.
7. **Local relevance.** Resources are location-based and useful to nearby people.
8. **Structured development.** Every feature is planned, scoped, implemented, reviewed, tested, and
   logged. See [[Production Workflow]].
9. **No AI slop.** Code is intentional, readable, typed, maintainable. UI looks designed, not
   randomly generated. See [[Anti-AI-Slop Code Rules]] and [[Anti-AI-Slop Design Rules]].
10. **No uncontrolled file creation.** Claude does not create new app files, directories,
    dependencies, screens, or systems without stating the plan and getting approval. See
    [[File Creation Policy]].

## How principles map to the product

- Principles **1–2** shape the guided flow and every AI touchpoint ([[App Flow|Core User Flows]], [[AI Feature Design]]).
- Principles **3–5** define the trust, safety, and privacy model ([[Trust Safety and Privacy]]).
- Principles **6–7** shape the discovery and detail experience ([[UI Design System]], [[Map and Search Design]]).
- Principles **8–9** set the quality bar ([[Quality Gates]]).
- Principle **10** governs how Claude works ([[File Creation Policy]], [[Claude Development Rules]]).

## Related

[[Product Overview]] · [[MVP Definition|MVP Scope]] · [[UX Principles]] · [[Frontline Command Center]]
