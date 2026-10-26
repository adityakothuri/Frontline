# Running Frontline

How to run the Frontline app locally. Frontline is a **React Native + Expo (SDK 57, TypeScript)**
app for **iOS and Android**; there is no web build. It runs as a **development build**
(`expo-dev-client`), not in Expo Go, and it always talks to a live Supabase backend for resources
and AI.

> New here? Read the [README](../README.md) first.

---

## 1. Prerequisites

- **Node.js 22 or later** (`node -v`) and **npm**. Use npm only; don't mix in yarn, pnpm, or bun.
- **iOS (primary target, macOS):** full **Xcode** (not just the Command Line Tools) with an iOS
  Simulator runtime, and **CocoaPods**. The macOS system Ruby (2.6) is too old for current
  CocoaPods, so install it with Homebrew: `brew install cocoapods`.
- **Android:** Android Studio with an emulator. The map needs a Google Maps API key on Android,
  which isn't configured yet, so map tiles render blank there.

## 2. Install and configure

```bash
npm install
cp .env.example .env
```

Fill in the two **required** values in `.env`:

| Variable | What it is |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | The Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | The publishable/anon key. It is safe in the client because RLS makes it read-only |

`EXPO_PUBLIC_SENTRY_DSN` is optional. If you leave it blank, crash reporting is off. There is
**no mock or offline mode**: without the Supabase values, resource and AI calls show the
error/retry state. Expo inlines `EXPO_PUBLIC_*` at bundle time, so restart Metro with `-c` after
you edit `.env`.

## 3. Build the dev client (first time, and after native changes)

```bash
npm run ios          # expo run:ios: prebuilds ios/, runs pod install, compiles, boots the Simulator
npm run android      # expo run:android
```

To build from Xcode instead, run `npx expo prebuild -p ios`, open `ios/Frontline.xcworkspace`, and
press Run. The first compile takes several minutes. You only need to rebuild when native
dependencies or `app.json` change.

## 4. Day-to-day: start Metro

```bash
npx expo start --dev-client      # or: npm start
```

Press `i` / `a` to open the installed dev build, `r` to reload, `m` for the dev menu. Metro keeps
its cache in `.expo/metro-cache` (see `metro.config.js`), so restarts are fast. Install Watchman
(`brew install watchman`) for reliable file watching.

## 5. What you should see

A short shield intro, then onboarding on first launch (optional first name, ZIP, role, documents
on hand), then the tab shell: **Home**, **Discover**, **Map**, **Saved**, **Profile**. Search
results come from the live database. Opening a resource generates a Claude summary and next-step
plan through the `ai` Edge Function. **Ask Frontline** opens from the Home start card. On iOS the
map uses Apple Maps, so no key is needed.

## 6. Quality checks

```bash
npm run verify       # typecheck + lint + format:check + test (what CI runs)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run
npm run format       # prettier --write
npx expo-doctor      # Expo project sanity check
```

## 7. Troubleshooting

- **Stale bundle or odd Metro errors:** `npx expo start --dev-client -c`.
- **"Unable to resolve module" after a pull:** run `npm install` again, and rebuild the dev client
  if a native dependency changed.
- **`pod install` fails on Ruby gems:** you are on system Ruby. Use Homebrew CocoaPods (§1).
- **Simulator won't boot or Xcode reports "No space left on device":** free disk space. Builds
  and simulators need several GB.
- **Every resource or AI block shows "Something went wrong":** check the two `.env` values and
  confirm the Supabase project isn't paused (a paused project's host stops resolving).
- **Typed-route errors in the editor:** they are generated on the first `expo start` into the
  git-ignored `.expo/types`. `npm run typecheck` passes without them.

## 8. Where the code lives

Routes are in `app/`, shared UI in `src/components/`, feature UI in `src/features/`, data and AI
clients in `src/services/`, and design tokens in `src/theme/`. The backend (migrations and Edge
Functions) is in `supabase/`, and the data pipeline is in `ingestion/`.
