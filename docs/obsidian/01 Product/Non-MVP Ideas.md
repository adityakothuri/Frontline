---
tags: [product, parking-lot]
status: parked
updated: 2026-07-07
---

# Non-MVP Ideas

Parked ideas. **None of these are built during the MVP** unless explicitly approved. Keeping them
here prevents scope creep while preserving good thinking. See [[Feature Priority Order]].

## Real backend + data ingestion (Priority 10 — after frontend loop is clean)

- Persistence (Supabase/Firebase/Postgres) for resources, saved items, and profiles.
- **Verified data ingestion** from official/directory sources: VA pages/APIs, state veteran affairs,
  county veteran service offices, 2-1-1, the National Resource Directory, local nonprofits, food
  banks, clothing closets, legal aid. Prioritize **verified/official** sources; scraping is a
  later, secondary source — never the sole source of truth. See [[Phase 10 Backend and Data Ingestion]].
- An **AI proxy/backend** so real LLM calls can ship (API keys never live in the client). Required
  before Phase 6/7 use real models. See [[AI Feature Design]].

## Advanced veteran-facing features (Priority 11 — future)

- **Claims filing** / application submission in-app.
- **Login with VA credentials** (Login.gov / ID.me) and authenticated benefit data.
- **Document upload** (DD-214, VA card, proof of income) — sensitive; needs real security + storage.
- Appointment booking, reminders, and follow-up tracking.
- Case-worker / VSO hand-off and shared checklists.

## Smarter AI (later)

- Retrieval over an official-benefits corpus for grounded summaries with citations.
- Personalized eligibility pre-screening (still "you *may* qualify", never a determination).
- Multilingual summaries and scripts.

## Community & scale (future)

- Community-submitted resources with moderation and a verification workflow.
- Ratings / "was this helpful" signals feeding verification status.
- Organization accounts, analytics, and multi-region coverage.

## Rule

If any of these becomes desirable, it goes through [[Feature Spec Template]] → approval →
[[Feature Priority Order]] update → a roadmap phase. It does **not** sneak into an MVP task. Anything
touching **sensitive data, claims, or real advice** additionally requires an explicit trust/privacy
review ([[Trust Safety and Privacy]]).

## Related

[[MVP Definition|MVP Scope]] · [[Feature Priority Order]] · [[Decision Log]]
