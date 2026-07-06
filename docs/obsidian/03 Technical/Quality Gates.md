---
tags: [technical, quality, source-of-truth]
status: stable
updated: 2026-07-05
---

# Quality Gates

A task is not done until it passes these gates. Enforced by [[Production Workflow]], the
`/finish-task` skill, and the `qa-tester` + `ui-reviewer` agents.

## Gates

| Gate | How | When |
|------|-----|------|
| **Typecheck** | `typecheck` script (`tsc --noEmit`) | Every code task, if script exists |
| **Lint** | `lint` script (eslint) | Every code task, if script exists |
| **Tests** | `test` script | If meaningful tests exist (placeholder skipped) |
| **Post-edit hook** | `.claude/hooks/quality-check.sh` runs the above automatically | After every edit |
| **UI review** | `ui-reviewer` agent + [[Anti-AI-Slop Design Rules]] | Any visual change |
| **QA review** | `qa-tester` agent | Before marking complete |
| **Manual run** | Launch the app / exercise the flow | Before calling a flow "working" |
| **Logging** | Build log + [[app_walkthrough]] updated | After meaningful change |

## The post-edit hook

`.claude/hooks/quality-check.sh` (configured in `.claude/settings.json`) runs `typecheck` →
`lint` → `test` **only if those scripts exist**, never modifies files, and fails loudly on a
real failure. It is a **checks-only** hook — it does **not** write docs. Until `package.json`
exists it exits cleanly (no-op). See `.claude/hooks/README.md`.

## Honesty

Never report a gate as passing that you didn't run. If a check is skipped (e.g., no script
yet), say so. A green typecheck is not a substitute for actually running the flow.

## Related

[[Production Workflow]] · [[Testing Strategy]] · [[MVP Definition]] · [[Anti-AI-Slop Code Rules]]
