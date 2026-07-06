---
tags: [roadmap, phase-5, mvp]
status: not-started
updated: 2026-07-05
---

# Phase 5 — Map-Based Alert Viewing

## Purpose

Let nearby users see what's happening around them. The map is one of the most important demo
visuals — it should feel polished, simple, and useful.

## Included

- Alert markers on a mini map / full map.
- Marker styling by severity/category.
- Alert preview card (tap a marker).
- Alert detail sheet/screen.
- Expired alerts hidden.
- Empty state when no alerts nearby.
- User-location handling **with privacy in mind**.

## Excluded

- Real-time backend sync (Priority 9).
- Precise/real location tracking beyond what the demo needs (privacy — [[Product Principles]]).

## Checklist

- [ ] **Approve** map library choice + any new files (`features/map/`). Verify the RN map lib
  via Context7; record choice in [[Decision Log]].
- [ ] Subtle/muted map styling so markers are the focus ([[UI Design System]]).
- [ ] Render alert markers from the alert store; style by severity/category.
- [ ] Marker tap → preview card → detail sheet.
- [ ] Hide expired alerts; polished empty state.
- [ ] Privacy-conscious location handling (coarse, permissioned).
- [ ] `ui-reviewer` (this is a hero visual) + `/finish-task`.

## Definition of done

- Alerts appear as styled markers; tapping shows preview + detail.
- Expired alerts don't show; empty state is polished.
- Location handling respects privacy. Logged.

## Risks

- Cluttered/over-styled map (keep it calm — [[UX Principles]]).
- Location privacy missteps (Principle 3).
- Heavy map dependency — choose deliberately.

## Related

[[Phase 4 Alert Posting]] · [[UI Design System]] · [[App Flow]] · [[Phase 6 Polish]]
