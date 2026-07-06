---
tags: [template, feature-spec]
status: template
updated: 2026-07-05
---

# Feature Spec Template

Copy into `12 Feature Specs/` when planning a feature (before building). Naming:
`<Feature Name>.md`. A spec is required before any non-trivial feature — it's how scope gets
approved. Pairs with [[Feature Build Prompt]].

---

```md
---
tags: [feature-spec]
feature: <name>
phase: "Phase X — <name>"
status: proposed | approved | building | done
mvp: yes | no
---

# Feature Spec: <name>

## Summary
One paragraph: what this feature is and the user value.

## Why now
Which roadmap phase / priority this belongs to, and why it's next. ([[Feature Priority Order]])

## Scope
- **In scope:** ...
- **Explicitly out of scope:** ...

## User flow
Step by step (link/relate to [[App Flow]]).

## UI
Screens/components involved ([[Screens List]]); design notes ([[UI Design System]]).

## Data & types
Domain types, mock data shape, service interface (the honest seam — [[Technical Architecture]]).

## New files / dependencies (REQUIRES APPROVAL)
| Path | Kind | Purpose | MVP-critical? | Existing file instead? |
|------|------|---------|---------------|------------------------|
| ... | source/config/mock | ... | yes/no | ... |

## Definition of done
- ...
- Build log + [[app_walkthrough]] updated.

## Risks
- ...

## Related
[[Feature Priority Order]] · relevant phase · [[Decision Log]]
```

## Related

[[Feature Build Prompt]] · [[File Creation Policy]] · [[Feature Priority Order]]
