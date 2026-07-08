---
tags: [product, roadmap, source-of-truth]
status: active
updated: 2026-07-07
---

# Feature Priority Order

Features are built in this order of importance. Lower numbers first. **Do not jump ahead** without
approval — later priorities depend on earlier ones being clean.

| # | Priority | MVP? | Roadmap phase |
|---|----------|------|---------------|
| 0 | Foundation & project discipline | ✅ done | [[Phase 0 Setup]] |
| 1 | Polished app shell + design system | ✅ done (reused) | [[Phase 1 App Shell]] |
| 2 | Resource/benefit **data model** + typed mock service + `AiService` seam | ✅ MVP (foundation) | [[Phase 2 Resource Data Model and Service]] |
| 3 | **"What do you need help with?"** guided need flow | ✅ MVP (core) | [[Phase 3 Guided Need Flow]] |
| 4 | Resource **list, cards & detail pages** | ✅ MVP (core) | [[Phase 4 Resource List and Detail]] |
| 5 | **Map** + local resource discovery | ✅ MVP | [[Phase 5 Map and Discovery]] |
| 6 | **AI workflow layer** — next-step plans + call scripts | ✅ MVP | [[Phase 6 AI Plans and Call Scripts]] |
| 7 | **AI summarization** — benefits/documents to plain English | ✅ MVP | [[Phase 7 AI Summarization]] |
| 8 | **Saved resources** + lightweight veteran profile | ✅ MVP | [[Phase 8 Saved and Profile]] |
| 9 | **Trust, safety & verification** surfacing | ✅ MVP | [[Phase 9 Trust and Verification]] |
| 10 | Real backend + verified data ingestion | ❌ Post-MVP | [[Phase 10 Backend and Data Ingestion]] |
| 11 | Advanced features (claims filing, uploads, orgs) | ❌ Future | [[Non-MVP Ideas]] |

## Reasoning

- **0 first** because uncontrolled building is the biggest risk to a demo-quality app. Discipline
  (scoping, logging, no slop) is cheaper to set up now than to retrofit.
- **1 is already built** — the previous product left a clean, reusable design system and app shell
  (tokens, generic components, navigation). Frontline reuses it rather than rebuilding.
- **2 before any screen.** The `Resource` data model, a typed mock `resources` service, and the
  `AiService` interface are the **seams** every later screen depends on. The previous codebase never
  had a service/AI seam; establishing it first keeps everything swappable and testable.
- **3 is the front door.** The guided "What do you need help with?" flow is how a veteran expresses
  intent; it turns a vague need into a structured query that drives recommendations.
- **4 makes results usable** — cards for fast scanning, detail pages for depth. Built against the
  Phase 2 service so the same data powers list and map.
- **5 adds place** — the map reuses `react-native-maps` (already a dependency) with the same
  resource data as the list. See [[Map and Search Design]].
- **6–7 are the AI heart**, embedded in the workflow: next-step plans and call scripts (6), then
  plain-English benefit/document summaries (7). Templated first, real API behind the same
  interface later. See [[AI Feature Design]].
- **8** rounds out usefulness (save resources/benefits/scripts/checklists; a lightweight,
  optional-only profile that personalizes without gatekeeping).
- **9 makes trust explicit** — source badges, last-checked, verification status, and disclaimers
  surfaced everywhere. See [[Trust Safety and Privacy]].
- **10 comes only after the frontend loop is clean** — real backend, official/verified sources, and
  the **AI proxy** required before real LLM calls can ship (keys never live in the client).
- **11 is explicitly future** — claims filing, VA login, document upload, organizations. Not in MVP.

## Related

[[MVP Definition|MVP Scope]] · [[Product Overview]] · [[Non-MVP Ideas]] · [[Frontline Command Center]]
