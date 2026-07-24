---
tags: [product, mvp, acceptance, source-of-truth]
status: active
updated: 2026-07-07
---

# MVP Acceptance Criteria

The testable definition of a done MVP. Mirrors the 10-step core journey in [[MVP Definition|MVP Scope]].
Each item is pass/fail; the MVP is done when all "must pass" items pass. Use in `qa-tester` review.

## A. Guided need flow

- [ ] Home screen leads with **"What do you need help with?"** and a grid of the 12 need categories
      (Food, Clothing, Housing, Healthcare, Disability, Education, Jobs, Legal, Transportation,
      Family/Caregiver, Emergency, General VA benefits).
- [ ] Selecting a category starts a **short guided flow**: what · urgency (today/this week/info) ·
      in-person/online/either · documents on hand · help type (call/visit/apply/understand).
- [ ] The flow can be completed in a few taps and produces a **structured need** used for results.
- [ ] User can provide **ZIP** instead of device location, and the app works from ZIP alone.

## B. Discovery (list + map)

- [ ] Results show **nearby resources** as **cards** with: name, category, distance, open/closed (or
      unknown), short description, **best next action**, and Call / Directions / Save / View details
      / Generate call script actions.
- [ ] The same resources render on a **map** with category pins; tapping a pin opens the resource.
- [ ] List ⇄ map show the **same data set**; empty/loading/error states are designed.

## C. Resource detail

- [ ] Detail page shows: full description, **AI summary**, eligibility, required documents, phone,
      website, address, hours, **source link**, **verification status**, **last-checked/updated**,
      a **generated call script**, and a **"What should I bring?" checklist**.
- [ ] Contact actions work: **Call** dials, **Directions** opens maps, **Save** persists.

## D. AI in workflow (templated for MVP, behind `AiService`)

- [ ] Each relevant resource has an **AI next-step plan** (ordered, specific — who to call, what to
      bring, a backup).
- [ ] **"Generate call script"** produces a **category- and resource-specific** script, plus a
      **shorter nervous-user variant**.
- [ ] The **summarizer** turns a benefit/resource description into: what it is · who it helps · who
      may qualify · documents needed · deadlines/warnings · what to do next · source link ·
      confidence/verification note.
- [ ] All AI output uses **hedged** language ("you *may* qualify… confirm with the official source")
      and carries an "AI-generated — verify with source" label. It is never presented as legal /
      medical / financial / government-certified advice.

## E. Save & profile

- [ ] User can **save** resources, benefits, call scripts, and document checklists, and see them in
      a saved area.
- [ ] A **lightweight profile** exists with **optional-only** fields; nothing is required, and no
      SSN / VA login / bank / diagnosis is ever requested.
- [ ] Profile inputs **personalize** recommendations without blocking access.

## F. Trust, safety & privacy

- [ ] Every resource visibly shows **source type**, **last-checked**, and **verification status**;
      unverified/outdated info is **flagged**.
- [ ] A persistent **"not the VA / not a government agency"** disclaimer is present.
- [ ] The **Emergency** path surfaces crisis resources (e.g. 988 press 1, 911) rather than handling
      crises in-app.
- [ ] Profile/saved data is stored **on-device**; no account or server in the MVP.

## G. Quality bar

- [ ] `npm run verify` (typecheck + lint) passes.
- [ ] UI looks **designed** and is **accessible** (large targets, contrast, screen-reader labels);
      `ui-reviewer` PASS.
- [ ] Simulated data and templated AI are **labeled honestly**.
- [ ] Build log + [[app_walkthrough]] updated for each shipped feature; no unauthorized files.

## Related

[[MVP Definition|MVP Scope]] · [[Feature Priority Order]] · [[Trust Safety and Privacy]] ·
[[AI Feature Design]] · [[Resource Data Model]] · [[Quality Gates]]
