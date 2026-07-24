---
tags: [roadmap, backend, production, phase-11, phase-12, auth, ingestion, cost]
status: active
updated: 2026-07-15
---

# Backend → Production — Master Plan

> **Purpose.** The single, immensely-detailed reference for taking the Frontline backend from
> "works end-to-end" to "production-grade, shippable to real veterans." The **frontend UI is
> done**; everything here is backend/infra/data. Read [[Technical Architecture]],
> [[Phase 10 Backend and Data Ingestion]], and [[Environment Variables]] alongside this.
>
> **How to use.** Each workstream (WS-*) is self-contained: goal → why → current state →
> numbered steps (with file paths / SQL / commands / env) → acceptance criteria → risks. Section 6
> is the sequenced order. Section 7 has copy-paste runbooks. When you pick up a workstream, work its
> steps top to bottom and check the acceptance criteria before calling it done.

---

## 1. TL;DR — where we are, what's left

**Live and working today (verified 2026-07-15):**
- Supabase project provisioned; 6 migrations applied; RLS correct.
- Resource search (GPS **and** ZIP, distance-ranked), browse, and detail — real data from Postgres.
- ZIP→coords via a 33,791-row `zip_centroids` table (no geocoding API).
- Backup sync (saved list + profile) via an anonymous device-UUID, round-trip verified.
- Real Claude AI: **Haiku** for summaries, **Opus** for plans/scripts (cost-split), behind a
  server-side proxy — the API key never ships in the app.
- **Hourly spend budget** on Claude (this session) — soft cap degrades to templated AI; hard cap in
  the Anthropic console.
- App runs on iOS dev build against the live backend.

**The path to production (this doc):**
| WS | Workstream | Phase | Status |
|----|-----------|-------|--------|
| WS-1 | Cost & spend controls | now | ✅ **done** |
| WS-2 | Operational hardening & DR | now | ◻ partly (auto-purge done) |
| WS-3 | Security hardening & privacy | now | ◻ partly (deny-all policies done) |
| WS-4 | Observability & monitoring | now | ◻ todo |
| WS-5 | Testing | now | ◻ todo |
| WS-6 | **Authentication & accounts (Google)** | Phase 11 | ◻ planned (this doc) |
| WS-7 | **Real veteran data ingestion (VA APIs)** | Phase 12 | ◻ planned (this doc) |
| WS-8 | Release pipeline (EAS / store / privacy) | launch | ◻ todo |

**The two big product blockers** between "works" and "send it out": **WS-7** (12 hand-curated LA
resources is a demo, not coverage) and **WS-8** (nothing is actually shippable without a store
release + privacy policy). WS-6 (accounts) is a strong "fast-follow" but a launch **can** ship with
anonymous device sync.

---

## 2. Current backend inventory (what's live)

### 2.1 Supabase project
- Region/project: `muchec…` (see dashboard). API URL + anon/publishable key in `.env`.
- **Keys:** app uses the **publishable** key (`sb_publishable_…`) — the edge functions gate on it.
  The legacy anon JWT also exists/works for reads but must NOT be used by the app (functions 401 it).
  See [[Environment Variables]].

### 2.2 Schema (migrations `supabase/migrations/`)
| # | File | Objects |
|---|------|---------|
| 0001 | `resources.sql` | `resources` table (mirrors `src/types/resource.ts`), category index, read-only RLS |
| 0002 | `zip_centroids.sql` | `zip_centroids` (zip PK, lat/lng), anon read policy |
| 0003 | `search_resources.sql` | `haversine_miles()`, `search_resources()` RPC, `resources_needing_review` view |
| 0004 | `rate_limits.sql` | `rate_limits` table + `increment_rate_limit()` (per-IP hourly) |
| 0005 | `sync_backup.sql` | `saved_backups`, `profile_backups` (deny-all, service-role only) |
| 0006 | `ai_budget_and_hardening.sql` | `ai_spend` + `current_ai_spend()`/`add_ai_spend()`; explicit deny-all policies |

**Data:** `resources` = 12 (curated LA), `zip_centroids` = 33,791 (US + territories). Backup/limit
tables start empty. `ai_spend` self-purges windows > 3h old.

