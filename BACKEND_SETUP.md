# Frontline Backend Setup

How to stand up the Frontline backend (Supabase + Claude) from scratch, for example on a fresh
project or a fork. The production project is already live. For the app itself, see
[docs/RUNNING.md](docs/RUNNING.md). For the data pipeline, see
[ingestion/README.md](ingestion/README.md).

You need **2 accounts** (Supabase and Anthropic) and **4 values**. Run all commands from the repo
root.

---

## The values at a glance

| # | Value | Where you get it | Where it goes | Secret? |
|---|-------|------------------|---------------|---------|
| 1 | Supabase **Project URL** | Dashboard → Project Settings → API | `.env` → `EXPO_PUBLIC_SUPABASE_URL`, and `.env.seed` → `SUPABASE_URL` | No |
| 2 | Supabase **anon / publishable key** | same page | `.env` → `EXPO_PUBLIC_SUPABASE_ANON_KEY` | No (RLS makes it read-only) |
| 3 | Supabase **service-role / secret key** | same page (reveal) | `.env.seed` → `SUPABASE_SERVICE_ROLE_KEY` only | **Yes. Never in the app** |
| 4 | **Anthropic API key** | console.anthropic.com → API Keys | Supabase Edge Function secret only | **Yes. Never in the app or repo** |

Ingestion also needs a free `VA_API_KEY` (developer.va.gov) and, optionally, a `DATA_GOV_API_KEY`.
See [ingestion/README.md](ingestion/README.md). Maps use Apple Maps on iOS, which is keyless. A
ZIP is turned into coordinates with the `zip_centroids` table. There is no login; backup sync
uses an anonymous device id.

`.env` and `.env.seed` are both git-ignored.

---

## 1. Prerequisites

- **Node.js 22 or later.** The seed and ingestion scripts use native TypeScript type-stripping.
- **Supabase CLI** (`supabase --version`).

## 2. Create the project and keys

1. Create a project at supabase.com and copy values **#1–#3** from Project Settings → API.
2. Create an Anthropic API key (value **#4**). Then set a **monthly spend limit** in the Anthropic
   console. This is the hard backstop behind the in-function budget (see
   [SECURITY.md](SECURITY.md)).

## 3. Write the env files

```bash
cat > .env <<'EOF'
EXPO_PUBLIC_SUPABASE_URL=<value 1>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<value 2>
EOF

cat > .env.seed <<'EOF'
SUPABASE_URL=<value 1>
SUPABASE_SERVICE_ROLE_KEY=<value 3>
EOF
```

## 4. Link the CLI and apply the migrations

```bash
supabase login
supabase link            # choose your project
supabase db push
```

`supabase/migrations/` holds about 37 numbered migrations, `0001_resources.sql` through
`0037_search_perf.sql`. They cover the resources table and search RPC, ZIP centroids, rate
limits, backup tables, the AI spend ledger, provenance, votes, the geocode cache, grant
hardening, the 0023–0036 data-quality purges, and the search performance work. Two quirks in the
numbering:

- **There is no `0007`.** The number was never used.
- **`0035` is used twice** (`0035_drop_school_based_health_centers.sql` and
  `0035_resources_autovacuum_for_index_only_scans.sql`). Both apply, in filename order.

The live project's migration history uses **timestamp versions** (for example
`20260728163219_food_must_be_proven`), because those migrations were applied through the Supabase
MCP rather than `db push`. The SQL is the same. Only the version keys differ, so don't expect
`supabase migration list` to line up one-to-one with the filenames on the production project.

## 5. Seed reference data and load resources

```bash
set -a; . ./.env.seed; set +a
node --experimental-strip-types scripts/seed.ts        # ~33.8k US ZIP centroids
bash ingestion/refresh.sh all                          # the national resource catalogue
```

`seed.ts` loads only the ZIP-centroid reference table. **All resources come from the ingestion
pipeline**, which covers the whole country across about 20 providers. A full refresh is long; the
scheduled CI job allows 90 minutes. To try one source first, use `--dry-run` (see
[ingestion/README.md](ingestion/README.md)).

## 6. Deploy the Edge Functions and set secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=<value 4>

# Optional per-task model overrides. The defaults in supabase/functions/ai/index.ts are:
#   summary → claude-haiku-4-5   plan → claude-sonnet-5-5
#   script  → claude-sonnet-5-5  chat → claude-opus-5-5
# supabase secrets set ANTHROPIC_MODEL_SUMMARY=claude-haiku-4-5
# supabase secrets set ANTHROPIC_MODEL_PLAN=claude-sonnet-5-5
# supabase secrets set ANTHROPIC_MODEL_SCRIPT=claude-sonnet-5-5
# supabase secrets set ANTHROPIC_MODEL_CHAT=claude-opus-5-5
# Optional global hourly spend budget in USD (default 5):
# supabase secrets set AI_HOURLY_BUDGET_USD=5

supabase functions deploy ai --no-verify-jwt
supabase functions deploy sync --no-verify-jwt
```

`--no-verify-jwt` matches `supabase/config.toml`. The newer `sb_publishable_` keys aren't JWTs, so
each function checks the `apikey` header itself. Supabase injects `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into deployed functions automatically.

An override secret takes precedence over the code default. Thinking settings depend on the model:
Haiku gets none, Sonnet 5.5 has thinking off, and any other model gets adaptive thinking at low
effort. A model missing from the function's price table is billed against the budget at
conservative Opus rates.

## 7. Smoke-test

```bash
set -a; . ./.env; set +a
URL=$EXPO_PUBLIC_SUPABASE_URL; ANON=$EXPO_PUBLIC_SUPABASE_ANON_KEY

# Resource search: should return nearby rows for the ZIP
curl -s "$URL/rest/v1/rpc/search_resources" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"zip":"90012","radius_miles":25}' | head -c 600

# AI summary: should return a JSON summary
curl -s "$URL/functions/v1/ai" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"task":"summary","resource":{"id":"t","name":"Example Vet Center","category":"healthcare","description":"Counseling for veterans.","source_type":"official","verification_status":"verified","last_checked":"2026-06-01","documents_needed":[]}}'

# Backup sync: should return nulls for an unknown device
curl -s "$URL/functions/v1/sync" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"action":"pull","deviceId":"00000000-0000-0000-0000-000000000000"}'
```

If you use a legacy JWT anon key, also pass `-H "Authorization: Bearer $ANON"`.

## 8. Run the app against it

Backup sync uses `expo-secure-store`, a native module, so the app runs as a dev build:

```bash
npm run ios                       # or: npx expo prebuild -p ios, then open ios/Frontline.xcworkspace and Run
npx expo start --dev-client -c    # -c because EXPO_PUBLIC_* values are baked in at bundle time
```

To check that everything is live: results load for your ZIP, a resource shows a Claude summary
and plan (usage appears in the Anthropic console), Ask Frontline replies, and a saved resource
survives an iOS reinstall. In airplane mode the app shows its error/retry states. There is no
mock data or templated fallback.

## 9. Scheduled refresh

`.github/workflows/refresh-data.yml` re-runs ingestion monthly and then runs the freshness gate.
It needs the repo secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `VA_API_KEY` (plus
`DATA_GOV_API_KEY` optionally). Scheduled workflows only fire from the default branch.

## Tearing it down

Delete the Supabase project (this removes all tables, data, and functions), revoke the Anthropic
key, and delete `.env` / `.env.seed`.
