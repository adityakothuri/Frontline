---
tags: [product, principles, source-of-truth]
status: stable
updated: 2026-07-05
---

# Product Principles

These ten principles guide **every** design and coding decision. When a tradeoff is unclear,
resolve it in favor of the higher principle. Record notable calls in the [[Decision Log]].

1. **User control first.** Nothing from a private camera becomes public automatically. The
   user must approve it.
2. **Human verification.** AI can detect possible incidents; **users decide** whether the
   detection is correct.
3. **Privacy by default.** Raw private footage stays private unless the user intentionally
   posts it.
4. **Calm safety.** Serious and trustworthy — never alarmist or fearmongering.
5. **Local relevance.** Alerts are location-based and useful to nearby people.
6. **Temporary by design.** Alerts have auto-delete/expiration so the map never goes stale.
7. **Beautiful MVP.** The first version feels polished and demo-ready, even where integrations
   are simulated.
8. **Structured development.** Every feature is planned, scoped, implemented, reviewed, tested,
   and logged. See [[Production Workflow]].
9. **No AI slop.** Code is intentional, readable, typed, maintainable. UI looks designed, not
   randomly generated. See [[Anti-AI-Slop Code Rules]] and [[Anti-AI-Slop Design Rules]].
10. **No uncontrolled file creation.** Claude does not create new app files, directories,
    dependencies, screens, or systems without stating the plan and getting approval. See
    [[File Creation Policy]].

## How principles map to the product

- Principles **1–3** define the review flow and the privacy model ([[Product Overview]]).
- Principles **4–6** shape the alert + map experience ([[UI Design System]]).
- Principles **7–9** set the quality bar ([[Quality Gates]]).
- Principle **10** governs how Claude works ([[File Creation Policy]]).

## Related

[[Product Overview]] · [[MVP Definition]] · [[UX Principles]] · [[Watchdog Command Center]]
