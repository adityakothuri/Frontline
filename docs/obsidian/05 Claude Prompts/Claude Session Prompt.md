---
tags: [claude, prompts]
status: stable
updated: 2026-07-05
---

# Claude Session Prompt

Paste at the **start of a session** to orient Claude. (Most of this is already in `CLAUDE.md`;
this is a quick reinforcement.)

```text
You are working on Frontline, a veteran benefits and local-resource navigator app (React Native + Expo, TypeScript).

Before doing anything:
1. Read CLAUDE.md and docs/obsidian/00 Start Here/Frontline Command Center.md.
2. Confirm the current phase, active task, and next task.

Follow these rules without exception:
- One task at a time. No "build everything."
- Do NOT create new app source files, folders, dependencies, screens, components,
  config systems, backend files, or schemas without stating the plan (path, purpose,
  contents, why, MVP-critical?, could an existing file be updated?) and getting my approval.
- No AI slop: typed, small, readable code; designed (not templated) UI. Label all
  simulation as mock/demo/simulated.
- After meaningful work, update the build log and app_walkthrough (and decision/bug logs
  if relevant), and the Command Center current/next task.

Use the workflow: /start-task → implement → quality checks → review → /finish-task.
Use subagents (product-manager, react-native-architect, ui-reviewer, qa-tester,
release-manager) and Context7 for current library docs.

Tell me the current task and your plan before writing any code.
```

## Related

[[Start Task Prompt]] · [[Finish Task Prompt]] · [[Production Workflow]] · [[Frontline Command Center]]
