---
tags: [build-log, backend, supabase, ai, cost, production]
date: 2026-07-15
---

# 2026-07-15 — Backend Go-Live, Cost Controls & Production Plan

Session that took the Phase 10 backend from "coded" to "live and verified," added AI cost controls,
and produced the master production roadmap.

## What changed

### AI cost split (per-task models)
- `supabase/functions/ai/index.ts`: `TASK_MODELS` routes **summaries → `claude-haiku-4-5`**,
  **plans/scripts → `claude-opus-4-8`** (env-overridable). Haiku rejects `thinking:adaptive` +
  `output_config.effort`, so those fields are gated off for Haiku (`supportsEffortControls`);
  structured outputs stay on for all tasks. Deployed (ai v2).

### Bug fixed — `.env` anon key mismatch (real, latent)
- The edge functions self-gate on the injected `SUPABASE_ANON_KEY` = the **publishable** key, but
  `.env` held the **legacy anon JWT**. PostgREST reads accepted the JWT (looked fine), but every AI
  and sync call was **401'd → silent templated fallback / no sync**. Repointed `.env` to the
  `sb_publishable_…` key. Reads still 200, functions now pass the gate. See [[Bugs]].

### Data — ZIP centroids seeded (33,791 rows)
- `zip_centroids` was empty (ZIP search returned unranked results). `.env.seed` `service_role` key
  is a placeholder, so the seed script couldn't run. Loaded the full Census CSV **server-side** via a
  transient unlisted gist + the `http` extension, then dropped the extension. Verified: ZIP 90012 →
  distance-ranked LA resources; 75034 → only the national crisis line (LA rows correctly excluded).

### AI hourly spend budget (migration 0006 + function)
- `supabase/migrations/0006_ai_budget_and_hardening.sql`: `ai_spend` ledger + `current_ai_spend()` /
  `add_ai_spend()` RPCs (service-role only); `add_ai_spend()` self-purges `ai_spend` + `rate_limits`
  windows > 3h. Explicit `using(false)` deny-all policies on the 4 service-role tables (silences the
  rls_no_policy advisories; intent explicit in-schema).
- `ai/index.ts`: global **hourly USD cap** (`AI_HOURLY_BUDGET_USD`, default 5). Pre-call gate → 429
  (client falls back to templated); post-call records **actual** cost from `response.usage` ×
  `MODEL_PRICES`. Fail-open on DB error (Anthropic console cap is the hard backstop). Deployed (ai v4).
- Verified: real call recorded $0.0015; forcing the hour > $5 returned 429; ledger restored.

### Docs
- **New:** [[Backend to Production Master Plan]] — immensely detailed WS-1…WS-8 roadmap (cost, ops/DR,
  security, observability, testing, **Google auth**, **VA data ingestion**, release), env reference,
  runbooks, acceptance criteria, VA data-source catalog, cost model.
- Updated [[Environment Variables]] (publishable-key rule, cost knobs).

## Verified live (Supabase project)
- Migrations 0001–0006 applied. Functions `ai` (v4) + `sync` ACTIVE, `verify_jwt:false`.
- `resources` 12, `zip_centroids` 33,791, backup/limit tables clean.
- Real Claude: Haiku summary + Opus plan both 200 with real content.
- Sync pull + pushSaved→pull round-trip 200.
- App runs on iOS dev build against live backend.

## Owner action items (carried into the master plan)
- [x] Anthropic key rotated. [ ] Confirm old key fully revoked.
- [ ] Set a **monthly spend cap in the Anthropic console** (hard backstop).
- [ ] Put a real `service_role` key in `.env.seed` so `scripts/seed.ts` runs (DR/reproducibility).
- [ ] Decide production `AI_HOURLY_BUDGET_USD`.

## Next
Pre-launch backend polish (WS-2/3/4/5), then **Phase 11 Google auth** (WS-6) and **Phase 12 VA data
ingestion** (WS-7). See [[Backend to Production Master Plan]] §6 for order.

## Risks / notes
- 12 LA resources = demo; real coverage is WS-7 (biggest "ship it" gap).
- Spend budget is fail-open by design; the console cap is the true ceiling.
- ZIP data loaded via a one-off method; the canonical seed path (script) still needs the service key.
