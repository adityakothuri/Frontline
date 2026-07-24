---
tags: [claude, prompts]
status: stable
updated: 2026-07-05
---

# Finish Task Prompt

Use to close out a task. Backed by the `/finish-task` skill.

```text
/finish-task

Wrap up the current task:
1. Inspect changed files; confirm scope only (no unrelated changes, no unauthorized files).
2. Run quality checks (.claude/hooks/quality-check.sh / typecheck / lint / test).
3. qa-tester review. ui-reviewer review if UI changed. Optional /slop-check on the diff.
4. Update the build log (06 Build Logs/, dated).
5. If a moderate/meaningful change: update docs/obsidian/10 App Walkthrough/app_walkthrough.md.
6. Update decision log / bug log / feature spec if relevant.
7. Update the Command Center current + next task.
8. List remaining risks and recommend the next step.
```

## Checklist the skill enforces

- [ ] Changed files inspected; scope respected
- [ ] Quality checks run ([[Quality Gates]])
- [ ] QA (+ UI) review done
- [ ] Build log updated ([[Build Log Template]])
- [ ] [[app_walkthrough]] updated if meaningful
- [ ] [[Decision Log]] / bug / feature spec updated if needed
- [ ] [[Frontline Command Center]] current/next task updated
- [ ] Risks listed; next step recommended

## Related

[[Start Task Prompt]] · [[Code Review Prompt]] · [[Production Workflow]] · [[app_walkthrough]]
