---
tags: [product, roadmap, source-of-truth]
status: stable
updated: 2026-07-05
---

# Feature Priority Order

Features are built in this order of importance. Lower numbers first. **Do not jump ahead**
without approval — later priorities depend on earlier ones being clean.

| # | Priority | MVP? | Roadmap phase |
|---|----------|------|---------------|
| 0 | Foundation & project discipline | ✅ Now | [[Phase 0 Setup]] |
| 1 | Polished app shell | ✅ MVP | [[Phase 1 App Shell]] |
| 2 | Camera feed simulation | ✅ MVP | [[Phase 2 Camera Simulation]] |
| 3 | AI detection simulation | ✅ MVP | [[Phase 3 Detection Review]] |
| 4 | Human review flow | ✅ MVP (core) | [[Phase 3 Detection Review]] |
| 5 | Public neighborhood alert posting | ✅ MVP | [[Phase 4 Alert Posting]] |
| 6 | Map-based alert viewing | ✅ MVP | [[Phase 5 Map Alerts]] |
| 7 | Alert lifecycle & auto-delete | ✅ MVP | [[Phase 4 Alert Posting]] |
| 8 | Profile & settings | ✅ MVP (light) | [[Phase 6 Polish]] |
| 9 | Real backend integration | ❌ Post-MVP | [[Phase 7 Backend Integration]] |
| 10 | Real AI / video processing | ❌ Post-MVP | [[Phase 8 Real AI and Camera Research]] |
| 11 | Real camera integrations | ❌ Post-MVP | [[Phase 8 Real AI and Camera Research]] |
| 12 | Advanced community features | ❌ Future | [[Non-MVP Ideas]] |

## Reasoning

- **0 first** because uncontrolled building is the biggest risk to a demo-quality app.
  Discipline (scoping, logging, no slop) is cheaper to set up now than to retrofit.
- **1 before everything visual** — the app shell establishes Watchdog's identity. If the shell
  looks templated, nothing after it will feel premium.
- **2–4 prove the concept without real infra.** Simulated cameras + simulated detection let us
  demo the AI-assists-humans idea with zero external dependencies.
- **4 (human review) is the heart of the product** — it's the differentiator. AI detects; the
  human decides. Everything upstream feeds it; everything downstream depends on its output.
- **5–7 make it public + safe** — posting is intentional, alerts are local, and they expire so
  the map never goes stale.
- **8** rounds out trust (privacy, notifications, expiration defaults) without bloat.
- **9–11 come only after the frontend loop is clean.** Introducing Supabase/Firebase, a real
  model, or real camera SDKs before the UX is solid multiplies complexity and hides slop.
- **12 is explicitly future** — comments, moderation, reputation, orgs, payments. Not in MVP.

## Related

[[MVP Definition]] · [[Product Overview]] · [[Non-MVP Ideas]] · [[Watchdog Command Center]]
