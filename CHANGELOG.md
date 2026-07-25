# Changelog

All notable changes to Frontline will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project aims to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version ladder (planned): `0.1.0` first MVP demo · `0.2.0` backend integration ·
`0.3.0` real AI/video prototype · `1.0.0` public-ready MVP.

## [Unreleased]

### Added

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

- Rewrote `README` and refreshed `CLAUDE.md` / `CONTRIBUTING` / `SECURITY` to describe the real,
  shipped architecture (previously described a simulated/unbuilt MVP).
- Hardened the Edge Functions: rate-limit on the trusted `x-forwarded-for` hop, caller payload size
  caps (→ 413), and `Allow: POST` on 405. Tightened `config.toml` auth defaults.
- CI runs typecheck + lint + tests on Node 22 with dependency caching.

### Fixed

- Onboarding "Create account" now handles a save failure gracefully (was an unhandled rejection that
  stranded the user on a spinning button).
- Accessibility: `Chip` touch target raised to 44pt; the bottom-sheet backdrop no longer announces a
  duplicate "Close" to screen readers.

### Removed

- Dead CI scaffolding and duplicated ingestion env-loader helpers.
