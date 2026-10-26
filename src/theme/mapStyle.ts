/**
 * The map's own palette: muted cartography so the category pins are the only
 * colour worth tapping. iOS (MapKit) ignores custom styles and uses
 * `mutedStandard`; Android (Google Maps) gets the JSON below, which is inert
 * until the release build has a Google Maps API key.
 */
import { colors } from './colors';

/**
 * The edge of every paper surface floating over the map. Paper is ~1:1 against
 * the tiles, so the border is the boundary; ink clears WCAG 1.4.11's 3:1 where
 * `colors.border` does not.
 */
export const MAP_CHROME_EDGE = colors.textPrimary;

/**
 * The paper for chrome floating over the map. Less yellow than `colors.surface`
 * (#F6F4EE), whose warm cast reads as stained against MapKit's near-neutral
 * land; slightly lighter, so text contrast measured on `colors.surface` holds.
 */
export const MAP_PAPER = '#FAF9F6';

// Shades between paper and border, for map features that must sit between them.
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

  // Roads keep their hierarchy, drawn in paper and its edge.
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
