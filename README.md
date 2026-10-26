# Frontline

> **Find your next step.** Frontline helps U.S. veterans find benefits, local resources, and a
> clear plan for what to do next.

Frontline is a **React Native + Expo (TypeScript)** app for iOS and Android. A veteran says what
they need help with (essentials, housing, healthcare, VA benefits, jobs, legal, transportation, and
more), shares a ZIP or their location, and gets **nearby, veteran-first resources**, **plain-English
explanations**, and **AI-generated next steps**: what to bring, who to call, and what to say.

AI is embedded in the workflows (summaries, next-step plans, call scripts), plus the **Ask
Frontline** navigator, a short conversation where every reply ends in a tappable in-app action
rather than open-ended chat. Frontline is a **resource navigator, not the VA or a government
agency**. Its AI output is simplified guidance, never legal, medical, financial, or
government-certified advice.

## Status

Feature-complete and running on **live data and real AI**. The app reads from a live Supabase
backend fed by a national ingestion pipeline: 20 public and nonprofit source adapters, covering
tens of thousands of veteran-specific places across the US. Claude runs
behind a server-side proxy, so no API key ships in the app. Remaining work is release engineering
(Android Maps key, store assets).

## What it does

1. **Home: "What do you need help with?"** Start from a category, or open **Ask Frontline** and
   describe the situation in your own words. Each reply ends in an action: results for a category,
   the map, your profile, or the Veterans Crisis Line.
2. **Guided need flow.** A few short questions: what exactly, how urgent, in person or online,
   which documents you already have, and whether you want to call, visit, apply, or understand.
3. **Local discovery.** Nearby resources as a **list and a map**, ranked veteran-first, with
   statewide and national veteran referrals in their own section.
4. **Resource detail.** A plain-English AI summary, eligibility, documents to bring, and a
   next-step plan, alongside the source type and last-checked date.
5. **Call script.** A short, specific script for that resource, plus a shorter variant for a
   nervous caller.
6. **Act and keep.** Call, get directions, or save. Saved resources, an optional profile, and
   "remind me when this opens" notifications live on the device (with an optional anonymous
   backup).

## What's technically notable

- **National ingestion pipeline** ([ingestion/](ingestion/)). It has 20 active source adapters
  (VA Lighthouse Facilities, GI Bill schools, VA OGC accredited organizations, SAMHSA, HRSA,
  HUD, CareerOneStop job centers, LSC legal aid, Feed America, and others). Each one normalizes
  records to a typed `Resource`, geocodes through the Census batch geocoder (cache-first, exact
  pins or none), and upserts on a deterministic id, so a re-run never duplicates. After each
  source runs, a **reaper** removes rows the provider no longer serves, and it refuses to delete
  more than a fifth of them. A monthly GitHub Actions job runs the refresh, and a **freshness
  gate** fails the job and opens an issue when any source ages past its cadence. Data-quality
  purges (migrations 0023–0036) removed volume a veteran could not act on: school cafeterias,
  SNAP retailers, phoneless registries, and fabricated ZIP-centroid pins.
- **Veteran-first ranking in Postgres.** The `search_resources()` RPC does radius search with an
  index-usable bounding box. It fills each category's cap with veteran rows before general ones,
  caps dense general categories, and serves state-scoped referrals for resources with no single
  location. Migration 0037 cut the no-ZIP browse from about 9.8 s to 44 ms.
- **Per-task model routing behind a proxy.** The `ai` Edge Function holds the Anthropic key and
  routes each task to a model: `summary` to Haiku 4.5 (it auto-loads on every resource open),
  `plan` and `script` to Sonnet 5.5, and `chat` to Opus 5.5. Each model can be overridden with an
  env var. Responses use structured outputs. The function enforces a per-IP hourly rate limit
  (with a separate bucket for chat), payload size caps, and a global hourly spend budget.
- **Security posture.** Row-level security is deny-by-default on every table. The public tables
  are `SELECT`-only. RPCs are parameterized and pin `search_path`. The anonymous device backup is
  reachable only through the `sync` function. See [SECURITY.md](SECURITY.md).
- **Typed service seams.** `ResourceService`, `AiService`, `RatingsService`, and the
  saved/profile/sync services are interfaces with Supabase-backed implementations, so screens
  never touch transport code.
- **Tests and CI.** About 300 Vitest unit tests cover ranking, hours parsing, distance, chat
  validation, ingestion parsers, and the reaper. CI runs `npm run verify` on every PR.

## Architecture

