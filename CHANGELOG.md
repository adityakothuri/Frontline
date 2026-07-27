# Changelog

All notable changes to Frontline will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project aims to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version ladder (planned): `0.1.0` first MVP demo · `0.2.0` backend integration ·
`0.3.0` real AI/video prototype · `1.0.0` public-ready MVP.

## [Unreleased]

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
  ingestion pipeline (`ingestion/`) pulling ~130k+ real resources from VA Facilities, GI Bill,
  USAJOBS, HUD, SSVF, VSO reps, Feeding America, and a curated list, refreshed on a GitHub Actions
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
- Rewrote `README` and refreshed `CLAUDE.md` / `CONTRIBUTING` / `SECURITY` to describe the real,
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
