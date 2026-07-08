// DEMO / MOCK data for neighborhood, human-reported alerts.
//
// The contract: typed models + getX(): Promise with a simulated delay, consumed
// via a loading/error/ready state machine. `addAlert` keeps a freshly reported
// alert in memory so it appears on the map for the rest of the session. A real
// service will later replace these behind the same shapes.
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorToken } from '@/theme';

export type AlertCategory =
  'suspicious_person' | 'suspicious_vehicle' | 'theft' | 'vandalism' | 'other';

export type AlertSeverity = 'low' | 'medium' | 'high';

export type Coordinates = { latitude: number; longitude: number };

export type Alert = {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  coordinate: Coordinates;
  createdAt: number; // epoch ms
  expiresAt: number; // epoch ms — the alert auto-clears after this
  reporterLabel: string;
  status: 'active' | 'expired';
};

// Category → label + icon. A marker's COLOUR comes from severity (below), so colour
// always reads as "how serious"; the icon says "what kind".
export const categoryMeta: Record<
  AlertCategory,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  suspicious_person: { label: 'Suspicious person', icon: 'walk-outline' },
  suspicious_vehicle: { label: 'Suspicious vehicle', icon: 'car-outline' },
  theft: { label: 'Theft', icon: 'bag-remove-outline' },
  vandalism: { label: 'Vandalism', icon: 'hammer-outline' },
  other: { label: 'Something else', icon: 'alert-circle-outline' },
};

export const orderedCategories: AlertCategory[] = [
  'suspicious_person',
  'suspicious_vehicle',
  'theft',
  'vandalism',
  'other',
];

export const severityLabel: Record<AlertSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};
export const orderedSeverities: AlertSeverity[] = ['low', 'medium', 'high'];

// Severity → semantic colour token (reuses the app's existing meaning system:
// green = minor/all-clear, orange = attention, red = serious).
export const severityColor: Record<AlertSeverity, ColorToken> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
};
export const severitySoftColor: Record<AlertSeverity, ColorToken> = {
  low: 'successSoft',
  medium: 'warningSoft',
  high: 'dangerSoft',
};

// The simulated "you are here" / map focus for the demo neighborhood.
export const MAPLE_GROVE_CENTER: Coordinates = {
  latitude: 45.0725,
  longitude: -93.4558,
};
export const MAPLE_GROVE_REGION = {
  ...MAPLE_GROVE_CENTER,
  latitudeDelta: 0.018,
  longitudeDelta: 0.018,
};

const MIN = 60_000;
const HOUR = 3_600_000;
const now = Date.now();

