# Branching Strategy

A simple, disciplined model. Related: [GitHub Setup](GitHub%20Setup.md) ·
[Pull Request Checklist](Pull%20Request%20Checklist.md) ·
[Release Process](Release%20Process.md) ·
[Git Workflow](../obsidian/03%20Technical/Git%20Workflow.md).

## Model

```text
main  ── stable, always demo-able ◄── PRs from dev (or release branches)
 dev  ── active development ◄── PRs from feature/fix/docs/chore branches
```

- **`main`** stays working at all times. Only merged via reviewed PRs.
- **`dev`** integrates day-to-day work.
- **`feature/…` etc.** are short-lived, **one task each**, branched off `dev`.

## One task per branch

Each branch does exactly one scoped task (matches `/start-task` → `/finish-task`). This keeps
PRs small, reviewable, and easy to log in the Obsidian build log.

## Naming

```text
feature/phase-1-navigation
feature/guided-need-flow
fix/resource-card-empty-state
chore/github-ci
docs/update-readme
refactor/resource-types
```

## When to create a branch

- **Before** any meaningful code change. Confirm or create the task branch as the first step,
  never commit feature work directly to `main`.

## When to merge

- When the task's definition of done is met, checks pass, reviews are done, and the Obsidian
  logs are updated (see [Pull Request Checklist](Pull%20Request%20Checklist.md)).
- Merge feature branch → `dev`. Periodically merge `dev` → `main` for a stable checkpoint.

## Avoiding giant PRs

- Split large work into sequential tasks/branches.
- No unrelated changes in a branch. If you notice something else, file a task/issue for it.
- If a PR is growing beyond one task, stop and split it.

## How Claude uses branches

- Claude confirms/creates a task branch before meaningful code changes.
- Claude does **not** commit or push unless explicitly asked.
- Claude **never** force-pushes, rewrites history, or deletes branches unless explicitly
  instructed.

## Related

[Git Workflow](../obsidian/03%20Technical/Git%20Workflow.md) ·
[Production Workflow](../obsidian/03%20Technical/Production%20Workflow.md) ·
[GitHub Setup](GitHub%20Setup.md)
