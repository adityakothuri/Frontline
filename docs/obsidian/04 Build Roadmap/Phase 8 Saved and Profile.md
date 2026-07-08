---
tags: [roadmap, phase-8, mvp]
status: planned
updated: 2026-07-07
---

# Phase 8 — Saved Resources & Veteran Profile

## Purpose

Let veterans **keep** what they find and lightly **personalize** results — without demanding
sensitive data.

## Included

- **Saved** area: saved resources, benefits, call scripts, and document checklists.
- **On-device persistence** (e.g. AsyncStorage) behind a small typed store; added with approval.
- **Profile**: optional-only fields — ZIP/city, role (veteran/active/family/caregiver/other),
  general needs, disability **rating range** (if volunteered), housing situation, employment/student
  status, preferred radius, preferred contact method, and **documents already on hand** (checklist).
- Profile **personalizes** recommendations (radius, needs) — never gatekeeps.

## Excluded

- Accounts, login, cloud sync (post-MVP).
- Any sensitive data: **no SSN, VA login, bank, diagnosis**.

## Checklist

- [ ] Approve store + screen files with `react-native-architect`.
- [ ] Implement on-device save/unsave across item types.
- [ ] Profile form (all optional); wire radius/needs into `ResourceService` queries.
- [ ] Privacy copy + data-minimization review ([[Trust Safety and Privacy]]).
- [ ] `ui-reviewer` + `/slop-check`; `npm run verify`.
- [ ] `/finish-task`: build log + [[app_walkthrough]].

## Definition of done

- Veterans can save/retrieve items and set optional preferences that improve results; nothing
  sensitive is requested; data stays on-device.

## Risks

- Scope creep toward accounts/sync — keep it local and optional.

## Related

[[Trust Safety and Privacy]] · [[Resource Data Model]] · [[User Personas]] · [[Phase 9 Trust and Verification]]