### 2.3 Edge functions (`supabase/functions/`)
- **`ai`** (`--no-verify-jwt`, self-gates on anon key): `POST { task, resource, need?, tone?, firstName? }`.
  Per-task model routing, structured outputs, per-IP rate limit (30/hr), **hourly spend budget**,
  templated fallback on any error. Only place `ANTHROPIC_API_KEY` lives.
- **`sync`** (`--no-verify-jwt`, self-gates): `POST { action: pull|pushSaved|pushProfile|clearProfile, deviceId, … }`.
  Monotonic (updated_at) upsert so a reinstall can't clobber good data.

### 2.4 Client integration (`src/services/`)
- `supabase/config.ts` — the offline↔backend switch (presence of `EXPO_PUBLIC_SUPABASE_*`).
- `supabase/client.ts` — minimal typed fetch (no supabase-js), handles JWT vs publishable keys.
- `resources/supabaseResourceService.ts` — implements `ResourceService` against the RPC.
- `ai/claudeAiService.ts` — implements `AiService` against the `ai` function; per-call templated fallback.
- `sync/{deviceId,backupClient,backupSync}.ts` — wired into `SavedContext` + `ProfileContext`.

### 2.5 Cost controls (WS-1, live)
- Model split: Haiku summaries (~$0.0015/call), Opus plans/scripts (~$0.02/call).
- Lazy calls: call scripts only on button; summary+plan auto-load on detail open.
- Per-IP rate limit: 30 AI calls/hr/IP.
- **Global hourly spend cap** (`AI_HOURLY_BUDGET_USD`, default $5) — see WS-1.
- Anthropic console monthly/spend cap — **hard backstop** (set this in the console).

---

## 3. Architecture & data flow

```
┌────────────┐   EXPO_PUBLIC_SUPABASE_* present?
│  RN app    │──────────────┬───────────────────────────┐
│ (Expo)     │       no → offline mock/templated    yes → live backend
└─────┬──────┘                                           │
      │ anon(publishable) key                            │
      ▼                                                   ▼
┌───────────────── Supabase ─────────────────────────────────────────┐
│  PostgREST                Edge Functions (Deno)                     │
│  ├─ rpc/search_resources  ├─ /functions/v1/ai  ──► Anthropic API    │
│  │   (zip→centroid,       │    (key server-side, budget, rate-limit)│
│  │    haversine, filter)  └─ /functions/v1/sync ──► saved/profile   │
│  └─ resources (read-only)      (service-role, deny-all tables)      │
│                                                                     │
│  Postgres: resources, zip_centroids, rate_limits, ai_spend,         │
│            saved_backups, profile_backups                           │
└─────────────────────────────────────────────────────────────────────┘
```
Data-flow rules: **anon/publishable key only in the app**; **service-role + Anthropic key only in
functions**; user-data tables are deny-all and reached only through the `sync` function.

---

## 4. Environment & secrets reference (complete)

| Name | Where | Secret? | Purpose |
|------|-------|---------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | app `.env` + EAS | no | Project URL (mode switch) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | app `.env` + EAS | no (RLS-safe) | **Publishable** key `sb_publishable_…` |
| `ANTHROPIC_API_KEY` | Supabase function secret | **yes** | Claude key — functions only, never app |
| `ANTHROPIC_MODEL` | function secret (opt) | no | Opus default for plan/script (`claude-opus-4-8`) |
| `ANTHROPIC_MODEL_SUMMARY` | function secret (opt) | no | `claude-haiku-4-5` (cheap summaries) |
| `ANTHROPIC_MODEL_PLAN` / `_SCRIPT` | function secret (opt) | no | Per-task overrides |
| `AI_HOURLY_BUDGET_USD` | function secret (opt) | no | Global hourly Claude spend cap (default 5) |
| `SUPABASE_URL` | `.env.seed` | no | Seed script target |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.seed` | **yes** | Seed script only — **never in app or git** |
| `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (in functions) | auto-injected | — | Supabase injects these into deployed functions |

**Rules:** app gets only public keys; `.env` / `.env.seed` are git-ignored; document every var in
`.env.example`. Future (WS-6/7): `EXPO_PUBLIC_GOOGLE_*` (public client IDs), `VA_API_KEY` (function/ingestion secret).

