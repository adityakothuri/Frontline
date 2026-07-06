---
tags: [product, mvp, source-of-truth]
status: stable
updated: 2026-07-05
---

# MVP Definition

The MVP is a **polished, believable demo of the core loop**: AI detects → human reviews →
approved alert appears on a neighborhood map with expiration. Advanced integrations are
**simulated**, and labeled honestly as such.

## The MVP must prove

1. User can enter the app (sign in or **demo mode**).
2. User can view a polished home dashboard.
3. User can view **simulated** cameras.
4. A **simulated** AI detection can appear.
5. User can review that detection.
6. User can approve or reject it.
7. An approved detection becomes a public alert.
8. The alert appears on a neighborhood map.
9. User can view alert details.
10. The alert has expiration / auto-delete settings.

## The MVP must NOT require

- Real Ring / smart-camera integration
- Real continuous live streaming
- A real AI/vision model
- Police / emergency-services integration
- Advanced moderation
- Payments / subscriptions
- Comments or a social feed

(See [[Non-MVP Ideas]] and priorities 9–12 in [[Feature Priority Order]].)

## Honesty rule

Use clear internal naming — `mock`, `demo`, `simulated`, `prototype` — wherever a system is
not real. **Never make a fake integration look like a real production integration** in code or
docs. See [[Anti-AI-Slop Code Rules]].

## MVP definition of done

- The 10 "must prove" steps work end-to-end as a demo.
- The UI looks **designed**, not templated (see [[UI Design System]]).
- Simulated systems are clearly labeled.
- Each shipped feature has a build log + [[app_walkthrough]] entry.
- No unauthorized files or dependencies were introduced (see [[File Creation Policy]]).

## Related

[[Product Overview]] · [[Feature Priority Order]] · [[Phase 1 App Shell]] · [[Quality Gates]]
