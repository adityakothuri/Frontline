---
tags: [technical, workflow, source-of-truth]
status: stable
updated: 2026-07-05
---

# Production Workflow

Every task follows this loop. It maps to the workflow skills and subagents.

## The loop

```
task branch  →  /start-task  →  implement (approved scope only)  →  quality checks  →  review  →  /finish-task  →  PR
```

### 1. Start — `/start-task`
- **Create or confirm a task branch** (one task per branch — see
  [Branching Strategy](../../github/Branching%20Strategy.md)). Never do feature work on `main`.
- Read `CLAUDE.md` and [[Frontline Command Center]].
- Identify the **exact** task; classify MVP / non-MVP (use `product-manager` if scope is fuzzy).
- List files likely to change and any **new files needed** — get approval for new app files
  ([[File Creation Policy]]).
- Use `react-native-architect` before implementation.
- Produce a plan before coding.

### 2. Implement
- Build **only the approved scope**. No unrelated features. No unapproved files.
- Keep it typed, small-filed, and readable ([[Anti-AI-Slop Code Rules]]).

### 3. Quality checks
- Post-edit hook runs `typecheck`/`lint`/`test` automatically ([[Quality Gates]]).
- Run the app / exercise the flow for anything with runtime behavior.

### 4. Review
- `ui-reviewer` for any visual change ([[Anti-AI-Slop Design Rules]]).
- `qa-tester` before completion.
- `/slop-check` for an anti-AI-slop pass on the diff.

### 5. Finish — `/finish-task`
- Update the **build log** (`06 Build Logs/`, see [[Build Log Template]]).
- Update **[[app_walkthrough]]** if the change was moderate/meaningful.
- Update [[Decision Log]] / bugs / [[Feature Spec Template|feature spec]] if relevant.
- Update [[Frontline Command Center]] current/next task.
- List remaining risks; recommend the next step.

### 6. Pull request
- Run `verify` (quality gates), then open a PR using the
  [PR template](../../../.github/pull_request_template.md). Confirm scope, checks, UI review,
  and that the Obsidian logs were updated — see
  [Pull Request Checklist](../../github/Pull%20Request%20Checklist.md).
- Do **not** commit or push unless explicitly asked. Never force-push.

## One task at a time

No batching multiple features. Finish and log one before starting the next. See
[[Frontline Command Center]] "Rules That Must Not Be Broken."

## Related

[[Quality Gates]] · [[Git Workflow]] · [[File Creation Policy]] · [[Claude Session Prompt]] ·
[Branching Strategy](../../github/Branching%20Strategy.md)