**⚠️ Open item:** `.env.seed` still holds a **placeholder** `service_role` key → the seed script
(`scripts/seed.ts`) cannot run until a real key is pasted. Data is currently seeded, but this blocks
DR/re-provisioning (WS-2.2).

---

## 5. Production workstreams

### WS-1 — Cost & spend controls ✅ DONE (2026-07-15)

**Goal.** Bound Claude spend so a bug or abuse can't run up a bill.

**Delivered:**
1. **Per-task model routing** (`ai/index.ts` `TASK_MODELS`) — Haiku summaries, Opus plans/scripts.
2. **Per-IP rate limit** — 30 AI calls/hr/IP (`rate_limits` + `increment_rate_limit`).
3. **Global hourly spend budget** (migration 0006 + `ai/index.ts`):
   - `ai_spend(window_start, spend_usd)` ledger; `current_ai_spend()` / `add_ai_spend()` RPCs.
   - Before each Claude call the function checks `current_ai_spend()`; if ≥ `AI_HOURLY_BUDGET_USD`
     it returns **429** and the client shows templated AI.
   - After each call it records **actual** cost from `response.usage` × model price (`MODEL_PRICES`).
   - `add_ai_spend()` also purges `ai_spend` + `rate_limits` windows > 3h (no pg_cron needed).
   - **Fail-open** on DB error (availability); the **Anthropic console cap is the hard backstop**.
4. Verified: real call recorded $0.0015; forcing the hour > $5 returned 429; auto-purge in place.

**To tune:** `supabase secrets set AI_HOURLY_BUDGET_USD=<n>` (no redeploy — read at runtime).

**Still to do (owner action, not code):**
- [ ] Set a **monthly spend limit** in the Anthropic console (hard ceiling). **Do this before launch.**
- [ ] Decide the production `AI_HOURLY_BUDGET_USD` (default $5/hr ≈ up to ~$120/day worst case).

**Risks.** Fail-open means a DB outage could let spend through — mitigated by the console cap.

---

### WS-2 — Operational hardening & disaster recovery

**Goal.** The backend survives restarts, re-provisioning, and growth without manual babysitting.

**Current state.** Auto-purge of `ai_spend`/`rate_limits` done (WS-1). Gaps below.

**Steps:**
1. **Seed reproducibility (blocker).**
   - [ ] Paste the real `service_role` key into `.env.seed` (Dashboard → Settings → API → reveal).
   - [ ] Verify `scripts/seed.ts` runs clean: `set -a; . ./.env.seed; set +a; node --experimental-strip-types scripts/seed.ts` → `resources` + `zip_centroids: 33790/33790`.
   - [ ] Confirm the seed is **idempotent** (it is — `on_conflict merge-duplicates`).
   - Note: ZIP data was loaded once via a transient method; the script is the *canonical* path and
     must work for DR.
2. **Backup table growth.** Bounded by device count (one row each). Optional: a periodic purge of
   backups whose `updated_at` is older than N months (dormant devices). Low priority.
3. **DB backups / PITR.** Confirm Supabase automatic backups are on for the project's plan; enable
   **Point-in-Time Recovery** on a paid tier before launch. Document restore steps (runbook 7.5).
4. **Function resilience.** Both functions already fail-open / fall back. Add a `deno.json` per
   function if pinning deps becomes necessary (currently npm-specifier imports, no import map).
5. **Migrations discipline.** All schema changes go through `supabase/migrations/*.sql` (+
   `apply_migration`), never ad-hoc SQL, so the schema is reproducible from zero.

**Acceptance.** From a fresh DB, `supabase db push` + `scripts/seed.ts` reproduces the exact current
state; PITR configured; runbooks written.

---

### WS-3 — Security hardening & privacy

**Goal.** No leaked secrets, least privilege, honest privacy posture.

**Current state.** RLS on all tables; service-role isolation; explicit deny-all policies (0006);
app uses publishable key only.

**Steps:**
1. **Key rotation hygiene.**
   - [x] Anthropic key rotated (2026-07-15). Ensure the **old pasted key is fully revoked** in the console.
   - [ ] Never paste secrets into chat/logs; rotate anything that was.
   - [ ] Confirm `.env`, `.env.seed`, `.mcp.json` are git-ignored **and not already committed**
     (see [[Environment Variables]] — `.mcp.json` holds a Context7 key).
