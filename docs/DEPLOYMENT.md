# Frontline — iOS Deployment Runbook (TestFlight → App Store)

Ship Frontline to **iOS** via **EAS** (Expo Application Services). The Supabase backend (DB, RLS, Edge
Functions) is already live; this covers the iOS binary + TestFlight + App Store. iOS uses **Apple Maps**,
so no Google Maps key is needed.

---

## ✅ Already done for you (in the repo, on `main`)

- **App code** merged to `main` — features, per-category UI, tests (`npm test`) and `npm run verify` green.
- **`app.json`** set for release: `version` `1.0.0`, iOS-only (`supportsTablet: false`), bundle id
  `com.kothuri.frontline`, and `ITSAppUsesNonExemptEncryption: false` (skips the export-compliance prompt on
  every TestFlight upload). Location permission string is honest and present.
- **`eas.json`** created: `development` (simulator), `preview` (internal device build), and `production`
  (auto-incrementing build number, `appVersionSource: remote`). The **public** Supabase values
  (`EXPO_PUBLIC_SUPABASE_*`, publishable / RLS-read-only) are baked into the build env, so builds work
  with no extra env setup.
- **Production error boundary** (`src/components/AppErrorBoundary.tsx`) wraps the app — a render crash
  shows a calm "Try again" screen instead of a white screen.
- **Privacy policy** drafted at [`docs/PRIVACY.md`](PRIVACY.md) — accurate to what the app collects;
  you just host it and paste the URL.
- `package.json` version bumped to `1.0.0`.

- **Crash reporting** is installed and wired (`@sentry/react-native` + `src/services/monitoring/crashReporting.ts`,
  PII-scrubbed). It stays a **no-op until `EXPO_PUBLIC_SENTRY_DSN` is set** in the `eas.json` build
  profile — see step 2.
- **Privacy policy + Terms are LIVE** at
  <https://adikothuri3.github.io/frontline-legal/privacy.html> and
  <https://adikothuri3.github.io/frontline-legal/terms.html> (public `frontline-legal` repo, GitHub Pages).

## Your remaining steps (need YOUR accounts — I can't do these)

### 1. Accounts — ✅ DONE
- [x] **Apple Developer Program** — active.
- [x] **Expo account** — logged in as `kothuria`; the EAS project is linked (`projectId` is in `app.json`).
> The bundle id is `com.kothuri.frontline` and is **permanent once published**. It is not the
> original `com.frontline.app` — that identifier was already registered to a different Apple
> developer, which only surfaced when the first build tried to create the App ID. Bundle ids are
> globally unique across all of Apple, not just your team.

### 2. Turn on crash reporting (do this BEFORE the first build)
Create the org + project at sentry.io (platform: React Native), then:
```bash
eas secret:create --scope project --name SENTRY_ORG        --value <org-slug>
eas secret:create --scope project --name SENTRY_PROJECT    --value <project-slug>
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>
```
Then add `"EXPO_PUBLIC_SENTRY_DSN": "<dsn>"` to the `preview` **and** `production` `env` blocks in
`eas.json`. The three secrets upload source maps at build time (so stack traces are readable); the
DSN is what actually enables reporting at runtime.

### 3. First internal build → test on a real iPhone
```bash
eas build --platform ios --profile preview
```
EAS will offer to **create the Apple app record and manage signing certificates** — say yes. Install the
build from the link on your iPhone and **walk the full loop over cellular**: onboarding → Discover →
results → map → open a resource (AI summary/plan/call script load) → save → Ask Frontline. Fix anything, rebuild.

### 4. Host the privacy policy — ✅ DONE
Live at <https://adikothuri3.github.io/frontline-legal/privacy.html> (Terms at `/terms.html`), served
by GitHub Pages from the public `frontline-legal` repo. [`docs/PRIVACY.md`](PRIVACY.md) stays the
canonical source — edit it there, then mirror into the HTML.

### 4b. Set the Anthropic spend cap
In console.anthropic.com, set a hard monthly limit. The in-function guards (30 req/IP/hr for resource
tasks, a separate 20/hr chat bucket, and a $5/hr global budget) are **fail-open by design**, so this is the only real backstop against a runaway bill once public.

### 5. Production build
```bash
eas build --platform ios --profile production
```

### 6. App Store Connect + TestFlight
- In **appstoreconnect.apple.com**, the app record exists (from step 3) — fill: name/subtitle/description/
  keywords, **privacy policy URL** (`https://adikothuri3.github.io/frontline-legal/privacy.html`), a
  **support URL** (`https://adikothuri3.github.io/frontline-legal/`), the **App Privacy** questionnaire (declare: optional coarse
  location, **no tracking**, no account), age rating, and one **review note**:
  > *"Frontline is an independent resource navigator, not affiliated with the U.S. Department of Veterans
  > Affairs. AI output is general guidance, clearly labeled, never medical/legal/financial advice."*
- Submit the build to TestFlight:
  ```bash
  eas submit --platform ios --profile production --latest
  ```
- In **TestFlight**, add yourself/testers (internal testing needs no review; external testing gets a quick
  Beta App Review). Share the invite — you're testing on real devices.

### 7. Public release (when ready)
From App Store Connect, attach the build to a **1.0.0** App Store version, add **screenshots** (6.7" and
6.1" iPhone), and submit for review (typically **1–3 days**). Then tag the release:
```bash
git tag -a v1.0.0 -m "v1.0.0 — first public release" && git push --tags
```

## Optional but recommended (post-TestFlight)
- **OTA updates:** `npx expo install expo-updates`, then `eas update --branch production -m "fix"` pushes
  JS-only fixes without a new store review. (Native/dependency changes still need a rebuild.)
- **Android:** 1.0 ships iOS-only. Android needs a Google Maps API key before shipping — the map
  renders blank without one. iOS uses Apple Maps, so it needs no key.

## Command cheat-sheet
```bash
eas login
eas init                                     # link project (writes projectId)
eas build -p ios --profile preview           # internal test build
eas build -p ios --profile production        # TestFlight / App Store build
eas submit -p ios --profile production --latest
npx expo-doctor                              # config/asset sanity check
```

## Related
[PRIVACY.md](PRIVACY.md) · [SECURITY.md](../SECURITY.md) · [BACKEND_SETUP.md](../BACKEND_SETUP.md)
