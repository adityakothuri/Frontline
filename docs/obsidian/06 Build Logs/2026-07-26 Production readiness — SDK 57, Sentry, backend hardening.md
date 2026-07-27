---
tags: [build-log, release, security, audit]
date: 2026-07-26
branch: chore/production-readiness-sdk57
---

# 2026-07-26 — Production readiness: SDK 57, Sentry, backend hardening

Full production-readiness audit ahead of App Store submission, then remediation. Three parallel
audits (app source · backend + data · release/CI) run against the repo **and the live Supabase
project**, so findings are verified rather than inferred.

## Decisions taken

- **iOS-only for 1.0** → the Android Google Maps API key finding is explicitly out of scope. The
  Android map renders blank without one, so this must be revisited before any Android build.
- **Add Sentry** (new dependency, approved under the File Creation Policy).
- **Upgrade to Expo SDK 57 first**, since everything else builds on that native config.
- Support/security contact: `adityakothuri3@gmail.com`. Bundle id stays `com.frontline.app`.

## What the audit found

The codebase came out **genuinely clean**: 112 files / ~8,950 LOC, zero `TODO`/`FIXME`, zero `any`,
zero `@ts-ignore`, one intentional `console.error`, no mock data in production paths, no secrets
ever committed (verified across full git history), RLS on all 9 tables, loading/empty/error states
on every data-backed screen. The ~130k resource claim is **real** — 131,642 rows, matched 1:1
against `resource_sources`. The "not the VA" / "AI-generated — verify" disclaimers and 988 crisis
routing are actually implemented, not just documented.

**What blocked shipping was release engineering and operations, not code rot.**

## Work done

### Expo SDK 54 → 57 (staged 54→55→56→57)
Breaking changes found and fixed, one hop at a time:
- **RN 0.85** removed `StyleSheet.absoluteFillObject` (`absoluteFill` is now the plain spreadable
  object).
- **react-native-maps** renamed `showsPointsOfInterest` → `showsPointsOfInterests`.
- **SDK 56's `eslint-config-expo`** enables the React Compiler hook rules, which surfaced 81 errors
  across three real classes — see below.

`npm audit --omit=dev`: **34 → 12** advisories, all build-time Expo/Metro/CLI tooling, none shipped
in the bundle. AsyncStorage stays at 2.2.0 (what SDK 57 pins), so the feared 3.x data-migration risk
never applied.

> **Gotcha for next time:** `npm install expo@^N` leaves `@expo/cli` in a mixed state and
> `expo install --fix` dies with `Cannot find module './utils/autoAddConfigPlugins.js'`. A
> `rm -rf node_modules && npm install` after each major bump is the reliable fix.

### React Compiler findings (real, not noise)
- **69 × `react-hooks/refs`** — `useRef(new Animated.Value(x)).current` allocates a throwaway
  `Animated.Value` on *every* render and reads a ref during render. 12 sites → lazy `useState`.
- **`onboarding.tsx`** read `prevStepRef.current` during render to position the progress bar. Now
  state, batched with `setStep` in the same handler.
- **2 × `preserve-manual-memoization`** — cleared by folding the Discover/Map fetches into their
  effects, which also fixed the race below.
- **`react-hooks/set-state-in-effect` is disabled** in `eslint.config.js` with a written rationale:
  in this codebase it fires *only* on async-fetch loading transitions, never on derived-state
  cascades. Revisit if a real query layer lands.

### Crash reporting, iOS config, app fixes
See [[app_walkthrough]] "Production-readiness pass" for the monitoring service and AI cache.
Also: suppressed the `expo-location` plugin's unused "Always" + motion usage strings (it injects
generic template copy by default), added an `ios.privacyManifests` block, and regenerated the stale
local `ios/` prebuild — it was pinned at version `0.0.1` build `1` with `TARGETED_DEVICE_FAMILY
"1,2"` while `app.json` said `1.0.0` / iPhone-only.

### Backend hardening (migration 0022 — applied to production)
- Tables added from 0004 onward relied on RLS alone while Postgres schema defaults still left
  `anon`/`authenticated` holding INSERT/UPDATE/DELETE/**TRUNCATE**. Revoked on all seven.
- `resources_needing_review` was anon-readable despite 0003's comment claiming otherwise.
- **`resources` / `zip_centroids` kept TRUNCATE** — and **RLS does not apply to TRUNCATE**, so the
  read-only policy would not have stopped one. Not reachable (PostgREST has no TRUNCATE verb), but a
  grant that only a missing feature makes safe is not a control. Both are now SELECT-only.
- **`submit_resource_vote`** is SECURITY DEFINER + anon-callable, so it bypassed *both*
  edge-function rate limiters. Added a per-device hourly cap. **Residual, documented:** a caller
  minting fresh UUIDs still gets a fresh bucket; closing that means moving votes behind an edge
  function, deliberately not attempted pre-release.
- **`sync`** gated on `expectedKey && …`, so an empty `SUPABASE_ANON_KEY` would skip the check
  entirely and open the endpoint. Now fails closed.
- **Anthropic call** had no timeout at the function layer — one 25s attempt, no retries (Opus with
  adaptive thinking runs long; a retry would overshoot the client's 30s abort).

## Verification

`npm run verify` + **39 tests** green · `expo-doctor` 20/20 · `expo install --check` clean.

Live checks after the migration + redeploys:
- anon grant surface is now exactly `SELECT` on `resources` / `zip_centroids`, nothing else
- anon denied a direct read of `resource_votes` while the vote RPC still works (test row cleaned up)
- `search_resources('90015', 25mi, [healthcare, housing])` → 270 rows
- `ai` / `sync` smoke: 401 / 405 / 400 / 200 as expected
- **real Haiku inference: HTTP 200 in 3.4s**, valid hedged `BenefitSummary` whose verification note
  correctly flagged an unverified directory source
- security + performance advisors: no new findings

## Risks / not done

- **Not run on a device or simulator this session.** The SDK 57 jump is three majors of native
  change — an EAS `preview` build and the manual pass in the plan's verification section should be
  walked before submitting. Highest-value checks: saved-items persistence across a relaunch, the map
  under `react-native-maps` 1.27, and a forced crash reaching Sentry.
- **Marker load test not done** — the Map tab can render ~330 markers in a dense metro with no
  `React.memo` anywhere. Profile 90015 / 10001 on a real device; only memoize if it actually janks.
- **Test coverage is still thin** — 6 files, pure logic only. Nothing covers the service transport,
  the three contexts, sync/backup, or any ingestion adapter.
- **`src/data/officialSources.ts`** — 382 lines of hand-curated URLs with no link-rot check. It will
  go stale silently; needs an owner or an automated check.
- **Prompt injection** remains a soft boundary (system-prompt instruction + structured output).
  Fine while resource text is curated/official; revisit if it ever becomes user-submitted. Feed
  America descriptions already flow through unmoderated.
- **The Anthropic console spend cap is the only non-fail-open cost control and cannot be verified
  from the repo.** Both in-app guards fail open by design.

## Next step

Work the "Pre-submission checklist" in the [[Frontline Command Center]] — all out-of-repo: host the
privacy policy, confirm the spend cap, create the Sentry project + EAS secrets, ASC listing.