2. **Advisors clean.** Re-run `get_advisors(security|performance)` after any DDL. Current: only the
   intentional deny-all INFOs (now silenced by 0006) and an unused-index INFO (fine at 12 rows).
3. **PII minimization (privacy by default).** We store only first name + ZIP + saved IDs, keyed to an
   anonymous device UUID. Keep it that way; never add SSN, VA login, DOB, diagnosis, bank. When WS-6
   adds accounts, store only Google `sub` + email; nothing more.
4. **Prompt-injection.** The `ai` function already treats `RESOURCE_DATA` as untrusted data and
   sanitizes `firstName`. Keep resource text out of the "instruction" position when ingestion
   (WS-7) adds un-curated data.
5. **Transport.** All calls are HTTPS via Supabase. No CORS needed (native app); add CORS headers
   only if a web client is ever built.
6. **Abuse.** Per-IP rate limit + global budget cover cost abuse. Consider Supabase's built-in
   network restrictions / captcha only if abuse appears.

**Acceptance.** Advisors show no non-intentional findings; no secret in git history; PII inventory
documented and minimal.

---

### WS-4 — Observability & monitoring

**Goal.** Know when something breaks before users tell you.

**Steps:**
1. **Function logs.** Use Supabase edge-function logs (Dashboard → Functions → Logs, or MCP
   `get_logs edge-function`). The `ai` function already `console.error`s upstream failures.
2. **App error tracking.** Add **Sentry** (`@sentry/react-native`) — wrap the app; capture JS
   errors + a breadcrumb when `AiService`/`ResourceService` fall back. (New dep → approval per
   [[File Creation Policy]].)
3. **Spend dashboard.** Query `ai_spend` for per-hour cost; optionally a small admin view. Watch the
   Anthropic console usage too.
4. **Uptime.** A simple external ping on `rpc/search_resources` (e.g. cron/monitor) to catch backend
   outages.
5. **Alerts.** Anthropic console spend alerts; Supabase project health alerts.

**Acceptance.** Errors surface in a dashboard; spend is observable; you'd get paged on an outage.

---

### WS-5 — Testing

**Goal.** Critical backend-facing logic has regression coverage (repo currently has **no tests**).

**Steps (highest value first):**
1. **Service unit tests** (Jest + `jest-expo`, or vitest): 
   - `search` result mapping + the "unknown origin → null distance, no radius filter" contract.
   - `AiService` **fallback**: a failing proxy must yield templated content, never throw.
   - `backupSync` monotonic write (older `updatedAt` never clobbers newer).
   - `sortResults` ordering.
2. **Edge-function tests** (Deno test): budget gate (over/under), rate-limit boundary, task
   validation (400s), Haiku vs Opus request-shape selection.
3. **Wire `npm test`** (currently a stub) and add to `npm run verify` + CI.

**Acceptance.** `npm run verify` runs typecheck + lint + meaningful tests green.

---

### WS-6 — Authentication & accounts (Google Sign-In) — **Phase 11**

**Goal.** Optional Google account for durable, cross-device sync + recovery — **without** breaking
privacy-by-default (anonymous stays the default).

**Why.** Device-UUID sync can't cross devices, and Android loses it on uninstall. Google sign-in
gives a durable identity without building password infra. **Must stay optional.**

**Key decisions (confirm before building):**
1. **Flow:** native ID-token (`@react-native-google-signin/google-signin` → Supabase
   `signInWithIdToken`) — recommended, needs a dev rebuild — vs Expo web-redirect (no native module,
   worse UX). *Recommend native.*
2. **SDK:** adopt `@supabase/supabase-js` **for auth only** (session persistence + token refresh),
   keeping the lightweight fetch client for reads. *This reverses the "no supabase-js" choice — log
   it in [[Decision Log]].*
3. **Identity model:** anonymous-stays-default + **claim-on-sign-in** (migrate the device's existing
   backups into user-keyed rows) — recommended — vs sign-in replaces device sync.

**Steps:**
1. **Google Cloud:** create OAuth consent screen + client IDs (iOS + Web). Web client ID is what
   Supabase verifies the token against.
2. **Supabase Auth:** enable the Google provider (Web client ID + secret); set `site_url` / redirect
   allowlist. (`supabase/config.toml [auth]` already scaffolded.)
