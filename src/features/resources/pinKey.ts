import type { ResourceSearchResult } from '@/services/resources';

/**
 * The React `key` for a map marker.
 *
 * This is one line of code guarding a real bug, so it lives in its own module
 * with its own test rather than inline at the call site.
 *
 * `react-native-maps` freezes a marker's rasterized bitmap once
 * `tracksViewChanges` goes false, and MapKit then *recycles* annotation views as
 * pins leave and re-enter the viewport. If two pins that should look different
 * can share a key, a recycled view comes back wearing the wrong frozen bitmap —
 * which is how every pin on the map once ended up drawing the food icon (food
 * being the densest category, its bitmap was the one in circulation). See
 * `docs/obsidian/07 Bugs/2026-07-28 Map pins all draw the food icon.md`.
 *
 * So: **every appearance input that could differ between two pins sharing an id
 * must appear here.** Today that is the category, which picks both the hue and
 * the glyph, and the tier, which decides whether the marker is a teardrop with a
 * glyph or a bare dot. A refactor to `${id}` alone would look harmless, keep
 * every other test green, and silently bring the bug back — which is exactly
 * what `pinKey.test.ts` exists to stop.
 *
 * The tier is here and `selected` is not, and the difference is worth stating:
 * the tier changes for *every pin at once* when the camera crosses a zoom
 * threshold, so without it in the key the whole field would keep its old frozen
 * bitmaps — a map of teardrops that should have become dots. `selected` changes
 * for one pin whose id already makes its key unique.
 *
 * ## Pass the **field** tier — the camera's — and never the drawn one
 *
 * This is the load-bearing rule of the whole file, and getting it backwards
 * crashed the app on every tap from any zoomed-out view.
 *
 * An open pin draws as a teardrop at any zoom, so its *drawn* tier is always
 * `pin`. Key it that way and tapping a **dot** flips its key `…:dot` → `…:pin`,
 * which unmounts and remounts that marker from inside that marker's own press
 * handler, while `react-native-maps` is still dispatching the event into the
 * native annotation view being torn down underneath it. Red screen, every time,
 * and only when zoomed out — which is what made it look like a zoom bug rather
 * than a key bug. See [[2026-07-31 The sheet comes off and the pins learn to open]].
 *
 * So nothing a *tap* changes may appear here. The tier passed in is whatever the
 * camera earned for the whole field, and `CategoryPin` derives what it actually
 * draws from that plus its own `selected` prop — see `drawTier` there. Selection
 * is then structurally incapable of changing a marker's identity, and the
 * re-raster an open pin needs comes from `useRasterWindow` re-arming on
 * `selected`, which needs no remount.
 *
 * (A third `selected` argument once gave open pins their own tier-independent
 * token, for the same reason and with the same cost. It is not coming back.)
 */
export function pinKey(result: ResourceSearchResult, fieldTier: PinTier): string {
  return `${result.resource.id}:${result.resource.category}:${fieldTier}`;
}

/**
 * How much pin the current zoom level deserves.
 *
 * `dot` is a bare category disc, `pin` the full teardrop with its glyph. This is
 * a size decision, **not** clustering: at both tiers every located result still
 * gets its own marker on its own coordinate, and every one of them is still
 * tappable. Nothing is merged, capped or hidden — that was removed deliberately
 * on 2026-07-30 and is not coming back through this door.
 *
 * It lives here rather than in `MapPin.tsx` for a mechanical reason: this module
 * is imported by `pinKey.test.ts`, which vitest runs in a plain node
 * environment, and `MapPin.tsx` pulls in `react-native-svg`, which cannot load
 * there. The type has to be reachable from the test.
 */
export type PinTier = 'dot' | 'pin';
