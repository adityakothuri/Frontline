---
tags: [design, screens]
status: active
updated: 2026-07-07
---

# Screens List

The screens needed for the MVP demo loop, grouped by area. Screens are **created with approval**
during their roadmap phase — this list is the plan, not a build order to run unattended.

## Entry & shell

| Screen | Purpose | Phase |
|--------|---------|-------|
| Welcome / entry | Establish identity; enter (no login required) | [[Phase 1 App Shell]] |

## Core tabs (bottom navigation)

| Screen | Purpose | Phase |
|--------|---------|-------|
| Home | Personal landing: greeting + random message + "How was X?" review feed (or Explore-help CTA) | [[2026-07-08 Home Redesign Discover Tab Fullscreen Map]] ✅ redesigned 2026-07-08 |
| Discover | Shell row (All/Food/Clothes/VA Help/Employment/Other) over all opportunities; Other → full category list | [[2026-07-08 Home Redesign Discover Tab Fullscreen Map]] ✅ built 2026-07-08 |
| Resources (list) | Nearby resources as scannable cards | [[Phase 4 Resource List and Detail]] |
| Map | Nearby resources as category pins — a **dedicated bottom-nav tab** (`app/(tabs)/map.tsx`, all opportunities) **and** a List⇄Map toggle inside Results | [[Phase 5 Map and Discovery]] ✅ tab added 2026-07-08 |
| Saved | Saved resources, benefits, scripts, checklists | [[Phase 8 Saved and Profile]] |
| Profile | Optional-only veteran preferences | [[Phase 8 Saved and Profile]] |

## Core flow screens / modals

| Screen / element | Purpose | Phase |
|------------------|---------|-------|
| Guided need flow | Category → short questions → structured need + location/ZIP | [[Phase 3 Guided Need Flow]] |
| Resource detail | Summary · eligibility · documents · contact · trust · next steps · call script | [[Phase 4 Resource List and Detail]] ✅ built 2026-07-08 |
| Call script sheet | Generated script + nervous-user variant | Inline (templated) in Phase 4; dedicated sheet [[Phase 6 AI Plans and Call Scripts]] |
| Benefit summary | AI plain-English summary of a benefit/document | Inline (templated) in Phase 4 detail; deepened [[Phase 7 AI Summarization]] |
| "What should I bring?" checklist | Documents to bring for a resource | [[Phase 4 Resource List and Detail]] ✅ built 2026-07-08 |
| Empty / Loading / Error states | Every screen has all three | All phases |

## Later (post-MVP)

| Screen | Purpose | Phase |
|--------|---------|-------|
| Live data / official sources | Resources from verified official/directory sources | [[Phase 10 Backend and Data Ingestion]] |
| Apply / claims (future) | Application or claims hand-off | [[Non-MVP Ideas]] |

## Notes

- Navigation is the reused bottom-tab + stack shell from [[Phase 1 App Shell]]; record structural
  calls in [[Decision Log]].
- Keep the tab bar minimal and legible; big tap targets and accessible labels. See
  [[UI Design System]].

## Related

[[App Flow|Core User Flows]] · [[Map and Search Design]] · [[UI Design System]] · [[User Stories]]
