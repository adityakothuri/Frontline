---
tags: [build-log]
date: 2026-07-24
phase: "Infrastructure — repo-setup audit"
task: Complete repo-setup audit, safe fixes, commit/push, small inference smoke test
status: done
---

# 2026-07-24 — Repo-setup audit + small inference smoke test

## Task
Audit the repo **setup / dev infrastructure** (not app features) to confirm it works well and is fit
for building Frontline + AI inference; then commit & push the pending work and run a small inference
test.

## Audit result (3 parallel Explore sweeps: dev framework · build/CI/env · AI inference)

**Healthy:**
- CI (`.github/workflows/ci.yml`) runs `npm run verify` (typecheck+lint) on every PR; `refresh-data.yml`
  cron is correct.
- `PostToolUse` quality-check hook is correctly wired + executable (typecheck→lint→skip-stub-test).
- `.gitignore` thorough and verified — no secrets, `node_modules`, native output, `.env*`,
  `.mcp.json`, or `.env.seed` tracked. `.mcp.json` **never committed** (checked history).
- Expo SDK 54 deps internally aligned; bundle id `com.frontline.app`.
- **AI inference deployed + guardrailed + already serving** — `ai` function v8 ACTIVE; per-IP rate
  limit + hourly budget cap; valid current model IDs (`claude-opus-4-8`, `claude-haiku-4-5`).

**Fixed this pass (branch `chore/repo-setup-audit`):**
- **Broken skill store** — 16 committed `.claude/skills/` symlinks pointed at a missing `.agents/skills/`
  store (installer-populated, like `node_modules`; 3 subagents referenced skills that didn't load).
  Restored via `npx skills add callstackincubator/agent-skills` + `kepano/obsidian-skills` +
  `Leonxlnx/taste-skill` → 0 dangling; `react-native-best-practices` + `github-actions` resolve.
  Removed the 13 installer-added symlinks for skills `SKILLS.md` had pruned for RN (web-DOM design
  skills). Added **`.agents/` to `.gitignore`** so the store is treated as installer-populated.
- **Stale `.env.example`** — removed the "mock resources + templated AI" offline-mode wording; the app
  has no mock/templated fallback and requires the two `EXPO_PUBLIC_SUPABASE_*` values.

**Deferred (recommendations, not built — none block dev or inference):**
- No `eas.json` / EAS project id → cloud/store builds can't run (release blocker, not dev blocker).
- Missing Android Google Maps API key → Android map blank in a release build (add via `app.json`).
- No test framework (`test` is a stub); CI runs typecheck+lint only.
- Live secrets in git-ignored local `.env.seed` (service-role key) — rotate + move to a secret manager.
- Context7 key in local git-ignored `.mcp.json` (never committed — local-only, low risk).
- No Node pinning (`.nvmrc`/`engines`); CI 20, refresh workflow 22, local 24.

## Small inference smoke test (live)
`POST /functions/v1/ai` with `{ task:"summary", resource:<real benefits_help row> }` and the
publishable anon key on the `apikey` header (mirrors `claudeAiService.summarizeBenefit`).
- **Result: HTTP 200 in 3.46s**, valid `BenefitSummary` JSON — all fields populated, plain-English,
  properly hedged ("may qualify… call or visit to confirm"), correct `sourceUrl`. Runs on Haiku.
- Proves the full chain: client body → edge function → anon-key gate → Anthropic → structured JSON.

## Commit & push
- `feature/frontend-audit-see-in-map` — the reviewed/verified frontend work (See-in-map + overlap +
  tokens), committed and pushed.
- `chore/repo-setup-audit` — the two infra fixes above, committed and pushed.
- No merge to `main`, no force-push. Both branches independent (different files).

## Quality checks
- typecheck/lint: green on the frontend branch (unchanged by infra edits).
- Skills: 0 dangling symlinks; agent-referenced skills resolve.
- Inference: live 200 (above).

## Logs updated
- [x] this build log · [x] Decision Log · [x] Command Center

## Risks / follow-ups
- The documented `npx skills add …` restore over-installs (pulls every skill in a source, incl.
  RN-pruned ones); I trimmed the extra symlinks by hand. A future cleanup could pin only the wanted
  skills.
- Release readiness still needs EAS + Android Maps key before any store build (tracked above).

## Next step
Ready to scale inference beyond the smoke test (plan/script on Opus). Optionally open PRs for the two
branches and tackle the deferred release items when store-bound.
