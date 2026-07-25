# Frontline

> **Find your next step.** Frontline helps veterans find benefits, local resources, and a clear
> plan for what to do next.

Frontline is a **React Native + Expo** app that helps **veterans** navigate the fragmented world of
benefits and local help. A veteran opens the app, chooses **what they need help with** (essentials,
housing, healthcare, VA benefits, jobs, legal, transportation, and more), shares a **location or
ZIP**, and gets **nearby, veteran-first resources**, **plain-English benefit explanations**, and
**AI-generated next steps** — what to bring, who to call, and what to say.

The AI is **embedded into real workflows** (guided need flows, next-step plans, call scripts,
benefit summaries), **not a chatbot**. Frontline is a **resource navigator, not the VA or a
government agency**, and its AI output is **simplified guidance, never legal, medical, financial, or
government-certified advice**.

**Principles:** veteran-first clarity · AI in workflows (not a chatbot) · trust by verification ·
not advice · privacy by default (no SSN / VA-login / bank / diagnosis) · accessibility always.

## Status

**Feature-complete and running on real data + real AI.** The full loop below works end-to-end
against a live Supabase backend: **~130k+ real resources** ingested from official/nonprofit sources,
and **real Claude inference** served through a server-side proxy (keys never ship in the client).
Trust signals (source type, last-checked date, veteran-relevance) are surfaced throughout, and every
data source refreshes on a schedule with a freshness gate. Remaining work is release engineering
(EAS build profiles, an Android Maps key, store assets) — tracked in
[docs/obsidian/](docs/obsidian/) — not the core product.

## Core flow

1. Open the app → **"What do you need help with?"**
2. Pick a **need category**.
3. Provide a **location or ZIP**.
4. See **nearby resources** as a **list and map**, ranked **veteran-first**.
5. Tap a resource → **detail**: a plain-English AI **summary**, eligibility, documents to bring, and
   **next steps**; jump straight to the pin with **"See in map."**
6. Generate a **call script** (plus a nervous-user variant).
7. **Save**, **call**, or get **directions**.

## Architecture

Frontline is a typed React Native client over a Supabase backend, with data supplied by a standalone
ingestion pipeline. The client talks to the backend through small, interface-first services
(`ResourceService`, `AiService`) so the data and AI layers are swappable and testable.

```text
 React Native app (Expo, expo-router)
   │  EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY   (publishable, RLS read-only)
   ▼
 Supabase
   ├─ Postgres: resources (RLS read-only) + search_resources() RPC (radius, veteran-first)
   └─ Edge Functions (Deno):
        ├─ ai   → Anthropic proxy (holds ANTHROPIC_API_KEY; rate-limit + hourly budget cap)
        └─ sync → anonymous device backup (saved items + profile)
   ▲
   │  service-role key (server-side only, never in the app)
 Ingestion pipeline (ingestion/, run like scripts/seed.ts — not app-bundle code)
   └─ VA Facilities · GI Bill · USAJOBS · HUD · SSVF · VSO reps · Feeding America · curated
      → normalize → Census geocode (cache-first) → validate → idempotent upsert
      → GitHub Actions cron (jobs weekly / places monthly) + freshness gate
```

- **Data model** — every resource carries `source_type`, `verification_status`, `last_checked`, and
  `veteran_relevance` (`veteran_specific | veteran_benefit | general`, NOT NULL). Search fills each
  category's result cap with veteran rows first; general rows are badged "Open to everyone" and
  capped client-side.
- **AI** — `summary` runs on Haiku (auto-loads on a resource, cheap); `plan` / `script` run on Opus.
  The proxy uses structured outputs, gates model-specific params, and enforces a per-IP rate limit +
  a global hourly spend budget, with the Anthropic console cap as the hard backstop.
- **Security** — Postgres RLS is deny-by-default on every table; RPCs are parameterized with pinned
  `search_path`; the Anthropic key lives only in Edge Function secrets; `.env*` is git-ignored. See
  [SECURITY.md](SECURITY.md).

## Tech stack

