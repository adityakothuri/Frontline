---
tags: [roadmap, phase-9, mvp, trust]
status: done
updated: 2026-07-11
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

- [x] Audit every resource surface for source + last-checked + verification display
      (map preview was the gap → shared `SourceRow` now on card, detail, preview).
- [x] Implement warning treatment for stale/unverified (`trustWarning()` on detail).
- [x] Add persistent disclaimer (`NavigatorDisclaimer` on Home/Results/detail) + AI labels
      (already consistent via `AiContentBlock`, confirmed in audit).
- [x] Emergency crisis-resource surfacing (`CrisisBanner`: 911 text-only, 988-press-1 call;
      survives loading/error/empty/list/map branches).
- [x] `ui-reviewer` (all findings fixed in-task) + `/slop-check` (pass); `qa-tester` **PASS**
      against [[MVP Acceptance Criteria]] section F.
- [x] `/finish-task`: build log [[2026-07-11 Phase 9 Trust and Verification Surfacing]] +
      [[app_walkthrough]]. ⚠️ On-device tap-through still pending.

## Definition of done

- Trust signals and disclaimers appear on every resource; unverified/outdated is clearly flagged;
  emergencies route to real crisis resources.

## Risks

- Trust UI becoming noise — make it legible and consistent, not alarming.

## Related

[[Trust Safety and Privacy]] · [[Resource Data Model]] · [[UI Design System]] · [[MVP Acceptance Criteria]]
