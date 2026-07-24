---
tags: [roadmap, phase-8, mvp]
status: in-progress
updated: 2026-07-08
---

# Phase 8 — Saved Resources & Veteran Profile

> **Status 2026-07-08:** **Saved resources ✅ done** (on-device store + bookmark on cards/detail +
> Saved tab — [[2026-07-08 Phase 8 Saved Resources]]). **Profile:** the lightweight core shipped
> early (first name + ZIP, onboarding, edit/reset). The **extended optional profile** (role, radius,
> documents-on-hand, needs → wired into `ResourceService` queries) is **not built** — a later slice.

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

- [x] Approve store + screen files with `react-native-architect` (saved store approved 2026-07-08).
- [x] On-device save/unsave for **resources** (bookmark on cards + detail header; Saved tab).
      *(Scripts/checklists/benefits as savable item types = later.)*
- [x] Extended profile (role/radius/docs, all optional) via a **multi-step setup wizard** + an
      always-editable Profile form; **radius wired into `ResourceService` queries**
      ([[2026-07-08 Extended Profile Multi-Step Setup]]). *(Disability rating omitted — too sensitive.)*
- [x] Privacy: on-device only, nothing sensitive (ids in AsyncStorage; live re-resolve).
- [ ] `ui-reviewer` + `/slop-check`; `npm run verify` ✅ (verify green; ui-reviewer/qa pending reset).
- [x] Build log + [[app_walkthrough]] updated.

## Definition of done

- Veterans can save/retrieve items and set optional preferences that improve results; nothing
  sensitive is requested; data stays on-device.

## Risks

- Scope creep toward accounts/sync — keep it local and optional.

## Related

[[Trust Safety and Privacy]] · [[Resource Data Model]] · [[User Personas]] · [[Phase 9 Trust and Verification]]
