---
name: finish-task
description: Use to CLOSE OUT a Frontline task. Inspects changed files, runs quality checks, runs QA (and UI) review, then updates the Obsidian logs — build log, app_walkthrough (for meaningful changes), decision log, bug log — and the Command Center current/next task, lists risks, and recommends the next step.
user-invocable: true
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# Finish Task

Complete a task and keep the project brain in sync. **A task is not done until this runs.**

## Steps (do all, in order)

1. **Inspect changed files.** Confirm only approved scope changed — no unrelated changes, no
   unauthorized new files (`docs/obsidian/03 Technical/File Creation Policy.md`).
2. **Run quality checks.** Run `.claude/hooks/quality-check.sh` (typecheck → lint → test, only
   the scripts that exist). Report pass/fail/n-a honestly. For runtime behavior, **run the app
   and exercise the flow** — don't assume.
3. **QA review.** Use the `qa-tester` subagent.
4. **UI review (if UI changed).** Use the `ui-reviewer` subagent (anti-slop design pass). You
   may also run `/slop-check` on the diff.
5. **Update the build log.** Create a dated file in `docs/obsidian/06 Build Logs/` using
   `Build Log Template.md` (naming `YYYY-MM-DD <task>.md`).
6. **Update the app walkthrough — if the change was moderate/meaningful.** Append a feature
   entry to `docs/obsidian/10 App Walkthrough/app_walkthrough.md` using
   `App Walkthrough Template.md`. "Meaningful" = new screen, feature folder, user flow, state
   logic, API/backend logic, DB schema, navigation, design-system impl, reusable component
   pattern, important refactor, or a bug fix that changes how a flow works. **Skip** for
   typos/formatting/trivial copy.
7. **Update other logs if relevant.**
   - Decision made? → `docs/obsidian/08 Decisions/Decision Log.md`.
   - Bug found/fixed? → `docs/obsidian/07 Bugs/` (Bug Report Template).
   - New feature planned/implemented? → `docs/obsidian/12 Feature Specs/`.
8. **Update the Command Center.** Set current phase / active task / next recommended task in
   `docs/obsidian/00 Start Here/Frontline Command Center.md`.
9. **List remaining risks** and **recommend the next step.**

## Guarantees

- Never auto-formats or edits app source as a side effect of logging.
- Logging lives here (and in `/log-session`), **not** in a fragile hook.
- Report checks honestly; a green typecheck is not "it works."

## Output

- Changed files (scope OK?) · Checks (results) · Reviews (verdicts) · Logs updated (links) ·
  Command Center updated · Risks · Next step.

Pairs with `/start-task`. See `docs/obsidian/05 Claude Prompts/Finish Task Prompt.md`.
