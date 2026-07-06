---
tags: [technical, git, workflow]
status: draft
updated: 2026-07-05
---

# Git Workflow

Lightweight, disciplined git. Uses the `github` skill for PR/branch operations. Full GitHub
workflow guides live in `docs/github/`:
[Branching Strategy](../../github/Branching%20Strategy.md) ·
[Pull Request Checklist](../../github/Pull%20Request%20Checklist.md) ·
[Release Process](../../github/Release%20Process.md) ·
[GitHub Setup](../../github/GitHub%20Setup.md).

## Branching

- `main` stays working/demo-able at all times; `dev` integrates active work.
- **Before any meaningful code change, create or confirm a task branch** — never commit
  feature work directly to `main`.
- One branch per task/feature: `feature/<area>-<short>`, `fix/<short>`, `docs/<short>`,
  `chore/<short>`. One task per branch (matches [[Production Workflow]]).
- **After** meaningful code changes: run quality checks and update the Obsidian logs **before**
  opening a PR or committing.

## Commits

- Small, focused, present-tense messages: `feat(cameras): add simulated camera list`.
- Don't mix unrelated changes in one commit (an anti-slop tell — see [[Anti-AI-Slop Code Rules]]).
- Commit docs/log updates alongside the change they describe.

## Before committing

- Quality gates pass ([[Quality Gates]]).
- No secrets committed; `.env*` and `.mcp.json` are git-ignored ([[Environment Variables]]).
- Build log + [[app_walkthrough]] updated for meaningful changes.

## Repo hygiene

- `docs/obsidian/` **notes are version-controlled**; `docs/obsidian/.obsidian/` (app state) is
  ignored.
- No committed `node_modules/`, build artifacts, or generated output.

## Repo state

The repo **is git-initialized** locally on `main` (no commits yet — the first commit is yours
to make). There is **no remote yet**; creating the private GitHub remote is a deliberate,
approved step — see [GitHub Setup](../../github/GitHub%20Setup.md). Claude never commits,
pushes, force-pushes, rewrites history, or creates/changes the remote without explicit
instruction.

## Related

[[Release Workflow]] · [[Production Workflow]] · [[Environment Variables]] ·
[GitHub Setup](../../github/GitHub%20Setup.md) ·
[Branching Strategy](../../github/Branching%20Strategy.md)
