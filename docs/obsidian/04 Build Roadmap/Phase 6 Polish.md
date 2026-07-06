---
tags: [roadmap, phase-6, mvp]
status: not-started
updated: 2026-07-05
---

# Phase 6 — Profile, Settings & Polish

> Covers **Priority 8 (profile & settings)** plus the final MVP polish pass.

## Purpose

Round out trust with light profile/settings, and polish the whole demo loop so it feels like a
serious, funded product.

## Included

**Profile & settings** (support trust, don't bloat)
- Profile screen.
- Notification preferences.
- Privacy settings.
- Camera settings.
- Default alert expiration.
- Demo-mode indicator.
- Sign out.

**Polish pass**
- Consistency sweep across screens (spacing, type, color meaning).
- Loading/empty/error states audited everywhere.
- Believable mock data everywhere ([[Anti-AI-Slop Design Rules]]).
- Motion/micro-interactions where they add clarity (subtle, purposeful).

## Excluded

- Real account system / backend settings persistence (Priority 9).
- Advanced settings bloat.

## Checklist

- [ ] **Approve** new files: `features/profile/`.
- [ ] Profile + settings screens (minimal, trust-focused).
- [ ] Default-expiration + notification + privacy toggles (local/mock).
- [ ] Visible **demo-mode** indicator.
- [ ] Full-app `ui-reviewer` polish pass; fix inconsistencies.
- [ ] Full-loop `qa-tester` run of [[App Flow]].
- [ ] `/finish-task` + app_walkthrough updated; Command Center → MVP complete.

## Definition of done

- Settings are minimal and support trust.
- The end-to-end demo loop is polished and consistent.
- MVP "must prove" steps ([[MVP Definition]]) all pass. Logged.

## Risks

- Settings bloat.
- Polish that never ends — timebox it.

## Related

[[MVP Definition]] · [[UI Design System]] · [[Phase 5 Map Alerts]] · [[Phase 7 Backend Integration]]
