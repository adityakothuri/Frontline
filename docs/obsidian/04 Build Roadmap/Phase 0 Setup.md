---
tags: [roadmap, phase-0]
status: done
updated: 2026-07-07
---

# Phase 0 — Setup

## Purpose

Set up the project so development is controlled, readable, and production-minded **before** app
features exist. Discipline first. (Carried over from the previous build and reframed for Frontline.)

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
- Backend, AI, or data-ingestion integrations.

## Status

- [x] Obsidian vault structure created and (2026-07-07) **reframed to Frontline**.
- [x] `CLAUDE.md` has Frontline product context + workflow rules.
- [x] Roadmap phases written (Frontline).
- [x] File-creation policy documented ([[File Creation Policy]]).
- [x] Logging behavior documented ([[Production Workflow]]).
- [x] Workflow skills present (`/start-task`, `/finish-task`, `/log-session`, `/slop-check`).

## Definition of done

- Vault has useful structure; `CLAUDE.md` is complete and Frontline-accurate.
- Roadmap is clear; Claude knows not to create files without approval.
- Future sessions know how to log changes.

## Risks

- Over-documenting and never shipping — keep feature phases close behind.
- Docs drifting from reality — the `/finish-task` loop must keep them current.

## Related

[[Frontline Command Center]] · [[Phase 1 App Shell]] · [[File Creation Policy]] · [[Production Workflow]]
