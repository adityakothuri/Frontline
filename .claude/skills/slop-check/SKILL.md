---
name: slop-check
description: Use to review Watchdog changes for AI-looking code and project-discipline violations. Checks for AI-slop (giant files, vague names, duplicate logic, fake complexity), unauthorized new files, unrelated changes, naming quality, TypeScript safety, and whether the Obsidian logs need updating. This is the project anti-slop reviewer; it does NOT replace the built-in /code-review multi-agent reviewer.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash
---

# Slop Check

Fast anti-AI-slop review of the current changes, tuned to Watchdog's standards
(`docs/obsidian/03 Technical/Anti-AI-Slop Code Rules.md`).

> This is the **project** reviewer, named `slop-check` so it does **not** shadow Claude Code's
> built-in `/code-review` (the multi-agent cloud reviewer). Use built-in `/code-review` for
> deep correctness passes; use this for a quick, opinionated anti-slop gate.

## What to check

1. **AI-looking code** — giant do-everything files; vague names (`Thing`, `Data`, `Stuff`,
   `Card2`, `handleStuff`); fake complexity / needless abstractions; huge repeated inline
   styles; dead code / unused files.
2. **Unauthorized files** — were any new app files/folders/dependencies created without
   approval? (`docs/obsidian/03 Technical/File Creation Policy.md`)
3. **Unrelated changes** — anything outside the task's scope bundled in.
4. **Duplicate logic/components** — same job done in two places.
5. **Naming quality & consistency** — components `PascalCase`, consistent file naming, clear
   intent.
6. **TypeScript safety** — no stray `any`; real domain types; typed props and data.
7. **Mock honesty** — simulation labeled `mock`/`demo`; believable data (no `Camera 1`, no
   `Lorem ipsum`); nothing fake dressed up as a real integration.
8. **Logs** — do the build log / `app_walkthrough` / decision log need updating for this change?

## How to run

- Inspect the diff / changed files (git diff if a repo exists, else the touched files).
- Cite **file:line** for each issue with a concrete fix.

## Output

- What's clean · Issues (severity, file:line, fix) · Whether logs need updating ·
  Verdict: **pass** or **needs-revision**.

Optionally record the result via `docs/obsidian/11 Claude Reviews/Claude Review Template.md`.
See `docs/obsidian/05 Claude Prompts/Code Review Prompt.md`.
