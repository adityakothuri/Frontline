---
tags: [technical, policy, source-of-truth, must-follow]
status: stable
updated: 2026-07-05
---

# File Creation Policy

**Canonical rule. This is one of the most important documents in the vault.** It is mirrored
in `CLAUDE.md`. Claude must not create new app files/directories casually.

## The rule

For any **moderate or major change**, before creating a new file Claude must state:

1. **Why** the new file is needed.
2. The **exact file path**.
3. **What** the file will contain.
4. The **kind**: source code / config / docs / tests / mock data / generated output.
5. Whether it is **MVP-critical**.
6. Whether an **existing file could be updated instead**.
7. Then **wait for approval** before creating it.

## Allowed WITHOUT asking

- Updating existing docs.
- Creating **dated build logs** when finishing a task (`06 Build Logs/`).
- Creating/updating required **Obsidian log entries** ([[app_walkthrough]], [[Decision Log]],
  bug reports, feature specs).
- Creating documentation files **explicitly requested** during a docs/setup task.

## NOT allowed without asking

- New React Native **screens**.
- New **source folders**.
- New **components**.
- New **libraries / dependencies**.
- New **config systems**.
- New **backend files**.
- New **database schemas**.
- New **automation scripts**.
- New **generated assets**.
- New **test setup**.
- New **architecture patterns**.

## After approval

For small, obvious edits **inside already-approved files**, Claude may proceed. But **new
files must be called out first**, every time.

## Why this exists

Uncontrolled file creation is the #1 cause of an app that feels like AI slop — random screens,
duplicate components, dead files, unexplained systems. Discipline here keeps Frontline
understandable and production-minded. See [[Anti-AI-Slop Code Rules]] and [[Product Principles]]
(principle 10).

## Related

[[Anti-AI-Slop Code Rules]] · [[Production Workflow]] · [[Folder Structure]] · [[Frontline Command Center]]
