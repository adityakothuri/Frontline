---
tags: [research, index]
status: active
updated: 2026-07-07
---

# Research Index

Home for research notes that inform decisions — library comparisons, integration spikes, data-source
and model/provider evaluations. Keep findings here, then feed conclusions into the [[Decision Log]]
and the relevant roadmap phase.

## How to use

- One note per research topic: `YYYY-MM-DD <topic>.md`.
- Summarize options, tradeoffs, and a recommendation. Prefer **Context7** for current library docs.
- Link the resulting decision in the [[Decision Log]].

## Topics likely to need research (Frontline)

- [ ] **Veteran resource data sources** — VA pages/APIs, state veteran affairs, county VSOs, 2-1-1,
      National Resource Directory, vetted nonprofits. Coverage, licensing, freshness, verification →
      [[Phase 10 Backend and Data Ingestion]] / [[Resource Data Model]].
- [ ] **AI provider + proxy** — Claude model choice, structured JSON output, and a key-safe proxy
      pattern for RN → [[AI Feature Design]] / [[Environment Variables]].
- [ ] **On-device persistence** — AsyncStorage vs alternatives for saved items/profile →
      [[Phase 8 Saved and Profile]].
- [ ] **Backend** — Supabase vs Firebase vs Postgres for resources/saved/profile →
      [[Phase 10 Backend and Data Ingestion]].
- [ ] **Geocoding / ZIP → coordinates** — privacy-preserving options for the map →
      [[Map and Search Design]].
- [ ] **Accessibility** — RN screen-reader + large-text patterns for a stressed audience →
      [[UX Principles]].

## Related

[[Decision Log]] · [[Technical Architecture]] · [[Resource Data Model]] · [[Non-MVP Ideas]]
