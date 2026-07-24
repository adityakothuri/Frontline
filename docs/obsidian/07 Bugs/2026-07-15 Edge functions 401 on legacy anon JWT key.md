---
tags: [bug]
date: 2026-07-15
severity: high
status: fixed
area: backend / supabase edge functions / config
---

# Bug: Edge functions 401 the app when `.env` uses the legacy anon JWT

## Summary
Every AI and backup-sync call from the app was rejected with 401, silently degrading AI to templated
and disabling sync — while resource reads worked, so it looked healthy.

## Steps to reproduce
1. Set `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the project's **legacy anon JWT** (`eyJ…`).
2. App reads resources fine (PostgREST accepts the JWT).
3. Open a resource / save one → AI shows templated content, sync no-ops.
4. `curl` the `ai`/`sync` functions with that JWT → `{"error":"Unauthorized"}` HTTP 401.

## Expected
The app's AI and sync calls authenticate and reach Claude / the backup tables.

## Actual
Functions returned 401. The client's per-call fallback masked it (templated AI, silent sync skip),
so nothing errored visibly.

## Root cause
The `ai` and `sync` functions run `--no-verify-jwt` and self-gate: they require the incoming
`apikey` header to equal the injected `SUPABASE_ANON_KEY`, which on this project is the **modern
publishable key** (`sb_publishable_…`), not the legacy anon JWT. PostgREST accepts *either* key for
reads, so the mismatch was invisible on the read path but fatal on the function path.

## Fix
Repointed `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` to the publishable key. Verified: reads still
200, and both functions now pass the gate (AI reached Claude; sync round-trip works). The client
already handles non-JWT keys (`src/services/supabase/client.ts` sends `apikey` only, no Bearer, for
`sb_publishable_` keys). Fix logged in [[2026-07-15 Backend Go-Live Cost Controls and Production Plan]].

## Prevention
Documented the **publishable-key rule** in [[Environment Variables]] and
[[Backend to Production Master Plan]] §4. Rule of thumb: if reads work but functions 401, it's a
key-type mismatch — the function gate is stricter than PostgREST.

## Related
- Build log: [[2026-07-15 Backend Go-Live Cost Controls and Production Plan]]
- Decision: [[Decision Log]] (2026-07-15 — AI cost controls + publishable key)
- Env rule: [[Environment Variables]]
