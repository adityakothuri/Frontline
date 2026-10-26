import type { Ionicons } from '@expo/vector-icons';

/** The structured "need": the query behind resource discovery and every AI output. */

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * The 10 user-facing need categories. `va_benefits` covers disability claims and
 * VA benefits generally, since both map to the same `benefits_help` resources.
 */
export type NeedCategory =
  | 'essentials'
  | 'housing'
  | 'healthcare'
  | 'va_benefits'
  | 'education_benefits'
  | 'jobs'
  | 'legal'
  | 'transportation'
  | 'family_caregiver'
  | 'emergency';

/** How soon the veteran needs help — affects sorting and "open now" emphasis. */
export type Urgency = 'today' | 'this_week' | 'info';

/** Whether the veteran wants in-person help, online help, or either. */
export type Modality = 'in_person' | 'online' | 'either';

/** What kind of help the veteran wants for this need. */
export type HelpType = 'call' | 'visit' | 'apply' | 'understand';

/** Documents a veteran may already have on hand (checklist, never uploads). */
export type VeteranDocument =
  'veteran_id' | 'va_card' | 'dd214' | 'photo_id' | 'proof_of_address' | 'proof_of_income';

export interface NeedLocation {
  /** ZIP code entry (privacy-first — works without device location). */
  zip?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles: number;
}

export interface Need {
  category: NeedCategory;
  urgency: Urgency;
  modality: Modality;
  helpType: HelpType;
  documentsOnHand: VeteranDocument[];
  location: NeedLocation;
}

export interface NeedCategoryMeta {
  label: string;
  /** For narrow surfaces, only where the full label doesn't fit: `shortLabel ?? label`. */
  shortLabel?: string;
  icon: IoniconName;
  /** One-line helper, shown on Discover's list and used as the accessibility hint. */
  description: string;
  /** A category-coded accent used for its icon chip. */
  color: string;
}

/**
 * Display metadata for the 10 need categories. Hues match their counterparts in
 * RESOURCE_CATEGORY_META, whose constraints `categoryMeta.test.ts` enforces.
 */
export const NEED_CATEGORY_META: Record<NeedCategory, NeedCategoryMeta> = {
  essentials: {
    label: 'Essentials',
    // A cart: food and clothing both, and legible at small sizes.
    icon: 'cart-outline',
    description: 'Food, clothing, and everyday basics',
    color: '#B85C1E',
  },
  housing: {
    label: 'Housing',
    icon: 'home-outline',
    description: 'Shelter, rent, and homeless services',
    color: '#35521F',
  },
  healthcare: {
    label: 'Healthcare',
    icon: 'medkit-outline',
    description: 'Clinics, mental health, and VA care',
    color: '#1F7A7A',
  },
  va_benefits: {
    label: 'Disability & VA benefits',
    shortLabel: 'VA benefits',
    // Claims are paperwork; a medal would just say "veteran".
    icon: 'document-text-outline',
    description: 'Claims, ratings, and other VA benefits',
    color: '#4A5580',
  },
  education_benefits: {
    label: 'Education benefits',
    shortLabel: 'Education',
    icon: 'school-outline',
    description: 'GI Bill, tuition, and training',
    color: '#47708A',
  },
  jobs: {
    label: 'Job / employment',
    shortLabel: 'Employment',
    icon: 'briefcase-outline',
    description: 'Hiring, resumes, and job training',
    color: '#8A6B1C',
  },
  legal: {
    label: 'Legal help',
    icon: 'shield-outline',
    description: 'VA-accredited reps for your claims',
    color: '#2F5550',
  },
  transportation: {
    label: 'Transportation',
    shortLabel: 'Transport',
    icon: 'bus-outline',
    description: 'Rides to appointments and errands',
    color: '#6A5266',
  },
  family_caregiver: {
    label: 'Family / caregiver',
    shortLabel: 'Family',
    icon: 'people-outline',
    description: 'Support for families and caregivers',
    color: '#9C606E',
  },
  emergency: {
    label: 'Emergency help',
    icon: 'alert-circle-outline',
    description: 'Crisis lines and urgent support',
    color: '#B04A38',
  },
};

/** Whether a route param names a real need category. Deep links and stale
 *  routes can carry anything; the screens validate before trusting it. */
export function isNeedCategory(value: unknown): value is NeedCategory {
  // Own keys only: `'toString' in {}` is true, and a route param can say anything.
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(NEED_CATEGORY_META, value)
  );
}

/** Stable display order for Discover's full category list. */
export const NEED_CATEGORIES: NeedCategory[] = [
  'essentials',
  'housing',
  'healthcare',
  'va_benefits',
  'education_benefits',
  'jobs',
  'legal',
  'transportation',
  'family_caregiver',
  'emergency',
];

/** The four needs a veteran reaches for most, in display order (Discover's shell row). */
export const TOP_NEED_CATEGORIES = [
  'essentials',
  'housing',
  'va_benefits',
  'jobs',
] as const satisfies readonly NeedCategory[];

/** One of the four common needs — narrower than `NeedCategory`, so a surface
 *  that only handles the shortlist can say so in its types. */
export type TopNeedCategory = (typeof TOP_NEED_CATEGORIES)[number];

export const VETERAN_DOCUMENT_LABELS: Record<VeteranDocument, string> = {
  veteran_id: 'Veteran ID',
  va_card: 'VA card',
  dd214: 'DD-214',
  photo_id: 'Photo ID',
  proof_of_address: 'Proof of address',
  proof_of_income: 'Proof of income',
};

/** A display label for a document key, tolerant of values outside the enum. */
export function humanizeDocument(doc: string): string {
  if (doc in VETERAN_DOCUMENT_LABELS) {
    return VETERAN_DOCUMENT_LABELS[doc as VeteranDocument];
  }
  return doc.replace(/_/g, ' ');
}

/** Document options for the setup wizard + profile form (single source). */
export const DOCUMENT_OPTIONS: { value: VeteranDocument; label: string }[] = (
  Object.keys(VETERAN_DOCUMENT_LABELS) as VeteranDocument[]
).map((value) => ({ value, label: VETERAN_DOCUMENT_LABELS[value] }));

/** A sensible default search radius when the veteran hasn't set one. */
export const DEFAULT_RADIUS_MILES = 15;

/**
 * Builds a `Need` from a tapped category + ZIP with default answers. The single
 * source for results and resource detail, so the two always agree.
 */
export function defaultNeedForCategory(
  category: NeedCategory,
  zip?: string,
  radiusMiles: number = DEFAULT_RADIUS_MILES,
): Need {
  return {
    category,
    urgency: 'this_week',
    modality: 'either',
    helpType: 'understand',
    documentsOnHand: [],
    location: { zip: zip || undefined, radiusMiles },
  };
}
