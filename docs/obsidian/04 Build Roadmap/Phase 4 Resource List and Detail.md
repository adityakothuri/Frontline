---
tags: [roadmap, phase-4, mvp]
status: planned
updated: 2026-07-07
---

# Phase 4 — Resource List, Cards & Detail Pages

## Purpose

Make results usable: fast-scan **cards** and a complete **detail page**, powered by the Phase 2
service and the `Need` from Phase 3.

## Included

- **Resource card**: name · category · distance · open/closed (or unknown) · short description ·
  **best next action** · buttons (Call · Directions · Save · View details · Generate call script).
- **Resource list**: relevance→distance sorted; designed loading/empty/error.
- **Resource detail page**: full description · AI summary · eligibility · required documents · phone ·
  website · address · hours · source link · verification status · last-checked/updated · generated
  call script · **"What should I bring?" checklist**.
- Wire **Call** (dialer) and **Directions** (maps) intents.

## Excluded

- Map view (Phase 5).
- Real AI generation (call script/summary use `AiService` templated output; deepened in Phases 6–7).
- Real persistence for Save (stub/local until Phase 8).

## Checklist

- [ ] Approve component/screen files with `react-native-architect`.
- [ ] Build card + list against `ResourceService`.
- [ ] Build detail page with all sections incl. trust surfacing.
- [ ] Call/Directions actions; document checklist.
- [ ] `ui-reviewer` + `/slop-check`; `npm run verify`.
- [ ] `/finish-task`: build log + [[app_walkthrough]].

## Definition of done

- From a `Need`, a veteran sees scannable cards and can open a complete detail page and act.

## Risks

- Card overload — keep to the most important info; details live on the detail page.

## Related

[[UI Design System]] · [[Resource Data Model]] · [[Trust Safety and Privacy]] · [[Phase 5 Map and Discovery]]