- **React Native + Expo (SDK 54)**, **TypeScript-first**, **expo-router** (file-based routing)
- **react-native-maps** for local discovery on iOS/Android (web shows a placeholder)
- **Supabase** — Postgres + RLS, Edge Functions (Deno), PostgREST (hand-rolled fetch transport)
- **Anthropic Claude** (Opus 4.8 / Haiku 4.5) behind the `ai` Edge Function proxy
- **Vitest** for unit tests; **ESLint + Prettier + tsc** for the quality gate
- **GitHub Actions** — CI (typecheck/lint/test) + a scheduled data-refresh workflow

## Project structure

```text
Frontline/
├── app/                 # expo-router routes (tabs, onboarding, results, resource detail)
├── src/
│   ├── components/      # shared UI primitives (AppText, Card, PrimaryButton, states…)
│   ├── features/        # feature UI (resources, discover, onboarding, home, needs)
│   ├── services/        # ResourceService + AiService (client) and Supabase transport
│   ├── theme/           # design tokens: colors, spacing, radii, shadows, typography
│   ├── lib/             # pure helpers (geo, hours, zipState)
│   └── types/           # domain types (resource, need, profile, activity)
├── supabase/            # migrations, Edge Functions (ai, sync), config
├── ingestion/           # standalone data pipeline (sources, geocode, freshness gate)
├── scripts/             # seed.ts (ZIP centroids reference data)
├── docs/                # the project "brain" (Obsidian vault) + GitHub workflow guides
└── assets/              # icons, splash
```

## Getting started

**Prerequisites:** **Node.js ≥ 22** (the ingestion tooling uses native TS type-stripping), and a way
to preview — an iOS Simulator (development build), Android emulator, or a web browser.

```bash
npm install
cp .env.example .env     # fill in the two EXPO_PUBLIC_SUPABASE_* values
npm start                # start the Expo dev server, then press i / a / w
```

The app reads live resources and AI from Supabase, so it needs the two `EXPO_PUBLIC_SUPABASE_*`
values in `.env`. Full run instructions, per-platform notes, and troubleshooting live in
[docs/RUNNING.md](docs/RUNNING.md); backend/AI setup (Edge Function secrets, deploys) is in
[BACKEND_SETUP.md](BACKEND_SETUP.md).

## Scripts

| Script | Purpose |
|--------|---------|
| `start` · `ios` · `android` · `web` | Launch the Expo dev server (optionally on a platform) |
| `typecheck` | `tsc --noEmit` |
| `lint` / `format` / `format:check` | ESLint · Prettier write · Prettier check |
| `test` / `test:watch` | Vitest unit tests |
| `verify` | typecheck + lint — run before every PR (also what CI runs) |

## Development workflow

Feature work happens on a branch (**one task per branch** — `feature/…`, `fix/…`, `docs/…`,
`chore/…`), guarded by a checks-only post-edit hook (`.claude/hooks/quality-check.sh`) and CI. Run
`verify` and `test` before opening a PR; PRs use
[.github/pull_request_template.md](.github/pull_request_template.md). See
[CONTRIBUTING.md](CONTRIBUTING.md) and [docs/github/](docs/github/).

## Documentation

- **[BACKEND_SETUP.md](BACKEND_SETUP.md)** — Supabase project, migrations, Edge Function secrets, deploys.
- **[SECURITY.md](SECURITY.md)** — threat model, the anon-key/console-cap AI model, RLS posture.
- **[docs/obsidian/](docs/obsidian/)** — the project brain (product, design, technical, roadmap, logs).
  Start at [Frontline Command Center](docs/obsidian/00%20Start%20Here/Frontline%20Command%20Center.md).
- **[CHANGELOG.md](CHANGELOG.md)** · **[SKILLS.md](SKILLS.md)**

## Notes

- **License:** proprietary — all rights reserved (see [LICENSE](LICENSE)). Not licensed for reuse.
- **Not the VA:** Frontline is a navigator; AI output is guidance, not legal/medical/financial/
  government-certified advice.
- **Privacy:** the app collects the minimum (an optional first name + ZIP, on-device); no SSN, VA
  login, bank info, or diagnosis. No real secrets are ever committed.
