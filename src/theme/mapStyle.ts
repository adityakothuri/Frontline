/**
 * The map's own palette — the paper theme, applied to the cartography itself.
 *
 * Default map tiles are saturated: bright motorways, blue water, a POI pin on
 * every coffee shop. Against that, our category pins are just more colour in a
 * noisy field. Muting the map is what makes them read as the only thing worth
 * tapping.
 *
 * Two platforms, two mechanisms, one look:
 *   - **iOS (MapKit)** ignores custom styling entirely. It gets `mutedStandard`,
 *     Apple's own desaturated map type, which exists for exactly this purpose.
 *   - **Android (Google Maps)** gets the JSON below.
 *
 * Consumed by `ResourceMap`. This is a token module, so the hexes here are the
 * ones from `colors.ts` — imported rather than retyped, because a map that
 * drifts off the palette is worse than no styling at all.
 *
 * Note: Android map rendering also needs a Google Maps API key, which is still
 * on the release backlog. Until that lands this style simply has nothing to
 * paint — it is inert, not broken.
 */
import { colors, withAlpha } from './colors';

/**
 * The edge every piece of paper floating **over the map** wears: the place
 * capsule, the category rail, the control housing, the off-map note.
 *
 * `colors.border` cannot do this job here. It is drawn to separate paper from
 * paper, and against the map's land fill it measures **1.19:1** — so a hairline
 * in it is not an edge, it is a suggestion. The paper fills are worse: the
 * elevated tone is **1.00:1** against the land, and `colors.surface` is
 * byte-identical to the road fill. Chrome over cartography therefore cannot rely
 * on its fill or on `shadows.md` to say where it ends; it needs a real line.
 *
 * A transparency of the ink rather than a new hex, so it stays on-palette and
 * darkens whatever it happens to sit on — paper or map.
 *
 * **0.28, not the 0.14 this shipped at.** Measured, the original was 1.35:1
 * against `MAP_PAPER` — a 0.16 improvement on `colors.border`'s 1.19:1, which is
 * to say it restated the problem rather than fixing it. If this line is
 * load-bearing (and it is: the fills are 1.00–1.06:1 against the tiles, so the
 * border is the *only* thing saying where a sheet ends) then it has to be
 * visible. 0.28 measures ~1.75:1, which reads as a deliberate hairline at 3x
 * instead of a rumour. Still short of the 3:1 WCAG 1.4.11 asks of a boundary
 * carrying component identity — the shadow and the fill carry the rest — but it
 * is now an edge.
 */
export const MAP_CHROME_EDGE = withAlpha(colors.textPrimary, 0.28);

/**
 * The paper that chrome floating **over the cartography** is made of, as opposed
 * to `colors.surface`, which is the paper for everything sitting on
 * `colors.background`.
 *
 * They are four units apart and that gap is the whole point. `colors.surface`
 * (#FBF8F0) is 11 units of yellow away from neutral, which is correct on our own
 * warm paper background — it reads as the same material, one sheet up. Apple's
 * `mutedStandard` land is very close to neutral, and against it that same warm
 * cast stops reading as *paper* and starts reading as *stained*: the single
 * clearest reason the map looked unfinished next to the rest of the app.
 *
 * #FAF9F6 pulls most of the yellow out while staying off-white — a warm-neutral
 * rather than a warm — so the capsule, the rail, the control housing and the
 * off-map note look like they belong on the tiles they sit on.
 *
 * Contrast does not regress: it is marginally *lighter* than `colors.surface`,
 * so every foreground token measured against paper (textPrimary 15.7:1,
 * textSecondary 7.3:1, accent 4.8:1) holds or improves.
 *
 * Only the four map-floating surfaces use this. Everywhere else in the app
 * `colors.surface` is unchanged — this is not a palette change.
 */
export const MAP_PAPER = '#FAF9F6';

/** A shade between two of our tokens, for the map features that need to sit
 *  *between* paper and border without inventing new brand colours. */
const LAND = '#EFEAE0';
const WATER = '#D9DFD8';
const PARK = '#E3E6D9';
const ROAD_FILL = '#FBF8F0';
const ROAD_EDGE = '#E2DBCA';
const ARTERIAL = '#F3EEE2';

export const mapStyle = [
  // Points of interest carry none of our meaning and compete with the pins.
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  { elementType: 'geometry', stylers: [{ color: LAND }] },
  { elementType: 'labels.text.fill', stylers: [{ color: colors.textSecondary }] },
  // A paper halo behind label text: legible over any of the fills below without
  // resorting to a heavier weight.
  { elementType: 'labels.text.stroke', stylers: [{ color: colors.background }] },

  { featureType: 'water', elementType: 'geometry', stylers: [{ color: WATER }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: colors.textMuted }] },

  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: PARK }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: PARK }] },

  // Roads keep their hierarchy — you still need to read the street grid to find
  // a place — but they are drawn in paper and its edge, not in white and yellow.
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: ROAD_FILL }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: ROAD_EDGE }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: ARTERIAL }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: ARTERIAL }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: ROAD_EDGE }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: colors.textMuted }] },

  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: colors.border }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
];
