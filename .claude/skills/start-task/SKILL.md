---
name: start-task
description: Use at the START of any Watchdog task or feature. Reads CLAUDE.md and the Obsidian Command Center, identifies the exact task, classifies MVP vs non-MVP, lists files likely to change and any new files/dependencies needed, requires approval before creating new app files, and produces a plan before coding.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash
---

# Start Task

Begin a Watchdog task the disciplined way. **Do not write code until the plan is approved.**

## Steps (do all, in order)

1. **Load context.** Read `CLAUDE.md` and
   `docs/obsidian/00 Start Here/Watchdog Command Center.md`. Confirm the current **phase**,
   **active task**, and **next task**.
2. **Identify the exact task.** State it in one or two sentences. If it's vague or feature-sized
   or scope is unclear, delegate to the `product-manager` subagent to scope it (MVP / non-MVP /
   unclear, what's excluded, definition of done).
3. **Classify:** MVP or non-MVP? If non-MVP, confirm with the user before proceeding (it may
   belong in `docs/obsidian/01 Product/Non-MVP Ideas.md`).
4. **Architecture pass.** For implementation work, use the `react-native-architect` subagent to
   propose the approach (verify library APIs with Context7).
5. **List files.**
   - Files likely to **change** (existing).
   - **New** files or dependencies needed — for each: exact path, purpose, contents, kind
     (source/config/docs/tests/mock/generated), MVP-critical?, and whether an existing file
     could be updated instead.
6. **Get approval for new app files/dependencies.** New app source files, folders, components,
   dependencies, config systems, backend files, and schemas require explicit approval
   **before** creation — see `docs/obsidian/03 Technical/File Creation Policy.md`.
7. **Produce a short plan.** Scope, excluded work, definition of done, files, risks. Then stop
   and wait for approval.

## Rules

- One task at a time. No "build everything."
- Do not create new app files/dependencies without approval (step 6).
- Ground scope in the vault, not assumptions.

## Output

- Task (one line) · MVP/non-MVP · Approach · Files to change · New files (for approval) ·
  Definition of done · Risks · "Awaiting approval to proceed."

Pairs with `/finish-task`. See `docs/obsidian/05 Claude Prompts/Start Task Prompt.md`.
