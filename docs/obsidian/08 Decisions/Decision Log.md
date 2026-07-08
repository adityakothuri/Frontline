---
tags: [decisions, source-of-truth]
status: active
updated: 2026-07-07
---

# Decision Log

Running log of notable product, design, and technical decisions (lightweight ADRs). Add a new entry
(newest at top) whenever a meaningful choice is made. Each entry: context → decision → consequences.

> Reset on 2026-07-07 when the project was reframed from Watchdog to Frontline. Watchdog-era
> decisions were intentionally not carried over; they applied to a product that no longer exists.

## Entry template

```md
### YYYY-MM-DD — <decision title>
- **Status:** accepted | superseded by [[…]] | revisited
- **Context:** what forced a choice
- **Decision:** what we chose
- **Alternatives:** what we didn't choose, briefly
- **Consequences:** what this implies going forward
```

---

### 2026-07-07 — Phase 2 service-interface shapes
- **Status:** accepted
- **Context:** [[Resource Data Model]] sketched `ResourceService.search` returning `Resource[]` and
  `AiService.summarizeBenefit({ text })`. Building Phase 2 surfaced two better shapes.
- **Decision:** `search` returns **`ResourceSearchResult[]`** (`resource` + query-derived
  `distanceMiles` + `isOpenNow`) so the UI doesn't recompute; `summarizeBenefit` takes
  **`{ resource }`** (the app always holds a `Resource`) instead of raw text.
- **Alternatives:** return bare `Resource[]` and derive distance/open-now in every screen (duplication);
  keep the raw-text summarizer (no caller needs it yet).
- **Consequences:** screens consume ready-to-render results; the real Claude implementation still
  fits behind the same interface. Docs updated to match.

### 2026-07-07 — Reframe Watchdog → Frontline
- **Status:** accepted
- **Context:** The Watchdog neighborhood-safety product was scrapped. A new product, **Frontline**
  (a veteran benefits/resource navigator with AI embedded in workflows), replaces it. The repo's
  development framework (agents, hooks, rules, skills, MCP, Obsidian, workflow) and the reusable
  RN+Expo design system are worth preserving.
- **Decision:** Do a **documentation + framework + config reframe** — rewrite the Obsidian brain and
  `CLAUDE.md` for Frontline, rename app config to `com.frontline.app`, delete Watchdog historical
  records, and preserve the framework and design system. **Feature screens are not rewritten yet**;
  they are the first coding milestone ([[Phase 2 Resource Data Model and Service]]).
- **Alternatives:** (a) start a brand-new repo — loses the mature framework; (b) rewrite all code
  now — too big, unreviewable, and premature before the product docs settle.
- **Consequences:** The running app keeps its Watchdog *screens* until Phase 2–5 rebuild them; only
  its native identity is now Frontline. The `ios/` native project must be regenerated.

### 2026-07-07 — AI is interface-first, templated before real
- **Status:** accepted
- **Context:** Frontline's core AI (next-step plans, call scripts, benefit summaries) must be
  "embedded in workflows, not a chatbot" — but a mobile client can't safely hold an LLM API key.
- **Decision:** Define a typed **`AiService`** interface consumed by screens. Ship a **templated**
  (offline, deterministic) implementation for the MVP; wire the real Claude API behind the same
  interface later, via a **server-side proxy**. See [[AI Feature Design]].
- **Alternatives:** call Claude directly from the client (leaks the key; needs a backend anyway);
  mock-only forever (kills the "real AI" value).
- **Consequences:** MVP is fully demoable offline; a proxy/backend is a prerequisite before any real
  LLM call ships ([[Phase 10 Backend and Data Ingestion]], [[Environment Variables]]).

## Related

[[Technical Architecture]] · [[AI Feature Design]] · [[Non-MVP Ideas]] · [[Frontline Command Center]]
