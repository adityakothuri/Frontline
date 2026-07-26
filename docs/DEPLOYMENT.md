# Frontline — iOS Deployment Runbook (TestFlight → App Store)

Ship Frontline to **iOS** via **EAS** (Expo Application Services). The Supabase backend (DB, RLS, Edge
Functions) is already live; this covers the iOS binary + TestFlight + App Store. iOS uses **Apple Maps**,
so no Google Maps key is needed.

---

## ✅ Already done for you (in the repo, on `main`)

- **App code** merged to `main` — features, per-category UI, tests (`npm test`) and `npm run verify` green.
- **`app.json`** set for release: `version` `1.0.0`, iOS-only (`supportsTablet: false`), bundle id
  `com.frontline.app`, and `ITSAppUsesNonExemptEncryption: false` (skips the export-compliance prompt on
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

## Your remaining steps (need YOUR accounts — I can't do these)

### 1. Accounts (start now; Apple takes ~1–2 days to activate)
- [ ] **Apple Developer Program** — developer.apple.com, $99/yr.
- [ ] **Expo account** — expo.dev (free); this owns the EAS builds.
- [ ] Install the CLI + log in:
  ```bash
  npm i -g eas-cli
  eas login
  ```

### 2. Link the EAS project (writes `projectId` into app.json — the one config step that needs your login)
```bash
eas init
```
> If you want a bundle id other than `com.frontline.app` (it must be unique + one you'll own long-term),
> change `ios.bundleIdentifier` in `app.json` **before** the first build — it's permanent once published.

### 3. First internal build → test on a real iPhone
```bash
eas build --platform ios --profile preview
```
EAS will offer to **create the Apple app record and manage signing certificates** — say yes. Install the
build from the link on your iPhone and **walk the full loop over cellular**: onboarding → Discover →
results → map → open a resource (AI summary/plan/call script load) → save. Fix anything, rebuild.

### 4. Host the privacy policy
Publish [`docs/PRIVACY.md`](PRIVACY.md) at a stable URL (GitHub Pages or your domain), add a support
email in it, and keep the URL for step 6.

### 5. Production build
```bash
eas build --platform ios --profile production
```

### 6. App Store Connect + TestFlight
- In **appstoreconnect.apple.com**, the app record exists (from step 3) — fill: name/subtitle/description/
  keywords, **privacy policy URL** (step 4), the **App Privacy** questionnaire (declare: optional coarse
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
- **Crash reporting:** `npx expo install @sentry/react-native`, add your DSN, and report from
  `AppErrorBoundary.componentDidCatch` — so you see field crashes, not just local ones.
- **OTA updates:** `npx expo install expo-updates`, then `eas update --branch production -m "fix"` pushes
  JS-only fixes without a new store review. (Native/dependency changes still need a rebuild.)

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
[PRIVACY.md](PRIVACY.md) · [SECURITY.md](../SECURITY.md) · [BACKEND_SETUP.md](../BACKEND_SETUP.md) ·
[docs/github/Release Process.md](github/Release%20Process.md)
