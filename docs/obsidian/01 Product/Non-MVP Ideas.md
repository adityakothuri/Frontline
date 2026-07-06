---
tags: [product, parking-lot]
status: parked
updated: 2026-07-05
---

# Non-MVP Ideas

Parked ideas. **None of these are built during the MVP** unless explicitly approved. Keeping
them here prevents scope creep while preserving good thinking. See [[Feature Priority Order]].

## Backend (Priority 9 — after frontend loop is clean)

- Supabase or Firebase persistence for users, cameras, detections, alerts, media metadata.
- Row-level security (if Supabase), expiration logic server-side, safe public/mobile keys only.

## Real AI / video (Priority 10)

- Real detection pipeline: video upload/stream sample, detection API, confidence, event
  clipping, thumbnail generation, AI-suggested descriptions, false-positive handling.
- Model/provider evaluation. **Do not pretend the MVP has real AI.**

## Real camera integrations (Priority 11)

- Ring-style integrations, RTSP, smart-home integrations, camera permissions, live stream
  handling, storage/security concerns. Complex — not casually built.

## Advanced community (Priority 12 — future)

- Comments, reactions, reputation, moderation, admin tools, verified neighborhoods,
  police/non-emergency integrations, subscriptions, organizations, analytics.

## Smaller parked ideas

- Custom expiration durations beyond the preset options.
- Anonymous vs identified posting nuances (revisit with privacy decision in [[Decision Log]]).
- Multi-neighborhood / radius tuning.

## Rule

If any of these becomes desirable, it goes through [[Feature Spec Template]] → approval →
[[Feature Priority Order]] update → a roadmap phase. It does **not** sneak into an MVP task.

## Related

[[MVP Definition]] · [[Feature Priority Order]] · [[Decision Log]]
