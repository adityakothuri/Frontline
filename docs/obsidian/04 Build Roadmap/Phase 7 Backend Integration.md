---
tags: [roadmap, phase-7, post-mvp]
status: not-started
updated: 2026-07-05
---

# Phase 7 — Real Backend Integration

> **Priority 9 — Post-MVP.** Only after the frontend MVP loop is clean and demo-ready.

## Purpose

Move from mock/demo flows to real persisted data — without breaking the clean frontend.

## Included

- Backend choice: **Supabase** or **Firebase** (custom backend only if truly needed).
- Persist: users, cameras, detection events, alerts, media metadata.
- Server-side expiration logic.
- Row-level security (if Supabase).
- Environment variables; **safe public/mobile keys only** ([[Environment Variables]]).

## Excluded

- Real AI/video (Priority 10) and real camera integrations (Priority 11).

## Checklist

- [ ] **Decide + record** backend choice in [[Decision Log]] (weigh with `product-manager` /
  `react-native-architect`; verify SDK via Context7).
- [ ] **Approve** new files (client, schema, env). This is a large change — spec it first
  ([[Feature Spec Template]], [[File Creation Policy]]).
- [ ] Map existing typed mock services onto real services behind the **same interfaces**
  (the seam from [[Technical Architecture]]) so screens barely change.
- [ ] Auth (real or demo-compatible).
- [ ] RLS / security rules; no secret keys in the client.
- [ ] Migrate expiration to server-enforced.
- [ ] `qa-tester` + `/finish-task` + decision log.

## Definition of done

- Core entities persist to a real backend behind the existing interfaces.
- Security rules protect data; no secrets shipped in the app.
- Frontend behavior unchanged for the user. Logged + decision recorded.

## Risks

- Introducing backend complexity before the UX is clean (don't).
- Leaking service keys into the bundle ([[Environment Variables]]).
- Rewriting the frontend instead of swapping the service layer.

## Related

[[Technical Architecture]] · [[Environment Variables]] · [[Non-MVP Ideas]] · [[Phase 8 Real AI and Camera Research]]
