# Changelog

All notable changes to Frontline will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project aims to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version ladder (planned): `0.1.0` first MVP demo · `0.2.0` backend integration ·
`0.3.0` real AI/video prototype · `1.0.0` public-ready MVP.

## [Unreleased]

Work since the 1.0.0 release candidate (2026-07-28 to 2026-10-24). Not yet tagged.

### Added

- **Ask Frontline navigator** (`app/ask.tsx`, `src/features/ask/`, the `chat` task in the `ai`
  Edge Function). A veteran describes a need in their own words, and every reply ends in a
  validated in-app action: results for a category, the map, their profile, or the Veterans Crisis
  Line. It has its own hourly rate-limit bucket, a 12-turn session cap, and server-side input
  bounds (`supabase/functions/ai/chatRequest.ts`).
- **New data sources**: state veterans homes (NASVH), VA OGC accredited organizations, SAMHSA
  veteran behavioral health, USAspending VA/DOL grantees, Fisher Houses, LSC legal aid,
  CareerOneStop American Job Centers, VA transportation representatives, NACVSO county veterans
  service offices, Catholic Charities, OpenStreetMap charity shops, FTA transit agencies, HUD
  public housing authorities, and HRSA health centers. VA Facilities is now cross-listed by
  service, so homeless programs, caregiver support, emergency care, and travel reimbursement each
  surface in the right category.
- **Reaper** (`ingestion/reap.ts`), run after each source, removes rows a provider no longer
  serves. It refuses to delete more than a fifth of a provider's rows.
- **"Remind me when this opens"** local notifications, and a redesigned Profile (search area,
  documents-on-hand checklist, privacy summary).

### Changed

- **Field Manual redesign.** Barlow Condensed / Public Sans / Overpass Mono on manila paper with
  ink rules and a single olive action color. It replaces the earlier paper theme (Inter +
  Fraunces, rounded cards, pills) and comes with a motion system and a rebuilt Home and Map.
- **Speed pass.** Migration `0037_search_perf.sql` cuts the no-ZIP browse from about 9.8 s to
  44 ms and moves the dense-general and uncontactable caps into the RPC. Covering indexes and
  autovacuum tuning came in 0029–0031 and 0035–0036. The client now uses one retry with an 8 s
  timeout, makes at most two radius-widening searches, and resolves saved items in one request.
  The launch intro no longer blocks mounting. Metro keeps a persistent cache.
- **AI model routing.** `plan` and `script` moved to `claude-sonnet-5-5` with thinking off.
  `summary` stays on `claude-haiku-4-5`, and `chat` runs on `claude-opus-5-5`. Each task can be
  overridden with `ANTHROPIC_MODEL_SUMMARY` / `_PLAN` / `_SCRIPT` / `_CHAT`. The rate-limit and
  budget checks run in parallel.
- Data refresh is **monthly only**. With USAJOBS retired there is no weekly source left.
- `npm run verify` now runs typecheck, lint, format:check, and tests, and CI runs it.

### Removed

- **Web target**: `react-native-web`, `react-dom`, `ResourceMap.web.tsx`, the `web` script, and
  the web favicon. Frontline is iOS and Android only.
- **Retired providers**: individual VSO representatives (0024; replaced by VSO organizations),
  plus **USAJOBS** postings and the **IRS veterans-organizations** register (0033). Both were
  high-volume with no phone or street address.

### Fixed

- **Data quality purges (0023–0036).** These removed things a veteran could not act on: Feed
  America school-meal and summer-meal sites and mis-tagged behavioral-health facilities (0023),
  food sites hosted in schools and childcare centers (0025), VSO rows pinned to invented
  ZIP-centroid locations (0027–0028), SNAP retailers and fast-food franchises (0032), phoneless
  volume (0033), food rows not proven to distribute food (0034), and school-based health
  centers (0035). Raw payload archives were reclaimed to stay under the storage ceiling (0026).
- Statewide referrals are now state-scoped and capped server-side (0027).

## [1.0.0] — 2026-07-26

First App Store release candidate. Everything below is the 1.0.0 scope, including the
production-readiness pass that closed out release engineering.

### Added