3. **Deps (approval):** `@supabase/supabase-js`, `@react-native-google-signin/google-signin`
   (+ Expo config plugin) → `npx expo prebuild` + dev rebuild.
4. **App:**
   - `src/services/auth/AuthContext.tsx` — session state, `signInWithGoogle()`, `signOut()`.
   - A **Sign-in (optional)** entry in Profile — framed "back up across devices," never forced,
     never implying VA/government identity.
   - Configure `GoogleSignin` with the Web client ID; exchange the ID token via Supabase.
5. **Backend (new migration `0007_accounts.sql`):**
   - Add `user_id uuid` (nullable) to `saved_backups` / `profile_backups`; keep `device_id` for
     anonymous. Unique per (`user_id`) when present.
   - Add `auth.uid()`-scoped RLS **read/write policies** so a signed-in user reaches their own rows
     directly (this is the first time app clients touch these tables with real RLS — the `sync`
     function stays for anonymous devices).
   - A **claim RPC**: on first sign-in, move `device_id` rows → `user_id` (idempotent, monotonic).
6. **Sync layer:** `backupSync` chooses device vs user path based on auth state; on sign-in, run claim.
7. **Verify APIs with Context7** before writing (supabase-js auth, google-signin). Run
   `react-native-architect` for structure and `qa-tester` before done.

**Acceptance.** Anonymous flow unchanged; optional Google sign-in yields cross-device restore; RLS
proven (user A cannot read user B); privacy copy reviewed; [[Decision Log]] updated.

**Risks.** Two identity systems; supabase-js adoption; Apple may require **Sign in with Apple** if
you ship any third-party sign-in (plan for it or gate sign-in behind a later build).

---

### WS-7 — Real veteran resource data ingestion — **Phase 12**

**Goal.** Replace 12 hand-curated LA rows with real, **verified**, broad-coverage resources feeding
`source_type` / `verification_status` / `last_checked` honestly. This is the #1 "ready to send out"
gap. **Never over-trust scraped data; official/directory sources first.**

**Data sources (verify exact params at build time — see Appendix A):**
- **VA Lighthouse — Facilities API** (`developer.va.gov`): VA health, benefits, Vet Centers,
  cemeteries with geo + services. Primary source for official VA locations. Needs a free API key.
- **VA Benefits Reference / Forms APIs**: benefit + form metadata for summaries.
- **National Resource Directory (nrd.gov)**, **211 / United Way**, **findhelp (Aunt Bertha) API**:
  local social services (food, housing, legal). Directory-grade → `source_type: directory`.
- **HUD** (housing/VASH), **USDA/food-bank directories**, **state VA / county VSOs**, **legal aid**.

**Architecture:**
1. **Ingestion runner** (separate from the app): a Node/Deno script or a **Supabase scheduled
   function / cron** that pulls each source, normalizes to the `resources` shape, and upserts.
   - New dir `ingestion/` with one adapter per source (`ingestion/sources/vaFacilities.ts`, …).
   - Each adapter maps provider fields → `Resource`, sets `source_type`, `source_url`,
     and a **provenance** record.
2. **Schema additions (`0008_provenance.sql`):**
   - `resource_sources` (provider, source_id, fetched_at, raw payload) for lineage/debug.
   - On `resources`: `external_id`, `source_provider`, `ingested_at` (keep `last_checked` a human/
     verification judgment, not the fetch time).
   - Dedup key: (`source_provider`, `external_id`); geo-dedup for the same org across sources.
3. **Verification workflow:**
   - Default new rows to `verification_status: needs_review` unless from an official API (then
     `verified` with `source_type: official`).
   - Use the existing `resources_needing_review` view as the curator queue; freshness job flips
     rows to `needs_review` when `last_checked` ages past 90 days (matches client `isStale`).
4. **Freshness automation:** scheduled re-fetch; update `ingested_at`; surface staleness.
5. **Quality gates:** required fields, coordinate sanity, category mapping, phone/URL validation;
   reject/park bad rows rather than publishing them.
6. **Rollout:** start with **VA Facilities (official)** nationwide → immediate real coverage; layer
   directory sources per region; keep LA curated rows until superseded.

**Acceptance.** Nationwide official VA resources live via the **unchanged** `ResourceService`
interface; provenance recorded; verification + freshness automated; trust fields honest; spec'd via
[[Feature Spec Template]] and approved.

