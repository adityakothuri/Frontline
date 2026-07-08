---
tags: [command-center, start-here]
status: active
phase: "Reframe → Frontline (Phase 1 shell reused)"
updated: 2026-07-07
---

# Frontline Command Center

> **Find your next step.**
> This is the single entry point for the Frontline project. Start here every session.

---

## Current Status

🟡 **Reframed from Watchdog → Frontline.** The neighborhood-safety product was scrapped and
replaced with **Frontline** — an app that helps **veterans find benefits, local resources, and
practical next steps**. This pass reframed all product/technical documentation, `CLAUDE.md`, and the
app **config** (`com.frontline.app`); the reusable **design system + app shell** (theme tokens,
generic components, navigation) carry over from the previous build. The previous Watchdog **feature
screens** (home/map/alerts/report) still physically exist and will be **replaced** feature-by-feature
starting at Phase 2 — until then the running app shows legacy screens. The development framework
(agents, hooks, rules, skills, MCP, Obsidian, workflow) is **preserved**.

## Current Phase

**Reframe complete → foundation reused.** Done: [[Phase 0 Setup]] · [[Phase 1 App Shell]].
Next feature work begins at **[[Phase 2 Resource Data Model and Service]]**.

## Current Active Task

**✅ Done — Watchdog → Frontline reframe.** Rewrote the Obsidian brain and `CLAUDE.md` for the
veteran-resources product, renamed app config to `com.frontline.app`, and regenerated the native
project. Decision: [[Decision Log]] — "Reframe Watchdog → Frontline". The AI approach is
**interface-first** (typed `AiService`, templated responses first, real Claude API behind the seam
later via a proxy — keys never ship in the client). See [[AI Feature Design]].

## Next Recommended Task

**Phase 2 — Resource Data Model & Mock Service.** Add the canonical `Resource` type, a typed
`resources` service + realistic seeded mock data across categories, and the `AiService` interface
with a templated implementation. No new screens yet — this establishes the swappable data/AI seams
every later screen builds against. ⚠️ Requires approval for each new app file/dependency
([[File Creation Policy]]). See [[Phase 2 Resource Data Model and Service]], [[Resource Data Model]],
and [[AI Feature Design]].

---

## Product Source of Truth

- [[Product Overview]] — what Frontline is and why it matters
- [[MVP Definition|MVP Scope]] — exactly what's in and out of the MVP
- [[Feature Priority Order]] — the priority list
- [[Product Principles]] — the rules behind every decision
- [[User Personas]] — who Frontline is for
- [[User Stories]] — who does what and why
- [[Trust Safety and Privacy]] — verification, disclaimers, and data minimization
- [[MVP Acceptance Criteria]] — the testable definition of a done MVP
- [[Non-MVP Ideas]] — parked ideas, explicitly not now

## Roadmap

- [[Phase 0 Setup]] · [[Phase 1 App Shell]] · [[Phase 2 Resource Data Model and Service]]
- [[Phase 3 Guided Need Flow]] · [[Phase 4 Resource List and Detail]] · [[Phase 5 Map and Discovery]]
- [[Phase 6 AI Plans and Call Scripts]] · [[Phase 7 AI Summarization]] · [[Phase 8 Saved and Profile]]
- [[Phase 9 Trust and Verification]] · [[Phase 10 Backend and Data Ingestion]]

## Technical Source of Truth

- [[Technical Architecture]] · [[AI Feature Design]] · [[Resource Data Model]]
- [[Folder Structure]] · [[Environment Variables]]
- [[Quality Gates]] · [[Production Workflow]] · [[Git Workflow]] · [[Release Workflow]]
- [[Testing Strategy]] · [[File Creation Policy]] · [[Anti-AI-Slop Code Rules]] · [[Claude Development Rules]]

## Design Source of Truth

- [[UI Design System]] · [[Screens List]] · [[App Flow|Core User Flows]]
- [[Map and Search Design]] · [[UX Principles]] · [[Anti-AI-Slop Design Rules]]

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

- **One task per branch** — never do feature work on `main`.
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
  works. It **must** be updated after every moderate or meaningful feature/code change.

---

## Rules That Must Not Be Broken

1. **One task at a time.** No "build everything" sprints. Scope, implement, review, log.
2. **No app source files without approval.** State path + purpose + contents first, then wait.
   See [[File Creation Policy]].
3. **AI is embedded in workflows, never a chatbot**, and is **never** presented as legal, medical,
   financial, or government-certified advice. See [[AI Feature Design]].
4. **Trust & privacy first.** Every resource shows its source + last-checked; collect the minimum,
   never SSN/VA-login/bank/diagnosis. See [[Trust Safety and Privacy]].
5. **Update logs after meaningful changes.** Build log + [[app_walkthrough]] at minimum;
   [[Decision Log]] and bugs when relevant. See [[Production Workflow]].
6. **No AI slop.** Intentional, typed, readable code and designed (not templated) UI. See
   [[Anti-AI-Slop Code Rules]] and [[Anti-AI-Slop Design Rules]].
7. **Simulation is labeled honestly.** `mock` / `demo` / `simulated` in code and docs.
8. **Work on a task branch.** Never commit feature work to `main`; never force-push or create the
   remote without approval. See [Branching Strategy](../../github/Branching%20Strategy.md).
