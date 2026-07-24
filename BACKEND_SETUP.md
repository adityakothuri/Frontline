# Frontline Backend Setup — Do-This-Exactly Runbook

> **This file is safe to delete.** Nothing references it. When you're done: `rm BACKEND_SETUP.md`.
> It's a throwaway checklist for standing up the Phase 10 backend (Supabase + Claude). The
> permanent version of this lives in `docs/obsidian/06 Build Logs/2026-07-12 Phase 10 …`.

You'll create **2 accounts** and handle **4 secret/config values**. Total time ~30–45 min.
Everything the app needs is already coded — this just wires it to your live project. Until you
finish, the app keeps running in offline mock mode exactly as it does today.

Commands run from the repo root: `/Users/sandhyakothuri/Frontline`.

---

## The keys/values at a glance

| # | Value | You get it from | Where it goes | Secret? |
|---|-------|-----------------|---------------|---------|
| 1 | Supabase **Project URL** | Supabase dashboard → Settings → API | `.env` → `EXPO_PUBLIC_SUPABASE_URL` **and** `.env.seed` → `SUPABASE_URL` | No (public) |
| 2 | Supabase **anon / publishable key** | same page | `.env` → `EXPO_PUBLIC_SUPABASE_ANON_KEY` | No (RLS makes it read-only) |
| 3 | Supabase **service-role / secret key** | same page ("reveal") | `.env.seed` → `SUPABASE_SERVICE_ROLE_KEY` only | **YES — never in the app** |
| 4 | **Anthropic API key** | console.anthropic.com → API Keys | Supabase **function secret** only | **YES — never in the app/repo** |

No other keys. Maps = Apple Maps (free, keyless). Geocoding = a ZIP table already in Postgres. No
login/OAuth (backup sync uses an anonymous device id).

---

## STEP 0 — Prerequisites (one-time)

The Supabase CLI is already installed for you at `~/.local/bin/supabase`. Confirm:

```bash
supabase --version        # should print 2.109.x
node --version            # should be v22+ (you have v24 — needed by the seed script)
```

If `supabase` isn't found, its folder isn't on your PATH — run `export PATH="$HOME/.local/bin:$PATH"`.

---

## STEP 1 — Create the Supabase project & copy 3 values

