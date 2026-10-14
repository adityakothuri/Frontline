import * as Haptics from 'expo-haptics';

/**
 * Tap feedback for the map's direct-manipulation controls.
 *
 * Why this is a wrapper and not three `expo-haptics` calls at the call sites:
 * the package is declared in `package.json` but its pod is **not in the current
 * `ios/Podfile.lock`** — `ios/` is gitignored and was last prebuilt before
 * `expo-haptics` was added.
 *
 * On that binary the JS module resolves fine (it is in `node_modules`). What
 * fails is one step later: `expo-haptics` loads its native side through
 * `requireOptionalNativeModule`, which returns `null` rather than throwing, and
 * each call then comes back as a **rejected promise** carrying an
 * `UnavailabilityError`. So the guard below has to catch a rejection, not just a
 * throw — a bare `try/catch` around the call would let it through as an unhandled
 * rejection. A red screen on tapping a map pin is a far worse outcome than no
 * vibration, so the feature simply does not exist until someone runs:
 *
 *     npx expo prebuild -p ios && cd ios && pod install
 *
 * Nothing else in the app needs that rebuild.
 *
 * Fire-and-forget on purpose. These return promises, but a haptic that lands a
 * frame late is worthless and a haptic that rejects must never surface — so
 * nothing here is awaited and nothing here can throw.
 */

/** Set once, on the first failure, so a missing native module costs one throw
 *  rather than one per tap on a screen where taps are the whole interaction. */
let unavailable = false;

function fire(run: () => Promise<void>): void {
  if (unavailable) return;
  try {
    run().catch(() => {
      unavailable = true;
    });
  } catch {
    unavailable = true;
  }
}

/**
 * A selection tick: the lightest feedback iOS has. For choosing something from a
 * set — tapping a pin, toggling a category chip.
 */
export function tapSelection(): void {
  fire(() => Haptics.selectionAsync());
}

/**
 * A light impact: something arrived somewhere. For the sheet landing on a
 * detent, where the finger is still on the glass and the surface has just
 * stopped moving under it.
 */
export function tapImpact(): void {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
