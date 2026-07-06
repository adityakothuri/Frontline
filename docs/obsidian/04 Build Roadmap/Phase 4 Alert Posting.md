---
tags: [roadmap, phase-4, mvp]
status: not-started
updated: 2026-07-05
---

# Phase 4 — Public Alert Posting + Lifecycle

> Covers **Priority 5 (public alert posting)** and **Priority 7 (alert lifecycle & auto-delete)**.

## Purpose

Turn an approved detection into a public neighborhood alert that feels **intentional and safe**,
and keep alerts **temporary** so the map never goes stale.

## Included

**Posting**
- Alert model: title, description, location, media preview, expiration setting, category,
  status, created timestamp, expires timestamp, poster identity (per privacy decision).
- Posting feels deliberate (confirm-before-public, from [[Phase 3 Detection Review]]).

**Lifecycle**
- Expiration options: 1 hour, 6 hours, 24 hours, 3 days. (Custom = not MVP unless approved.)
- Auto-delete setting; expired status; removal from map; optional poster alert history.
- Clear user messaging about expiration.

## Excluded

- Backend persistence (Priority 9 — MVP alerts live in memory/local, clearly labeled).
- Custom expiration durations (parked — [[Non-MVP Ideas]]).

## Checklist

- [ ] **Approve** new files: `features/alerts/` (Alert type, mock store, posting + confirm UI,
  expiration logic).
- [ ] `Alert` type + expiration math (created/expires, is-expired helper — unit-tested,
  [[Testing Strategy]]).
- [ ] Post-confirm screen (edit → expiration → confirm).
- [ ] Expiration options UI (1h/6h/24h/3d).
- [ ] Expired alerts hidden/removed; clear messaging.
- [ ] Decide poster identity model → [[Decision Log]].
- [ ] `qa-tester` (expiration edge cases) + `/finish-task`.

## Definition of done

- An approved detection becomes a public alert with a chosen expiration.
- Alerts expire and are removed correctly; expiration is clearly communicated.
- Posting reads as intentional, not automatic (Principle 1 & 6). Logged.

## Risks

- Off-by-one/timezone bugs in expiration math — test them.
- Privacy ambiguity on poster identity — decide and record it.

## Related

[[Phase 3 Detection Review]] · [[Phase 5 Map Alerts]] · [[Product Principles]] · [[Testing Strategy]]
