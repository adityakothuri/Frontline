---
tags: [design, flow]
status: draft
updated: 2026-07-05
---

# App Flow

The core MVP journey, end to end. This mirrors the [[MVP Definition]] "must prove" steps.

## Core loop

```
Enter (demo/sign-in)
      │
      ▼
Home dashboard ──────────────► Cameras (simulated)
      │                              │
      │                              ▼
      │                        Camera detail (mock feed + timeline)
      ▼
Review queue  ◄── simulated AI detection appears (notification / in-app item)
      │
      ▼
Detection detail
   ├─ Reject ──► stays private, removed from queue
   └─ Approve ─► edit description + choose expiration ─► confirm public post
                                                              │
                                                              ▼
                                                     Public alert created
                                                              │
                                                              ▼
                                                Map (nearby users see marker)
                                                              │
                                                              ▼
                                                Alert detail sheet
                                                              │
                                                              ▼
                                            Expires → auto-deleted → removed from map
```

## Key transitions & guarantees

- **Detection → public** *only* through explicit **Approve → confirm**. No auto-posting.
  (Principle 1–2 in [[Product Principles]].)
- **Reject** keeps footage private (Principle 3).
- **Expiration** is chosen before posting and enforced afterward (Principle 6). See
  [[Phase 4 Alert Posting]].
- Every step has loading/empty/error coverage (see [[UI Design System]]).

## Related

[[Screens List]] · [[Product Overview]] · [[User Stories]] · [[Phase 3 Detection Review]]
