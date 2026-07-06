---
tags: [claude, prompts]
status: stable
updated: 2026-07-05
---

# Start Task Prompt

Use to begin a task. Backed by the `/start-task` skill.

```text
/start-task

Task: <describe the one task>

Before coding:
1. Read CLAUDE.md + Command Center. Confirm current phase.
2. Classify this task: MVP or not? (Use product-manager if scope is unclear.)
3. Use react-native-architect to propose the implementation approach.
4. List:
   - files likely to change
   - any NEW files/dependencies needed (path, purpose, contents, kind, MVP-critical?,
     could an existing file be updated instead?)
5. Ask for my approval on any new app files/dependencies.
6. Give me a short plan. Do not write code until I approve.
```

## Checklist the skill enforces

- [ ] Read `CLAUDE.md` + [[Watchdog Command Center]]
- [ ] Exact task identified
- [ ] MVP / non-MVP classified
- [ ] Files likely to change listed
- [ ] New files/deps called out for approval ([[File Creation Policy]])
- [ ] Plan produced before coding

## Related

[[Finish Task Prompt]] · [[Feature Build Prompt]] · [[Production Workflow]]
