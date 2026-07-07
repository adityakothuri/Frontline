---
tags: [command-center, start-here]
status: active
phase: "Phase 1 — App Shell"
updated: 2026-07-06
---

# Watchdog Command Center

> **Neighborhood safety, verified by people.**
> This is the single entry point for the Watchdog project. Start here every session.

---

## Current Status

🟢 **Phase 1 — App Shell complete.** On top of the Phase 0 foundation, the app now has a real
**expo-router** shell with a **Manrope + dark design system**: a welcome / demo-entry screen,
bottom-tab navigation (Home, Cameras, Map, Review, Profile), typed design tokens, eight reusable
components, and a Home dashboard with loading / error / empty states over clearly-labeled mock
data. `npm run verify` passes, `expo-doctor` is 20/20, and it bundles cleanly (1139 modules).
Reviews: ui-reviewer PASS (a11y + accent fixes applied), qa-tester PASS, slop-check PASS. It is
**shell only** — no real cameras, detection, map data, posting, or backend (Phases 2+). Committed
locally on `main` + `feature/phase-0-app-foundation`; Phase 1 work is uncommitted on the working
tree (awaiting go-ahead) and **push is still blocked on `gh auth login`**.

## Current Phase

**[[Phase 1 App Shell]]** — polished, navigable shell (done). Foundation: [[Phase 0 Setup]].

## Current Active Task

**✅ Done — Phase 1 app shell.** expo-router (`app/` routes) + Manrope, `src/theme` tokens,
`src/components` primitives, Home mock dashboard, designed empty/loading/error states. Build log:
[[2026-07-06 Phase 1 App Shell]]. Walkthrough: [[app_walkthrough]]. Decisions: [[Decision Log]].

## Next Recommended Task

**Phase 2 — Camera Simulation.** Build the Cameras tab for real: a `src/features/cameras/` folder
(simulated camera list + status + a mock feed / event timeline), consumed by `app/(tabs)/cameras.tsx`,
using the existing tokens/components. ⚠️ Requires approval for each new app file/dependency
([[File Creation Policy]]). See [[Phase 2 Camera Simulation]] and [[Screens List]].

---

## Product Source of Truth

- [[Product Overview]] — what Watchdog is and why it matters
- [[MVP Definition]] — exactly what's in and out of the MVP
- [[Feature Priority Order]] — the 13-level priority list
- [[Product Principles]] — the rules behind every decision
- [[User Stories]] — who does what and why
- [[Non-MVP Ideas]] — parked ideas, explicitly not now

## Roadmap

- [[Phase 0 Setup]] · [[Phase 1 App Shell]] · [[Phase 2 Camera Simulation]]
- [[Phase 3 Detection Review]] · [[Phase 4 Alert Posting]] · [[Phase 5 Map Alerts]]
- [[Phase 6 Polish]] · [[Phase 7 Backend Integration]] · [[Phase 8 Real AI and Camera Research]]

## Technical Source of Truth

- [[Technical Architecture]] · [[Folder Structure]] · [[Environment Variables]]
- [[Quality Gates]] · [[Production Workflow]] · [[Git Workflow]] · [[Release Workflow]]
- [[Testing Strategy]] · [[File Creation Policy]] · [[Anti-AI-Slop Code Rules]]

## Design Source of Truth

- [[UI Design System]] · [[Screens List]] · [[App Flow]]
- [[UX Principles]] · [[Anti-AI-Slop Design Rules]]

## Claude Workflow

- Prompts: [[Claude Session Prompt]] · [[Start Task Prompt]] · [[Finish Task Prompt]] · [[Feature Build Prompt]] · [[Code Review Prompt]]
- Skills: `/start-task` · `/finish-task` · `/log-session` · `/slop-check`
- Subagents: `product-manager` · `react-native-architect` · `ui-reviewer` · `qa-tester` · `release-manager`

## GitHub Workflow

Guides in `docs/github/`:
[GitHub Setup](../../github/GitHub%20Setup.md) ·
[Branching Strategy](../../github/Branching%20Strategy.md) ·
[Pull Request Checklist](../../github/Pull%20Request%20Checklist.md) ·
[Release Process](../../github/Release%20Process.md).

- Git is initialized locally on `main` (no commits/remote yet). **One task per branch** —
  never do feature work on `main`.
- **Before** meaningful code changes: create/confirm a task branch.
- **After** meaningful code changes: run quality checks + update the Obsidian logs before a
  PR/commit. PRs use the [PR template](../../../.github/pull_request_template.md).
- Claude never commits, pushes, force-pushes, or creates the remote without explicit approval.

## Logs

- Build logs → `06 Build Logs/` (see [[Build Log Template]])
- Decisions → [[Decision Log]]
- Bugs → `07 Bugs/` (see [[Bug Report Template]])
- Feature specs → `12 Feature Specs/` (see [[Feature Spec Template]])
- Claude reviews → `11 Claude Reviews/` (see [[Claude Review Template]])

## App Walkthrough

- **[[app_walkthrough]]** — the living, guided explanation of how the codebase actually
  works. Read this to understand the app without digging through files. It **must** be
  updated after every moderate or meaningful feature/code change.

---

## Rules That Must Not Be Broken

1. **One task at a time.** No "build everything" sprints. Scope, implement, review, log.
2. **No app source files without approval.** State path + purpose + contents first, then wait.
   See [[File Creation Policy]].
3. **Update logs after meaningful changes.** Build log + [[app_walkthrough]] at minimum;
   [[Decision Log]] and bugs when relevant. See [[Production Workflow]].
4. **No AI slop.** Intentional, typed, readable code and designed (not templated) UI. See
   [[Anti-AI-Slop Code Rules]] and [[Anti-AI-Slop Design Rules]].
5. **Simulation is labeled honestly.** `mock` / `demo` / `simulated` in code and docs — never
   dress up a fake integration as real.
6. **Work on a task branch.** Create/confirm a task branch before meaningful code changes;
   never commit feature work to `main`. Never force-push or create the remote without approval.
   See [Branching Strategy](../../github/Branching%20Strategy.md).
