---
tags: [build-log]
date: 2026-07-12
phase: "Phase 10 — Backend & Real Data (slice 1: read-only resources + AI proxy)"
task: Supabase backend + Claude edge-function proxy behind the existing service seams
status: partial
---

# 2026-07-12 — Phase 10: Supabase Backend and Claude Proxy (slice 1)

## Task

Implement the approved Phase 10 plan (`~/.claude/plans/create-comprehensive-plan-on-abundant-thimble.md`):
real resource data (Supabase Postgres) and real Claude AI (Supabase Edge Function proxy) behind the
**unchanged** `ResourceService` / `AiService` interfaces. Profile/saved stay on-device; no accounts.
Status **partial** only because deploy needs the user's Supabase project + Anthropic key (runbook below).

## Scope

- In scope: `supabase/` scaffolding (migrations, curated seed data, edge function), seed script,
  client `SupabaseResourceService` + `ClaudeAiService`, env-based factory switch, config plumbing.
- Out of scope: accounts/sync, ingestion pipelines, verification workflow automation (Phase 10.1+).

## Changes

**New backend (repo root):**
| File | Purpose |
|------|---------|
| `supabase/config.toml` | CLI project config (+ `[functions.ai]`, `verify_jwt = true`) |
| `supabase/migrations/0001_resources.sql` | `resources` table mirroring `Resource` type 1:1; RLS select-only for anon + explicit revokes; category btree |
| `supabase/migrations/0002_zip_centroids.sql` | Census ZCTA centroids (ZIP → origin server-side, no geocoding API) |
| `supabase/migrations/0003_search_resources.sql` | `haversine_miles` + the one `search_resources` RPC (nullable args serve search *and* browse; mock semantics mirrored; unknown origin → null distances, never a fake center) + curator view `resources_needing_review` |
| `supabase/migrations/0004_rate_limits.sql` | Hourly per-IP-hash limiter table + `increment_rate_limit` (service_role only) |
| `supabase/functions/ai/index.ts` | The Claude proxy: validate → sanitize `firstName` → rate-limit (fail-open) → Anthropic SDK (`npm:@anthropic-ai/sdk`), `claude-opus-4-8` via `ANTHROPIC_MODEL`, adaptive thinking, `max_tokens` 2048, **structured outputs** (`output_config.format` json_schema) → assemble exact client shapes |
| `supabase/functions/ai/prompts.ts` | Per-task system prompts (hedged, not-advice, data-block hardening) + content-only JSON schemas |
| `supabase/seed-data/resources.la.json` | The 12 curated LA rows, extracted verbatim from `seedResources.ts` (per-row honest `last_checked`/`verification_status` preserved) |
| `supabase/seed-data/zcta_centroids.csv` | 33,790 ZIP centroids (US Census 2024 Gazetteer) |
| `scripts/seed.ts` | Verbatim batched upserts via service-role key (`.env.seed`); never stamps `now()` |

**New app source:** `src/services/supabase/config.ts` (the offline↔real switch; literal `EXPO_PUBLIC_*` reads),
`src/services/supabase/client.ts` (fetch helper: both auth headers, 8s AbortController timeout, PostgREST error
mapping), `src/services/resources/sortResults.ts` (explainable ordering extracted from the mock — shared spec),
`src/services/resources/supabaseResourceService.ts`, `src/services/ai/claudeAiService.ts` (per-call templated
fallback + disclaimer re-stamp).

**Edited:** `ResourceService.ts` + mock (`listResources(category?, zip?)` browse origin), `discover.tsx` /
`map.tsx` (pass profile ZIP), both service `index.ts` factories (env-gated), `mockResourceService.ts` (uses
shared sort), `.gitignore` (`.env.seed`, `supabase/functions/.env`), `tsconfig.json` + `eslint.config.js`
(exclude Deno code), `.env.example` (rewritten as the env documentation of record).

**Toolchain:** Supabase CLI 2.109.1 installed to `~/.local/bin` (Homebrew blocked by outdated Xcode CLT).

## Quality checks

- typecheck: pass · lint: pass (`npm run verify`, includes `scripts/seed.ts`)
- iOS Hermes bundle export: clean with all new code
- manual run: app relaunched on sim with no `.env` → **offline mock mode intact** (factories picked mock/templated)
- NOT verified (needs Docker or the deployed project): migrations/RPC against live Postgres; edge function curl tests. These are the first item of the deploy runbook.

