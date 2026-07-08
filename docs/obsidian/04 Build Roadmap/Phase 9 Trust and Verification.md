---
tags: [roadmap, phase-9, mvp, trust]
status: planned
updated: 2026-07-07
---

# Phase 9 — Trust, Safety & Verification Surfacing

## Purpose

Make trust **explicit and consistent** everywhere. Trust is the product for a veteran-facing app.

## Included

- **Source + verification badges** on cards and detail pages (`source_type`, `verification_status`,
  `last_checked`), amber for unverified/outdated, green for verified — always with text.
- **Outdated/unverified warnings** when `last_checked` is stale or `source_type` is `unverified`.
- Persistent **"Frontline is a navigator, not the VA / a government agency"** disclaimer.
- **AI content labels** ("AI-generated — verify with source") applied consistently.
- **Emergency** path surfaces crisis resources (988 press 1, 911) rather than handling crises in-app.

## Excluded

- A real verification pipeline / community submissions (post-MVP — [[Non-MVP Ideas]]).

## Checklist

- [ ] Audit every resource surface for source + last-checked + verification display.
- [ ] Implement warning treatment for stale/unverified.
- [ ] Add persistent disclaimer + consistent AI labels.
- [ ] Emergency crisis-resource surfacing.
- [ ] `ui-reviewer` + `/slop-check`; `qa-tester` against [[MVP Acceptance Criteria]] section F.
- [ ] `/finish-task`: build log + [[app_walkthrough]].

## Definition of done

- Trust signals and disclaimers appear on every resource; unverified/outdated is clearly flagged;
  emergencies route to real crisis resources.

## Risks

- Trust UI becoming noise — make it legible and consistent, not alarming.

## Related

[[Trust Safety and Privacy]] · [[Resource Data Model]] · [[UI Design System]] · [[MVP Acceptance Criteria]]
