import type { MapStyleElement } from 'react-native-maps';
import { colors } from './colors';

// Dark, navy-tinted Google Maps style so the map recedes and alert markers pop.
// Built from the app's color tokens (no stray hex). This affects Google/Android
// only — on iOS, Apple Maps follows the app's `userInterfaceStyle="dark"`.
export const darkMapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: colors.backgroundElevated }] },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: colors.textSecondary }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: colors.background }],
  },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: colors.surfaceMuted }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: colors.textMuted }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: colors.border }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: colors.background }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: colors.backgroundElevated }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: colors.border }],
  },
];