**Risks.** Data quality/staleness; category mapping; rate limits/ToS of sources; dedup. Verification
and freshness are the core of the product's trust promise — do not shortcut them.

---

### WS-8 — Release pipeline (EAS / store / privacy) — launch

**Goal.** Actually ship it.

**Steps:**
1. **EAS Build** profiles (`eas.json`): dev / preview / production; inject `EXPO_PUBLIC_*` via **EAS
   env/secrets** (baked at build). Bump `app.json` version/build numbers.
2. **iOS:** Apple Developer account, bundle id `com.frontline.app`, icons/splash, `PrivacyInfo.xcprivacy`
   (present), TestFlight → App Store. Handle **Sign in with Apple** requirement if WS-6 ships.
3. **Android (later):** keystore, adaptive icon, Play Console. Note: no reinstall-restore on Android
   until WS-6 (keystore wipe) — document as known limitation.
4. **Privacy policy** (required): what's collected (first name, ZIP, saved IDs; Google email if
   signed in), why, retention, deletion path. Link in-app + store listing.
5. **App Store metadata:** description, "not the VA / not government," screenshots, support URL.
6. **Data-deletion path** (store requirement): a way to wipe device backup + account (a `sync`
   `clearProfile` exists; add account delete in WS-6).
7. Run `release-manager` for the full checklist.

**Acceptance.** Signed production build in TestFlight/Play with prod env, privacy policy live,
store metadata honest, deletion path working.

---

## 6. Sequenced roadmap (order & dependencies)

**Now → launch-ready (backend polish, no new product surface):**
1. WS-1 ✅ · WS-2.1 seed key + reproducibility · WS-3 key/secret hygiene + advisors · Anthropic
   console cap. *(Small, do first.)*
2. WS-4 observability (Sentry + logs) · WS-5 critical tests. *(Confidence.)*

**Phase 11 (fast-follow or pre-launch, your call):**
3. WS-6 Google auth (spec → approve → build). Ships independently; anonymous launch is fine without it.

**Phase 12 (the real product depth):**
4. WS-7 data ingestion — start with VA Facilities for instant nationwide coverage, then layer sources.

**Launch:**
5. WS-8 release pipeline + privacy policy (can run in parallel with WS-6/7 once WS-1–5 are green).

**Dependency notes:** WS-6 adds the first `auth.uid()` RLS + `user_id` columns (0007); WS-7 adds
provenance (0008). WS-8 needs WS-3 (secrets) and, if sign-in ships, WS-6 (Apple sign-in + deletion).

---

## 7. Runbooks

### 7.1 Deploy an edge function
```bash
supabase functions deploy ai --no-verify-jwt      # self-gates on anon key
supabase functions deploy sync --no-verify-jwt
# (or via Supabase MCP deploy_edge_function with verify_jwt:false)
```

### 7.2 Set / rotate secrets (functions)
```bash
supabase secrets set ANTHROPIC_API_KEY=<key>          # rotate: revoke old in console first
supabase secrets set AI_HOURLY_BUDGET_USD=5           # tune spend cap (no redeploy)
supabase secrets set ANTHROPIC_MODEL_SUMMARY=claude-haiku-4-5
```

### 7.3 Seed / re-seed data
```bash
# .env.seed must hold real SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
set -a; . ./.env.seed; set +a
node --experimental-strip-types scripts/seed.ts       # resources + zip_centroids
```

### 7.4 Apply a migration
```bash
supabase db push                                       # or MCP apply_migration
# verify: MCP list_migrations / list_tables / get_advisors
```

### 7.5 Disaster recovery (fresh project)
1. `supabase link` → `supabase db push` (all migrations). 2. `scripts/seed.ts` (needs service key).
3. `supabase secrets set …` (Anthropic + models + budget). 4. `supabase functions deploy ai sync`.
5. Point `.env` at the new URL + publishable key; rebuild app. 6. Smoke-test §7.6.

