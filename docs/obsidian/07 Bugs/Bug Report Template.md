---
tags: [template, bug]
status: template
updated: 2026-07-05
---

# Bug Report Template

Copy into a new file in `07 Bugs/` when a bug is discovered or fixed. Naming:
`YYYY-MM-DD <short bug title>.md`.

---

```md
---
tags: [bug]
date: YYYY-MM-DD
severity: low | medium | high | critical
status: open | in-progress | fixed | wont-fix
area: <feature/area>
---

# Bug: <short title>

## Summary
One line: what's wrong.

## Steps to reproduce
1. ...
2. ...

## Expected
What should happen.

## Actual
What happens instead (include error text / screenshot ref).

## Root cause
Why it happens (once known).

## Fix
What changed to fix it. Link the build log.

## Prevention
Test added? Type made stricter? Pattern to avoid? (See [[Anti-AI-Slop Code Rules]].)

## Related
- Build log: [[YYYY-MM-DD <task>]]
- Decision: [[Decision Log]] (if the fix changed a flow)
- Walkthrough updated? [[app_walkthrough]] (if the fix changed how a flow works)
```

## Related

[[Testing Strategy]] · [[Quality Gates]] · [[Production Workflow]]