- **Crash reporting** — Sentry behind a service seam (`src/services/monitoring/`), gated on
  `EXPO_PUBLIC_SENTRY_DSN` so it is a no-op when unconfigured. PII-scrubbing `beforeSend`, no
  session replay, no screenshots, no view hierarchy.
- **iOS privacy manifest** (`ios.privacyManifests`) declaring the four required-reason API
  categories and the data the app actually transmits; `NSPrivacyTracking` false.
- **On-device AI cache** — the summary and next-step plan a resource page auto-fires are cached by a
  hash of their prompt inputs, so re-opening a resource no longer re-derives identical text.
- **Terms of Use** (`docs/TERMS.md`).
- **Full veteran resource navigator** — guided need flow, list + map discovery (veteran-first
  ranking), resource detail pages, saved resources, and an optional on-device profile.
- **Live backend** — Supabase Postgres (RLS deny-by-default) with a radius search RPC, and a data
  ingestion pipeline (`ingestion/`) pulling ~130k real resources (at the time) from VA Facilities, GI Bill,
  USAJOBS, HUD, SSVF, VSO reps, Feed America, and a curated list, refreshed on a GitHub Actions
  cron with a freshness gate.
- **Real AI** — plain-English benefit summaries, next-step plans, and call scripts served through the
  `ai` Edge Function proxy (Anthropic Claude; keys never in the client), with a per-IP rate limit and
  an hourly spend budget.
- **"See in map"** on every opportunity (context-aware focus; struck-through when a resource has no
  map location); an **"Essentials"** need category (merged Food + Clothing).
- **Unit tests** — Vitest suite over the pure logic (distance, sorting, status, hours, mapping).
- Design-system tokens (`shadows`, `xxs` spacing, `displayLarge`, onboarding accents); repo metadata,
  `.nvmrc`, `.editorconfig`.

### Changed

- **Expo SDK 54 → 57** (React Native 0.81 → 0.86, React 19.1 → 19.2.3), upgraded one SDK at a time.
  Production `npm audit` advisories dropped 34 → 12, all build-time tooling.
- Adopted SDK 57's React Compiler lint rules: 12 `useRef(new Animated.Value(x)).current` sites — which
  allocated a throwaway value on every render — converted to lazy `useState`.
- iOS now declares only the location permission it uses; the `expo-location` plugin's unused
  "Always" and motion usage strings are suppressed.
- Rewrote `README` and refreshed `CONTRIBUTING` / `SECURITY` to describe the real,
  shipped architecture (previously described a simulated/unbuilt MVP).
- Hardened the Edge Functions: rate-limit on the trusted `x-forwarded-for` hop, caller payload size
  caps (→ 413), and `Allow: POST` on 405. Tightened `config.toml` auth defaults.
- CI runs typecheck + lint + tests on Node 22 with dependency caching.

### Fixed

- **Security (backend):** revoked leftover schema-default write grants (`INSERT`/`UPDATE`/`DELETE`/
  `TRUNCATE`) held by `anon`/`authenticated` on seven tables and the curator view; `resources` and
  `zip_centroids` are now `SELECT`-only (RLS does not cover `TRUNCATE`). Added a per-device rate
  limit to `submit_resource_vote`, which bypassed both edge-function limiters. The `sync` function's
  anon-key check now fails closed, and the Anthropic call is bounded at 25s.
- **Out-of-order search responses** in Discover, Map, and `useResourceSearch` — a fast category
  switch or double ZIP edit could let an older response overwrite a newer one.
- **Accessibility:** form fields in onboarding and profile were announced as unlabeled by screen
  readers (`TextField` label was a sibling, not the input's `accessibilityLabel`); explicit labels
  added to the view toggle, chips, checklist rows, and Discover's back control.
- Onboarding read a ref during render to position the progress bar; now state.
- Onboarding "Create account" now handles a save failure gracefully (was an unhandled rejection that
  stranded the user on a spinning button).
- Accessibility: `Chip` touch target raised to 44pt; the bottom-sheet backdrop no longer announces a
  duplicate "Close" to screen readers.

### Removed

- Dead CI scaffolding and duplicated ingestion env-loader helpers.
