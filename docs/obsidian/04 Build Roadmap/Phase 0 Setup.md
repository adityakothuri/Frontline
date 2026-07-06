---
tags: [roadmap, phase-0]
status: in-progress
updated: 2026-07-05
---

# Phase 0 — Setup

## Purpose

Set up the project so development is controlled, readable, and production-minded **before** any
app features exist. Discipline first.

## Included

- Clean project docs (this Obsidian vault).
- Clear MVP definition and non-MVP boundaries.
- Technical architecture direction + folder-structure rules.
- Design system direction.
- Quality gates + Claude workflow (skills, subagents, hook).
- Build logs, decision logs, app-walkthrough scaffolding.
- File-creation discipline; no "build everything" coding.

## Excluded

- Any app source code, screens, components, or dependencies.
- Backend, AI, or camera integrations.

## Checklist

- [x] Obsidian vault structure created.
- [x] `CLAUDE.md` has product context + workflow rules.
- [x] Roadmap phases written.
- [x] File-creation policy documented ([[File Creation Policy]]).
- [x] Logging behavior documented ([[Production Workflow]]).
- [x] Workflow skills created (`/start-task`, `/finish-task`, `/log-session`, `/slop-check`).
- [ ] (Next) `git init` and first commit of the project brain — *approve as a task*.

## Definition of done

- Vault has useful structure; `CLAUDE.md` is complete.
- Roadmap is clear; Claude knows not to create files without approval.
- Future sessions know how to log changes.

## Risks

- Over-documenting and never shipping — keep Phase 1 close behind.
- Docs drifting from reality — the `/finish-task` loop must keep them current.

## Related

[[Watchdog Command Center]] · [[Phase 1 App Shell]] · [[File Creation Policy]] · [[Production Workflow]]
