---
tags: [build-log, map, location, expo-location]
date: 2026-07-08
status: done
---

# 2026-07-08 — Map location: GPS + ZIP fallback, "you are here" + recenter

## What was built

Made the existing map **location-aware**. It already rendered the LA seed pins (Apple Maps); this
adds the veteran's real location: a blue "you are here" dot when permitted and a **recenter-on-me**
control that resolves **device GPS with a ZIP fallback**. Per the user's choice, the resource
catalog/pins/distances **stay anchored in LA** (the demo data lives there, so the map is always
populated) — location is overlay + camera only. Architect-reviewed, Context7-verified. See
[[Map and Search Design]] · [[Decision Log]].

### New dependency + native
- `expo-location@~19.0.8` (via `npx expo install`). Added the **config plugin** to `app.json`
  (`locationWhenInUsePermission`), which writes `NSLocationWhenInUseUsageDescription`. Ran
  `npx expo prebuild` + `npx expo run:ios` — **native rebuild** (Info.plist + `ExpoLocation` pod
  linked). Verified the permission string is in `ios/Frontline/Info.plist` and `ExpoLocation (19.0.8)`
  is in `Podfile.lock`.

### New location seam — `src/services/location/`
- `userLocation.ts` — thin expo-location wrappers (the mockable device seam):
  `getCurrentCoordinates()` (foreground permission → last-known/`Balanced` fix, returns
  `{ granted, coords }`) and `geocodeZip(zip)` (`geocodeAsync("<zip>, USA")` → `Coordinates | null`).
- `useUserLocation(zip)` — session hook with a `LocationStatus` machine
  (`idle`/`locating`/`granted`/`denied`/`unavailable`) and a `locate()` that orchestrates
  **GPS → ZIP fallback**, returning the target `Coordinates | null`. Never persisted.
- `index.ts` — barrel. `@/lib/geo` stayed **pure** (geocoding is a platform call, not math).

### Map wiring — `src/features/resources/ResourceMap.tsx`
- `showsUserLocation={status === 'granted'}` (gated so the OS prompt fires only from our request,
  never silently on map mount).
- A floating **recenter** button (bottom-right, 48pt, spinner while `locating`) → `locate()` →
  `mapRef.animateToRegion({ ...target, latitudeDelta/longitudeDelta: 0.06 }, 350)`. GPS coords, or the
  geocoded ZIP when GPS is denied/unavailable; a gentle inline hint when neither resolves. Hidden
  while a resource preview is open. **Pins, `fitToPins`, distances unchanged** (LA-anchored).

## Privacy
Permission is requested **only on the recenter tap** (not on map open); precise location is
**never stored**; the ZIP fallback works without granting GPS. Consistent with Privacy-by-default.

## Checks
- `npm run verify` (typecheck + lint) — **passes clean**.
- Native build — **Build Succeeded**, `ExpoLocation` pod linked, app **launches healthy** (no crash
  from the native import); Home renders. (One benign RN-Maps privacy-pod deployment-version warning.)
- ⚠️ **Interactive location flow not automatable here** (no sim tap tooling) — the recenter/permission
  paths need a human pass (see risks).

## Risks / follow-ups
- On-device/simulator: open Results → **Map** → tap **recenter**. **Grant** → blue dot + camera moves
  to you; **deny** with a ZIP set → recenter falls back to the ZIP; **no ZIP** → the inline hint. The
  **iOS Simulator has no GPS** unless you set Features → Location → Apple/Custom, so test the blue dot
  there or on a physical device.
- Distances on cards remain **LA-relative** (data stays in LA by design) — expected for the demo.
- `ios/` native diff (Info.plist, Podfile.lock, Pods) should be reviewed before committing.
- `ui-reviewer` (recenter button contrast/safe-area/tap target) + `qa-tester` (grant/deny/no-ZIP)
  still to run once the account session limit resets.

## Related
[[Map and Search Design]] · [[app_walkthrough]] · [[Decision Log]] · [[Frontline Command Center]] ·
[[2026-07-08 Home Redesign Discover Tab Fullscreen Map]]
