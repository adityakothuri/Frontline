---
tags: [template, build-log]
status: template
updated: 2026-07-05
---

# Build Log Template

Copy this into a new dated file in `06 Build Logs/` when finishing a task. Naming:
`YYYY-MM-DD <short task name>.md` (e.g. `2026-07-12 App Shell Navigation.md`). One log per task.

---

```md
---
tags: [build-log]
date: YYYY-MM-DD
phase: "Phase X — <name>"
task: <task name>
status: done | partial | blocked
---

# <YYYY-MM-DD> — <Task Name>

## Task
What was requested (one or two lines).

## Scope
- In scope: ...
- Explicitly out of scope: ...

## Changes
| File | Change | New? (approved?) |
|------|--------|------------------|
| path/to/file | what changed | new — approved / edited |

## Quality checks
- typecheck: pass / fail / n-a
- lint: pass / fail / n-a
- test: pass / fail / n-a
- manual run: what you exercised and what happened

## Reviews
- ui-reviewer: verdict / notes (if UI changed)
- qa-tester: verdict / notes
- /slop-check: verdict / notes

## Logs updated
- [ ] app_walkthrough (if meaningful) → link
- [ ] decision log (if a decision) → link
- [ ] bug log (if a bug) → link
- [ ] Command Center current/next task

## Risks / follow-ups
- ...

## Next step
- ...
```

## Related

[[Production Workflow]] · [[Finish Task Prompt]] · [[app_walkthrough]] · [[Frontline Command Center]]
