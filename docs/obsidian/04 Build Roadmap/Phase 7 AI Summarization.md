---
tags: [roadmap, phase-7, mvp, ai]
status: planned
updated: 2026-07-07
---

# Phase 7 — AI Summarization (Benefits & Documents)

## Purpose

Turn confusing benefit pages / resource descriptions into **plain English** via
`AiService.summarizeBenefit`. Templated for the MVP; real model behind the same seam later.

## Included

- `AiService.summarizeBenefit` → structured summary: what it is · who it helps · who **may** qualify ·
  documents needed · deadlines/warnings · what to do next · official/source link · confidence/
  verification note.
- UI: an **AI summary block** on the resource/benefit detail (visually distinct, labeled), feeding
  the `ai_summary` field.
- Honest hedging + "not official / verify with source" warnings when `source_type` isn't official.

## Excluded

- Real retrieval/grounding over an official corpus (later — [[Non-MVP Ideas]]).
- Document upload (never in MVP; sensitive).

## Checklist

- [ ] Implement templated `summarizeBenefit` producing the required fields.
- [ ] Summary block UI with labels + hedging + source/verification note.
- [ ] `ui-reviewer` + `/slop-check`; `npm run verify`.
- [ ] `/finish-task`: build log + [[app_walkthrough]].

## Definition of done

- A benefit/resource shows a clear, respectful, plain-English summary with all required sections,
  hedged eligibility, and a verification note — never presented as a determination.

## Risks

- Overclaiming eligibility — enforce "you *may* qualify" language and verification notes.

## Related

[[AI Feature Design]] · [[Trust Safety and Privacy]] · [[Resource Data Model]] · [[Phase 8 Saved and Profile]]
