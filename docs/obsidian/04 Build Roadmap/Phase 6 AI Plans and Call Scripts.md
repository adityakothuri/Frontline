---
tags: [roadmap, phase-6, mvp, ai]
status: planned
updated: 2026-07-07
---

# Phase 6 — AI Workflow Layer: Next-Step Plans & Call Scripts

## Purpose

Deliver the first two **workflow-embedded** AI features via the `AiService` seam: **next-step plans**
and **call scripts** (with a nervous-user variant). Templated for the MVP; real Claude API behind the
same interface later.

## Included

- `AiService.buildNextStepPlan` — ordered steps + what to bring + backup, from `Need` + `Resource`.
- `AiService.buildCallScript` — category/resource-specific script, `tone: standard | short`.
- UI: next-step plan block on the detail page; **"Generate call script"** → script sheet with both
  tones; copy/save actions.
- Category templates (Food, Clothing, Housing, Healthcare, Benefits, Legal, Jobs, …).
- Guardrail labels ("AI-generated — verify with source"), hedged eligibility language.

## Excluded

- Real Claude API calls (needs the proxy — [[Environment Variables]]); MVP is templated.
- Summarization (Phase 7).

## Checklist

- [ ] Implement templated `buildNextStepPlan` + `buildCallScript` per [[AI Feature Design]].
- [ ] Detail-page plan block + call-script sheet (both tones).
- [ ] Guardrail labels + hedging verified in copy.
- [ ] `ui-reviewer` + `/slop-check`; `npm run verify`.
- [ ] `/finish-task`: build log + [[app_walkthrough]] + [[Decision Log]] (templated-first AI).

## Definition of done

- A veteran can generate a specific next-step plan and a call script (standard + short) for a
  resource; output is labeled and hedged, never advice.

## Risks

- Generic-sounding templates — make them category- and resource-specific and believable.

## Related

[[AI Feature Design]] · [[Trust Safety and Privacy]] · [[Resource Data Model]] · [[Phase 7 AI Summarization]]
