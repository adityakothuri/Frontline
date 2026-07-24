---
tags: [roadmap, phase-10, post-mvp]
status: future
updated: 2026-07-07
---

# Phase 10 — Backend & Real Resource Data Ingestion (Post-MVP)

## Purpose

Move from seeded mock data + templated AI to **real, verified data** and **real AI** — only after the
frontend loop is clean. High complexity, real trust stakes.

## Included (future, each needs its own spec + approval)

- **Backend/persistence** for resources, saved items, and profiles (Supabase/Firebase/Postgres),
  implementing the same `ResourceService` interface.
- **Verified data ingestion**, prioritizing official/directory sources: VA pages/APIs, state veteran
  affairs, county VSOs, 2-1-1, National Resource Directory, vetted nonprofits, food banks, clothing
  closets, legal aid. **Scraping is secondary**, never the sole source of truth.
- A **data model for provenance/verification** feeding `source_type` / `verification_status` /
  `last_checked` honestly.
- An **AI proxy/edge function** so real Claude calls can ship — **API key server-side only**
  ([[Environment Variables]]); the `AiService` real implementation swaps in behind the interface.

## Excluded (still)

- Claims filing, VA login, document upload, organizations — [[Non-MVP Ideas]] / Priority 11.

## Checklist (high-level)

- [ ] Spec the backend + ingestion + proxy separately ([[Feature Spec Template]]); get approval.
- [ ] Implement `ResourceService` / `AiService` real backends behind existing interfaces.
- [ ] Verification workflow + freshness (`last_checked`) automation.
- [ ] Security review (keys, PII, data provenance).

## Definition of done

- Real, verified resources and real AI power the app through the **unchanged** service interfaces;
  trust fields reflect real provenance; no secrets in the client.

## Risks

- Data quality/staleness and over-trusting scraped sources — verification and freshness are core.
- Key leakage — the proxy is mandatory before any real LLM call ships.

## Related

[[Technical Architecture]] · [[Resource Data Model]] · [[AI Feature Design]] · [[Environment Variables]] · [[Non-MVP Ideas]]