1. Go to **https://supabase.com** → sign in → **New project**.
   - Name: `frontline` (anything). Pick a region near you. Set a database password (save it; you
     won't need it for these steps but Supabase wants one).
2. Wait ~2 min for it to provision.
3. Open **Project Settings → API**. Copy three things into a scratch note:
   - **Project URL** → value **#1** (looks like `https://abcdxyz.supabase.co`)
   - **anon public** (or `sb_publishable_…`) key → value **#2**
   - **service_role** (or `sb_secret_…`) key → click reveal → value **#3**  ⚠️ *this one is powerful — treat like a password*

---

## STEP 2 — Create the Anthropic API key (value #4)

1. Go to **https://console.anthropic.com** → sign in → **API Keys** → **Create Key**.
2. Copy the key (`sk-ant-…`) → value **#4**.
3. Recommended: **Settings → Limits** → set a small monthly spend cap (e.g. $10) while testing.

---

## STEP 3 — Write the two env files

**3a. The app env** — create `.env` in the repo root:

```bash
cat > .env <<'EOF'
EXPO_PUBLIC_SUPABASE_URL=PASTE_VALUE_1_HERE
EXPO_PUBLIC_SUPABASE_ANON_KEY=PASTE_VALUE_2_HERE
EOF
```

**3b. The seed-script env** — create `.env.seed` in the repo root (git-ignored; holds the powerful key):

```bash
cat > .env.seed <<'EOF'
SUPABASE_URL=PASTE_VALUE_1_HERE
SUPABASE_SERVICE_ROLE_KEY=PASTE_VALUE_3_HERE
EOF
```

Then open both files and replace the `PASTE_…` placeholders with your real values.
✅ Both `.env` and `.env.seed` are already git-ignored — they will not be committed.

---

## STEP 4 — Link the CLI to your project

```bash
supabase login          # opens a browser, click approve
supabase link           # pick your "frontline" project from the list
```

(If `supabase link` asks for the DB password, use the one from Step 1.)

---

## STEP 5 — Create the database tables (push migrations)

This applies all 5 migration files in `supabase/migrations/` (resources, zip centroids, search
function, rate limits, backup tables):

```bash
supabase db push
```

Expected: it lists `0001 … 0005` and says applied. If it errors, copy the message to me.

---

## STEP 6 — Load the real data (seed)

Uploads the 12 curated LA resources **and** ~33,000 US ZIP centroids:

```bash
set -a; . ./.env.seed; set +a          # load the seed env into this shell
node --experimental-strip-types scripts/seed.ts
```

Expected output ends with `zip_centroids: 33790/33790` then `Done.` (the ZIP upload is the slow
part — ~30–60s).

---

## STEP 7 — Deploy the two Edge Functions & set the Claude secret

```bash
# The Anthropic key lives ONLY here (server-side), never in the app:
supabase secrets set ANTHROPIC_API_KEY=PASTE_VALUE_4_HERE

# Model selection is per-task to control cost (all optional; these are the
# defaults). Summaries auto-load on every resource open, so they run on cheap
# Haiku; plans + call scripts run on Opus. ANTHROPIC_MODEL is the Opus default
# for plan/script.
supabase secrets set ANTHROPIC_MODEL=claude-opus-4-8          # plan + script default
supabase secrets set ANTHROPIC_MODEL_SUMMARY=claude-haiku-4-5 # cheap summaries
# supabase secrets set ANTHROPIC_MODEL_PLAN=claude-opus-4-8   # override if needed
# supabase secrets set ANTHROPIC_MODEL_SCRIPT=claude-opus-4-8 # override if needed

# Deploy both functions (--no-verify-jwt matches their config: they gate on the anon key themselves)
supabase functions deploy ai --no-verify-jwt
supabase functions deploy sync --no-verify-jwt
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected into deployed
functions automatically — you don't set those.

---

## STEP 8 — Smoke-test the backend (optional but recommended)

Load your values into the shell first:

```bash
set -a; . ./.env; set +a
URL=$EXPO_PUBLIC_SUPABASE_URL; ANON=$EXPO_PUBLIC_SUPABASE_ANON_KEY
```

**Resources RPC** (should list LA resource names near downtown LA):

```bash
curl -s "$URL/rest/v1/rpc/search_resources" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d '{"zip":"90012","radius_miles":25}'
```
> If your key starts with `sb_publishable_`, drop the `-H "Authorization: Bearer $ANON"` line
> (publishable keys aren't JWTs and go on `apikey` only).

**AI function** (should return a JSON summary):

```bash
curl -s "$URL/functions/v1/ai" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"task":"summary","resource":{"id":"t","name":"LA Vet Center","category":"healthcare","description":"Counseling for veterans.","source_type":"official","verification_status":"verified","last_checked":"2026-06-01","documents_needed":[]}}'
```

**Backup sync** (should return nulls — nothing backed up yet):

```bash
curl -s "$URL/functions/v1/sync" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"action":"pull","deviceId":"00000000-0000-0000-0000-000000000000"}'
```

Anything returning an `{"error": …}` → paste it to me.

---

## STEP 9 — Native rebuild (required once, for backup sync)

Backup sync uses `expo-secure-store` (a native module), so a plain reload isn't enough — you need
a dev build:

```bash
npx expo prebuild --clean
# then rebuild & run the iOS dev build the way you normally do:
open ios/Frontline.xcworkspace   # Run in Xcode
# (or: npx expo run:ios)
```

> If you only want to test resources + AI right now and skip backup sync, you can defer this step —
> the app will still run; the sync layer just no-ops until the native module is present.

---

## STEP 10 — Run the app against the real backend

```bash
# IMPORTANT: env vars are baked in at bundle time — start Metro fresh after editing .env
npx expo start --dev-client -c
```

Then in the app, confirm the real backend is live:
- **Resources** are real LA orgs (from your DB), searchable by your ZIP.
- Open a resource → the **AI summary / next steps / call script** are generated by Claude (watch
  usage tick up in the Anthropic console).
- **Save a resource**, delete-and-reinstall the app (iOS) → it should come back (backup restore).
- Turn on **airplane mode** and open a resource → you get the error/retry UI (resources) and
  templated fallback (AI), never fake data.

---

## Verifying offline mode still works (sanity check)

Rename `.env` and restart — the app should behave exactly as before (mock resources, templated AI,
on-device saved/profile):

```bash
mv .env .env.off && npx expo start --dev-client -c
# restore with: mv .env.off .env
```

---

## If you want to undo everything

- **App side:** `rm .env .env.seed` and restart → back to offline mock mode.
- **Backend side:** in the Supabase dashboard, delete the project (removes all tables, data, and
  functions). Revoke the Anthropic key in its console.
- **This file:** `rm BACKEND_SETUP.md`.

---

## Cheat sheet — the whole thing, in order

```bash
# after creating the Supabase project + Anthropic key and filling .env / .env.seed:
supabase login
supabase link
supabase db push
set -a; . ./.env.seed; set +a
node --experimental-strip-types scripts/seed.ts
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai --no-verify-jwt
supabase functions deploy sync --no-verify-jwt
npx expo prebuild --clean       # then rebuild the iOS dev build in Xcode
npx expo start --dev-client -c
```

Stuck on any step? Paste the exact command + its output and I'll sort it.