## Deploy runbook (user actions + then Claude can finish)

1. Create Supabase project; put URL + anon key in `.env` (see `.env.example`); create Anthropic API key.
2. `supabase login` → `supabase link --project-ref <ref>` → `supabase db push`
3. `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node --experimental-strip-types scripts/seed.ts`
4. `supabase secrets set ANTHROPIC_API_KEY=sk-ant-... ANTHROPIC_MODEL=claude-opus-4-8` → `supabase functions deploy ai`
5. Restart the dev server (env is inlined at bundle time) → E2E on sim/device: ZIP search, Discover, detail, all three AI surfaces, airplane-mode error states, then delete `.env` → mock mode.

## Reviews

- qa-tester: run on the slice (see Command Center for verdict).
- ui-reviewer: n/a (no visual changes).

## Risks / follow-ups

- SQL/RPC and edge function are statically reviewed but not yet executed — first `db push` + curl checks must run the Phase A/C verification lists from the plan.
- `EXPO_PUBLIC_*` inlining: env edits need a dev-server restart; EAS builds need the vars set in EAS.
- Rate limiter is coarse per-IP; real cost bound is `max_tokens` × model price — watch the Anthropic console after first E2E.
- Curated rows are carried from the demo seed with `needs_review` status — a human pass (call/check each org) should flip them to `verified` row by row in `resources.la.json`, then re-seed.
- Open-now timezone column deferred to 10.1.

## Next step

- User completes runbook steps 1–4; then live E2E + Phase A/C curl verification, and flip roadmap status.

---

## Slice 2 — saved/profile backup sync (2026-07-13)

Server-side backup of the on-device saved list + profile so they survive a reinstall, with **no
login** (privacy by default). Chosen after an architecture pass: a device UUID over Supabase
anonymous auth, because reinstall survival is keychain-only on iOS *either way*, so GoTrue's
token lifecycle buys nothing here.

**Identity:** a random UUID in the platform keychain via **`expo-secure-store`**
(`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, no biometric prompt). It survives app deletion on iOS →
reinstall-restore; **Android keystore is wiped on uninstall → server backup only, no
reinstall-restore** (a recovery code is a later slice). The UUID is a bearer capability secret, so
the backup tables are **deny-all** and reached only through a service-role edge function.

**New files:** `supabase/migrations/0005_sync_backup.sql` (`saved_backups` + `profile_backups`,
jsonb blobs, RLS-on-no-policies, service_role grants), `supabase/functions/sync/index.ts`
(pull/pushSaved/pushProfile/clearProfile; anon-key gate; UUID validation; **updated_at
monotonicity** so an empty reinstall can't clobber good data; reuses the rate limiter),
`src/services/sync/{deviceId,backupClient,backupSync}.ts`.
**Edited (public API unchanged):** `SavedContext`/`ProfileContext` (restore-before-hydrate + guarded
mirror), `profileStorage.ts` (extracted `parseProfile`, reused to guard restored blobs),
`app.json` (secure-store plugin), `package.json` (`expo-secure-store ~15.0.8`), `config.toml`.

**Sync rules:** local stays source of truth; saved merges by union (earliest `savedAt` wins);
profile is local-wins-else-restore (same-device only); pushes are debounced + fire-and-forget +
no-op offline; reset clears the backup so it can't be resurrected. Pushes are gated on `isHydrated`
(set only after restore) — the empty-local clobber race is closed on the client, with server
monotonicity as defense-in-depth.

**Checks:** `npm run verify` green; iOS bundle exports clean; offline parity preserved
(`supabaseConfig` null → `getDeviceId` null → every sync call is a no-op). qa-tester **PASS** on all
8 items; its one narrow finding fixed in-task — `resetProfile` now writes a **NULL tombstone**
through the monotonic path instead of a hard `DELETE`, so a profile-edit push in flight at reset
time can't resurrect the row (`profile` column made nullable for this).

**Deploy additions for slice 2:** `supabase functions deploy sync`, and confirm `SUPABASE_ANON_KEY`
is set on the deployed function (Supabase injects it automatically; the anon-key gate is fail-open
if it's somehow unset — same pattern as the `ai` function). **A native rebuild is required** (the
`expo-secure-store` config plugin) before the next dev build — `npx expo prebuild` → rebuild.
