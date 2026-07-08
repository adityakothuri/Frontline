---
name: log-session
description: Use to record a work session in the Frontline Obsidian vault without the full finish-task flow. Creates/updates the build log and updates the app_walkthrough, decision log, bug log, and Command Center as needed.
user-invocable: true
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# Log Session

Capture what happened in a session into the project brain. Lighter than `/finish-task` (which
also runs checks + reviews) — use this to catch up logs, or at the end of an exploratory
session.

## Steps

1. **Summarize the session.** What was done, decided, or discovered.
2. **Build log.** Create/update a dated file in `docs/obsidian/06 Build Logs/` using
   `Build Log Template.md`.
3. **App walkthrough — if meaningful code was added/changed.** Append an entry to
   `docs/obsidian/10 App Walkthrough/app_walkthrough.md` (see the "meaningful" definition in
   `/finish-task`). Skip for trivial changes.
4. **Decision log — if a product/architecture decision was made.**
   `docs/obsidian/08 Decisions/Decision Log.md`.
5. **Bug log — if a bug was found/fixed.** `docs/obsidian/07 Bugs/` (Bug Report Template).
6. **Command Center — if phase/current/next task changed.**
   `docs/obsidian/00 Start Here/Frontline Command Center.md`.

## Rules

- Only update what actually changed — don't manufacture entries.
- Keep entries concise and honest. Link related notes with wikilinks.
- This does **not** run quality checks or reviews — use `/finish-task` to close a real task.

## Output

- What was logged and where (links). What was intentionally not updated and why.