```text
 React Native app (Expo SDK 57, expo-router) — iOS / Android
   │  EXPO_PUBLIC_SUPABASE_URL + _ANON_KEY  (publishable; RLS read-only)
   ▼
 Supabase
   ├─ Postgres: resources, zip_centroids (SELECT-only)
   │            search_resources() RPC — radius, veteran-first, state-scoped referrals
   │            resource_votes, backups, rate_limits, ai_spend (deny-all, service-role only)
   └─ Edge Functions (Deno)
        ├─ ai   → Anthropic: summary | plan | script | chat
        │         (per-task models, per-IP rate limit, hourly spend cap)
        └─ sync → anonymous device backup of saved items + profile
   ▲
   │  service-role key (server-side only, never in the app)
 Ingestion pipeline (ingestion/, Node scripts — not in the app bundle)
   └─ 20 sources → normalize → Census geocode (cached) → validate → idempotent upsert → reap
      GitHub Actions: monthly refresh + freshness gate
```

## Tech stack

- **Expo SDK 57**, **React Native 0.86**, **React 19.2**, TypeScript, expo-router, dev client
  (`expo-dev-client`), with iOS and Android targets and no web build
- **react-native-maps** (Apple Maps on iOS), Reanimated, Gesture Handler, react-native-svg
- **Supabase**: Postgres + RLS, Edge Functions (Deno), PostgREST over a small typed fetch client
- **Anthropic Claude** (Haiku 4.5, Sonnet 5.5, Opus 5.5) behind the `ai` Edge Function
- **Sentry** crash reporting (optional, PII-scrubbed), expo-notifications for local reminders
- **Vitest**, **ESLint**, **Prettier**, **tsc**; **GitHub Actions** for CI and data refresh

## Project structure

```text
Frontline/
├── app/                  # expo-router routes: tabs (home, discover, map, saved, profile),
│                         #   ask, onboarding, results, resource/[id]
├── src/
│   ├── components/       # shared UI primitives (AppText, DataRow, TextAction, states…)
│   ├── features/         # ask, discover, home, needs, onboarding, profile, resources
│   ├── services/         # ai, resources, saved, profile, sync, ratings, reminders,
│   │                     #   activity, location, monitoring, supabase
│   ├── hooks/            # reduced motion, retry-on-return, stagger gate
│   ├── data/             # official-source link catalogue
│   ├── lib/              # pure helpers (geo, hours, urls, zipState)
│   ├── theme/            # Field Manual tokens: colors, spacing, typography, motion
│   ├── types/            # domain types (resource, need, profile, activity)
│   └── test/             # test factories
├── supabase/             # migrations, Edge Functions (ai, sync), config.toml
├── ingestion/            # data pipeline: sources/, lib/, upsert, reap, freshness gate
├── scripts/              # seed.ts (ZIP centroid reference data)
├── docs/                 # runbooks and legal pages
└── .github/              # CI, scheduled data refresh, PR template
```

## Getting started

**Prerequisites:** Node.js 22 or later, npm, and Xcode with CocoaPods for iOS (or Android Studio
for Android). Frontline uses a **development build**, not Expo Go.

```bash
npm install
cp .env.example .env      # fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm run ios               # first time: prebuild, pod install, compile, launch the Simulator
npx expo start --dev-client   # afterwards: just start Metro
```

Both `EXPO_PUBLIC_SUPABASE_*` values are required. The app reads live data and AI from Supabase,
and there is no offline or mock mode. Full instructions are in [docs/RUNNING.md](docs/RUNNING.md).
Standing up your own backend is covered in [BACKEND_SETUP.md](BACKEND_SETUP.md).

## Scripts

| Script | Purpose |
|--------|---------|
| `start` | Expo dev server (Metro) |
| `ios` / `android` | Build and run the dev client (`expo run:*`) |
| `typecheck` | `tsc --noEmit` |
| `lint` | ESLint |
| `format` / `format:check` | Prettier write / check |
| `test` / `test:watch` | Vitest unit tests |
| `verify` | typecheck + lint + format:check + test; run before every PR (CI runs it too) |

## Documentation

- [docs/RUNNING.md](docs/RUNNING.md): running the app locally
- [BACKEND_SETUP.md](BACKEND_SETUP.md): Supabase project, migrations, Edge Function secrets
- [ingestion/README.md](ingestion/README.md): sources, inclusion rule, refresh schedule
- [SECURITY.md](SECURITY.md): threat model and backend security posture
- [docs/PRIVACY.md](docs/PRIVACY.md) and [docs/TERMS.md](docs/TERMS.md): published legal pages
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): iOS release via EAS
- [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md)

## Notes

- **License:** proprietary, all rights reserved (see [LICENSE](LICENSE)).
- **Not the VA:** Frontline is an independent navigator. Always confirm details with the
  organization or official source.
- **Privacy:** no account and no SSN, VA login, bank details, or diagnosis. The profile is
  optional. See [docs/PRIVACY.md](docs/PRIVACY.md) for exactly what reaches the server and the
  AI provider.