### 7.6 Smoke test (post-deploy)
```bash
set -a; . ./.env; set +a
U=$EXPO_PUBLIC_SUPABASE_URL; A=$EXPO_PUBLIC_SUPABASE_ANON_KEY
curl -s "$U/rest/v1/rpc/search_resources" -H "apikey: $A" -H "Content-Type: application/json" -d '{"zip":"90012","radius_miles":25}'      # ranked LA resources
curl -s "$U/functions/v1/ai"   -H "apikey: $A" -H "Content-Type: application/json" -d '{"task":"summary","resource":{"id":"t","name":"X","category":"healthcare","description":"d","source_type":"official","verification_status":"verified","last_checked":"2026-06-01","documents_needed":[]}}'   # real summary
curl -s "$U/functions/v1/sync" -H "apikey: $A" -H "Content-Type: application/json" -d '{"action":"pull","deviceId":"00000000-0000-0000-0000-000000000000"}'   # nulls
```

### 7.7 Check AI spend
```sql
select window_start, round(spend_usd::numeric,4) usd from public.ai_spend order by window_start desc;
```

---

## 8. Definition of Done (production)

- [ ] WS-1 spend controls live + **Anthropic console cap set**.
- [ ] WS-2 seed reproducible (real service key), PITR on, runbooks written.
- [ ] WS-3 advisors clean, secrets rotated + git-ignored, PII minimal & documented.
- [ ] WS-4 error tracking + spend visibility + uptime alerting.
- [ ] WS-5 critical services + function logic under test; `npm run verify` green in CI.
- [ ] WS-6 (if in launch scope) optional Google auth, RLS isolation proven, decision logged.
- [ ] WS-7 real verified resources via unchanged interfaces; provenance + freshness automated.
- [ ] WS-8 signed prod build, privacy policy, store metadata, data-deletion path.

---

## 9. Open decisions
- Launch **anonymous-only** (defer WS-6) or ship accounts at launch?
- Production `AI_HOURLY_BUDGET_USD` value + Anthropic monthly cap.
- Initial data coverage: **LA pilot** vs nationwide VA-Facilities-first.
- Sentry vs another error tracker; hosted uptime monitor choice.
- Apple **Sign in with Apple** — required the moment Google sign-in ships.

---

## 10. Appendix A — Veteran data sources catalog

> Endpoint shapes/versions change — **verify at `developer.va.gov` (and each provider) before
> building an adapter**; use Context7/official docs. Captured here as the landscape, not gospel.

| Source | Provides | Auth | `source_type` | Notes |
|--------|----------|------|---------------|-------|
| VA Lighthouse **Facilities API** | VA health/benefits/Vet Center/cemetery locations + services + geo | free API key | `official` | Primary; nationwide; `?type=&lat=&long=&radius=` style |
| VA **Benefits Reference Data** | benefit categories/codes | key | `official` | Enrich summaries |
| VA **Forms API** | form metadata/links | key | `official` | "what to bring" |
| **National Resource Directory** | vetted veteran services | varies | `directory` | Broad, cross-agency |
| **211 / United Way** | local health & human services | partner | `directory` | Regional coverage |
| **findhelp (Aunt Bertha)** | social-care programs | partner API | `directory` | Food/housing/legal density |
| **HUD** | housing incl. HUD-VASH | open data | `directory`/`official` | Housing |
| State VA / **County VSOs** | benefits counseling | varies | `official`/`directory` | High-trust local |
| Legal aid / food-bank directories | legal, food | varies | `directory`/`nonprofit` | Category depth |

**Adapter contract:** `fetch → normalize to Resource → set source_type/source_url/provenance →
upsert (dedup on provider+external_id, then geo)`. Official APIs → `verified`; everything else →
`needs_review` until curated.

---

## 11. Appendix B — Cost model

Per call (max_tokens 4096; typical usage): **Haiku summary ≈ $0.0015**, **Opus plan/script ≈ $0.02**.
A resource open (auto summary+plan) ≈ **$0.022**; a call script adds ≈ $0.02 on tap. Guards:
per-IP 30/hr + global `AI_HOURLY_BUDGET_USD` (default $5/hr) + Anthropic console monthly cap. The
budget records **actual** `usage`, so estimates self-correct.

---

## Related
[[Technical Architecture]] · [[Phase 10 Backend and Data Ingestion]] · [[Environment Variables]] ·
[[AI Feature Design]] · [[Resource Data Model]] · [[File Creation Policy]] · [[Decision Log]] ·
[[Feature Spec Template]] · [[Claude Development Rules]]