const seed: Alert[] = [
  {
    id: 'a1',
    category: 'suspicious_person',
    severity: 'medium',
    title: 'Person checking car door handles',
    description:
      'Someone walking down the block trying the handles on parked cars. Hood up, headed toward 5th Ave.',
    coordinate: { latitude: 45.0741, longitude: -93.457 },
    createdAt: now - 8 * MIN,
    expiresAt: now + 4 * HOUR,
    reporterLabel: 'Neighbor',
    status: 'active',
  },
  {
    id: 'a2',
    category: 'suspicious_vehicle',
    severity: 'high',
    title: 'Dark sedan circling the block',
    description:
      'A dark sedan has driven past four times in 20 minutes, slowing at each driveway. No front plate.',
    coordinate: { latitude: 45.0709, longitude: -93.4541 },
    createdAt: now - 25 * MIN,
    expiresAt: now + 3 * HOUR,
    reporterLabel: 'Neighbor',
    status: 'active',
  },
  {
    id: 'a3',
    category: 'theft',
    severity: 'high',
    title: 'Package taken from porch',
    description:
      'Delivery was left around 3pm and was gone by 3:30. Caught a glimpse of a hooded figure on a bike.',
    coordinate: { latitude: 45.0733, longitude: -93.4529 },
    createdAt: now - 62 * MIN,
    expiresAt: now + 6 * HOUR,
    reporterLabel: 'Neighbor',
    status: 'active',
  },
  {
    id: 'a4',
    category: 'suspicious_vehicle',
    severity: 'low',
    title: 'Unfamiliar van parked overnight',
    description:
      'A white cargo van has been outside on Birch Lane since last night. Probably nothing, just flagging it.',
    coordinate: { latitude: 45.0748, longitude: -93.4547 },
    createdAt: now - 42 * MIN,
    expiresAt: now + 8 * HOUR,
    reporterLabel: 'Neighbor',
    status: 'active',
  },
  {
    id: 'a5',
    category: 'vandalism',
    severity: 'medium',
    title: 'Graffiti on the cluster mailbox',
    description:
      'Fresh spray paint on the community mailbox at Maple & 5th sometime last night.',
    coordinate: { latitude: 45.0717, longitude: -93.4573 },
    createdAt: now - 2 * HOUR,
    expiresAt: now + 10 * HOUR,
    reporterLabel: 'Neighbor',
    status: 'active',
  },
  {
    id: 'a6',
    category: 'suspicious_person',
    severity: 'low',
    title: 'Someone photographing houses',
    description:
      'A person slowly taking photos of homes along Cedar Court. Left in a grey hatchback.',
    coordinate: { latitude: 45.07, longitude: -93.4562 },
    createdAt: now - 2 * HOUR,
    expiresAt: now + 5 * HOUR,
    reporterLabel: 'Neighbor',
    status: 'active',
  },
  {
    id: 'a7',
    category: 'theft',
    severity: 'medium',
    title: 'Bike taken from open garage',
    description:
      'Left the garage open overnight — blue mountain bike is gone this morning.',
    coordinate: { latitude: 45.0729, longitude: -93.4588 },
    createdAt: now - 3 * HOUR,
    expiresAt: now + 7 * HOUR,
    reporterLabel: 'Neighbor',
    status: 'active',
  },
  {
    id: 'a8',
    category: 'other',
    severity: 'low',
    title: 'Loud argument near the park',
    description:
      'Raised voices by the park entrance on Oak St. Seemed to be settling down.',
    coordinate: { latitude: 45.0752, longitude: -93.4531 },
    createdAt: now - 3.5 * HOUR,
    expiresAt: now + 2 * HOUR,
    reporterLabel: 'Neighbor',
    status: 'active',
  },
];

let alerts: Alert[] = seed;

export function getNearbyAlerts(): Promise<Alert[]> {
  return new Promise((resolve) => {
    setTimeout(
      () => resolve(alerts.filter((a) => a.expiresAt > Date.now())),
      600,
    );
  });
}

export function getAlertById(id: string): Promise<Alert | null> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(alerts.find((a) => a.id === id) ?? null), 400);
  });
}

export type NewAlertInput = {
  category: AlertCategory;
  severity: AlertSeverity;
  description: string;
  coordinate: Coordinates;
  ttlHours: number;
};

// Creates an alert in memory (the reporter is "You") so it appears on the map this
// session. Title is derived from the category to keep the report form to one text field.
export function addAlert(input: NewAlertInput): Promise<Alert> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const ts = Date.now();
      const alert: Alert = {
        id: `a-${ts}`,
        category: input.category,
        severity: input.severity,
        title: categoryMeta[input.category].label,
        description: input.description.trim(),
        coordinate: input.coordinate,
        createdAt: ts,
        expiresAt: ts + input.ttlHours * HOUR,
        reporterLabel: 'You',
        status: 'active',
      };
      alerts = [alert, ...alerts];
      resolve(alert);
    }, 500);
  });
}

export function formatRelativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs;
  if (diff < MIN) return 'just now';
  const mins = Math.floor(diff / MIN);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatTimeUntil(epochMs: number): string {
  const diff = epochMs - Date.now();
  if (diff <= 0) return 'expired';
  const mins = Math.floor(diff / MIN);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs} hr`;
  const days = Math.floor(hrs / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

// Haversine distance from the simulated "you" (Maple Grove center) → "0.3 mi away".
export function formatDistance(
  to: Coordinates,
  from: Coordinates = MAPLE_GROVE_CENTER,
): string {
  const R = 3958.8; // miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) ** 2;
  const miles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  if (miles < 0.1) return 'nearby';
  return `${miles.toFixed(1)} mi away`;
}
