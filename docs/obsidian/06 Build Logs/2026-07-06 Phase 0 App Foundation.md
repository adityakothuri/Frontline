---
tags: [build-log]
date: 2026-07-06
phase: "Phase 0 — Foundation"
task: Expo + React Native + TypeScript app foundation
status: done
---

# 2026-07-06 — Phase 0 App Foundation

## Task
Set up the clean React Native + Expo + TypeScript **app foundation** for Watchdog (foundation
only — no features), and verify the MCP server, agents, hooks, rules, and Obsidian docs are all
correctly wired so production can begin.

## Scope
- **In scope:** scaffold a minimal Expo (SDK 57) blank-TypeScript app; wire `typecheck`/`lint`/
  `format`/`verify` scripts; merge `.gitignore`; confirm CI + quality-hook + Context7 MCP +
  subagents are consistent; update Obsidian logs.
- **Explicitly out of scope:** auth, backend, camera/AI/map/alert features, navigation library,
  state library, real UI design, tests, EAS/release setup, git commit/push (not requested).

## Changes
| File | Change | New? (approved?) |
|------|--------|------------------|
| `App.tsx` | Blank-template root component (untouched placeholder) | new — approved |
| `index.ts` | Entry point (`registerRootComponent`) | new — approved |
| `app.json` | Expo config; name `Watchdog`, slug `watchdog` | new — approved |
| `tsconfig.json` | TS `strict: true`, extends `expo/tsconfig.base` | new — approved |
| `package.json` | Deps + scripts; name `watchdog`, version `0.0.1` | new — approved |
| `package-lock.json` | npm lockfile (CI `npm ci`) | new — approved (generated) |
| `eslint.config.js` | ESLint 9 flat config (expo + prettier), scoped to app src | new — approved |
| `.prettierignore` | Scopes Prettier to app code | new — approved |
| `assets/` (6 PNGs) | Expo icon/splash/favicon | new — approved |
| `.gitignore` | Merged template ignores + kept repo-specific lines | edited |

Deliberately **not** copied from the template: `AGENTS.md`, its `CLAUDE.md`, `.claude/`,
`LICENSE` (repo already has its own / would clobber project config). **No `src/` folders**
created (deferred to Phase 1 — anti-slop forbids empty placeholders).

## Quality checks
- **typecheck** (`tsc --noEmit`): ✅ pass (exit 0)
- **lint** (`eslint .`): ✅ pass (exit 0) — scoped to app source; tooling/docs dirs ignored
- **verify** (`npm run typecheck && npm run lint`): ✅ pass (exit 0) — the exact command CI runs
- **prettier** (`prettier --check .`): ✅ clean (exit 0)
- **expo-doctor**: ✅ 20/20 checks passed, no issues
- **test**: n-a (standard npm placeholder; detected & skipped by CI + the quality hook)
- **manual run / boot proof**: ✅ `expo export --platform ios` bundled `index.ts` (580 modules)
  → 1.4 MB Hermes bundle, no errors. (Full simulator boot not possible headless; export proves
  Metro compiles the app end-to-end.)

## Reviews
- **ui-reviewer:** n-a — no designed UI changed. `App.tsx` is the untouched default placeholder;
  the real design pass is Phase 1.
- **qa-tester:** ✅ **PASS** — independently re-ran every gate (`verify`/`prettier`/`tsc`/
  `expo-doctor` all exit 0), confirmed CI viability (`npm ci --dry-run` exit 0), foundation-only
  scope (no `src/`/feature libs), and secret hygiene (`.mcp.json`/`node_modules`/`.env` ignored;
  lockfile + `.env.example` tracked). Flagged one cleanliness gap (stale lockfile identity) — now
  fixed (see Post-QA fixes).
- **/slop-check:** ✅ pass — no AI-slop, no unauthorized files, scoped, TypeScript-safe, honest
  labeling. One noted discretionary add: Prettier (kept, tightly scoped).

## Post-QA fixes (applied after qa-tester)
- `app.json` version `1.0.0` → `0.0.1` (align with `package.json`; both now pre-MVP `0.0.1`).
- Regenerated `package-lock.json` via `npm install` so its root `name`/`version` are
  `watchdog`/`0.0.1` (were the stale scaffold `watchdog-app`/`1.0.0`). Deps unchanged; `verify`
  still ✅. `npm ci` remains viable.

## Infra verified (MCP / agents / hooks / rules)
- **Context7 MCP** (`.mcp.json`, HTTP) present and git-ignored (holds an API key). Used (via
  `react-native-architect`) to verify Expo SDK 57 APIs.
- **Subagents** present and used: `react-native-architect` (architecture pass), `qa-tester`
  (QA). `product-manager`/`ui-reviewer`/`release-manager` present, not needed this task.
- **Quality hook** (`.claude/hooks/quality-check.sh`) now active (package.json exists) and runs
  typecheck/lint on edit; placeholder-test detection confirmed working.
- **CI** (`.github/workflows/ci.yml`) compatible: detects `package.json`, runs `npm run verify`
  on Node 20; lockfile makes `npm ci` viable.

## Logs updated
- [x] app_walkthrough → [[app_walkthrough]] ("App Foundation (Expo + TypeScript shell)")
- [x] decision log → [[Decision Log]] ("2026-07-06 — Phase 0 app foundation…")
- [ ] bug log — none
- [x] Command Center current/next task → [[Watchdog Command Center]]

## Risks / follow-ups
- **Not committed yet** — all changes are untracked on `feature/phase-0-app-foundation`
  (awaiting explicit go-ahead to commit/push; no remote exists).
- **10 moderate npm audit vulns** (transitive RN/Expo build deps) — did not `audit fix --force`
  (would risk the pinned Expo versions). Revisit when convenient.
- **New Architecture default-on** (SDK 57) — re-verify native-module compat when maps/camera land.
- `watchman` absent locally (non-fatal); local Node 24 vs CI Node 20 both satisfy RN 0.86 engines.
- **Optional (deferred):** no `engines` field / `.nvmrc` — RN 0.86 wants a fairly recent Node;
  consider pinning in Phase 1 for reproducibility. Left minimal for now (works on 20 + 24).

## Next step
Phase 1 — app shell: decide navigation (expo-router vs React Navigation), add the `src/` feature
tree + design tokens (with approval), replace the placeholder `App.tsx`. See [[Phase 1 App Shell]].
