import type { Ionicons } from '@expo/vector-icons';

/**
 * The structured "need" produced by the "What do you need help with?" guided
 * flow (Phase 3). It is the query that drives resource discovery and every AI
 * output. See `docs/obsidian/02 Design/App Flow.md`.
 */

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * The 10 user-facing need categories listed under Discover's "Other" shell.
 *
 * `va_benefits` covers both disability claims and VA benefits generally. They
 * were two categories until 2026-07-28, but both fanned out to the single
 * `benefits_help` resource category — a VSO rep is who helps with either — so
 * they returned identical local lists in every ZIP measured. One entry point,
 * with both sets of official links behind it.
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
  /**
   * A shorter label for narrow surfaces — a Discover shell chip, a Home tile.
   * Only set where the full label doesn't fit; read it as
   * `meta.shortLabel ?? meta.label`.
   */
  shortLabel?: string;
  icon: IoniconName;
  /**
   * One-line helper. Visible under the label on Discover's category list, and
   * spoken as the accessibility hint on both Discover and the Home tiles — the
   * Home tiles stopped *showing* it on 2026-07-30, when four two-line captions
   * were what made those tiles too big.
   */
  description: string;
  /** A category-coded accent used for its icon chip. */
  color: string;
}

/**
 * Display metadata for the 10 need categories — one source of truth for the
 * category list under Discover's "Other" shell.
 * Each category owns its own muted hue, chosen against the measured constraints
 * documented on RESOURCE_CATEGORY_META (`types/resource.ts`): >=12 CIEDE2000 from
 * every semantic token, >=11 from every other category, >=3:1 for the icon on its
 * own medallion wash. Every hue here matches its counterpart in
 * RESOURCE_CATEGORY_META — keep the two in sync.
 */
export const NEED_CATEGORY_META: Record<NeedCategory, NeedCategoryMeta> = {
  essentials: {
    label: 'Essentials',
    // A cart rather than a basket: `essentials` merges food and clothing, and at
    // the sizes this glyph is drawn a basket is easy to misread. Home shows these
    // glyphs with no label at all, so legibility beats nicety.
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
    // A document. This was briefly a service medal, on the reasoning that a
    // document reads as "a form" while a medal reads as something earned — but a
    // medal turned out to say *veteran* rather than *benefits*, and every one of
    // these categories is for veterans. Claims are paperwork; the document says so.
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

/**
 * The four needs a veteran reaches for most, in the order they're shown. Two
 * surfaces curated this shortlist until 2026-08-05, when Home's quick-start grid
 * was deleted; Discover's shell row is now the only consumer. Kept here rather
 * than inlined there because "which needs are common" is a product fact about
 * the catalogue, not a detail of one chip row — and the last surface to want it
 * should not have to rediscover it.
 */
export const TOP_NEED_CATEGORIES = [
  'essentials',
  'housing',
  'va_benefits',
  'jobs',
] as const satisfies readonly NeedCategory[];

/** One of the four common needs — narrower than `NeedCategory`, so a surface
 *  that only handles the shortlist can say so in its types. */
export type TopNeedCategory = (typeof TOP_NEED_CATEGORIES)[number];

export const URGENCY_LABELS: Record<Urgency, string> = {
  today: 'I need something today',
  this_week: 'Sometime this week',
  info: 'Just looking for information',
};

export const MODALITY_LABELS: Record<Modality, string> = {
  in_person: 'In person',
  online: 'Online',
  either: 'Either is fine',
};

export const HELP_TYPE_LABELS: Record<HelpType, string> = {
  call: 'Help calling',
  visit: 'Help visiting',
  apply: 'Help applying',
  understand: 'Help understanding it',
};

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
 * Builds a `Need` from just a tapped category + the veteran's ZIP, filling the
 * rest with sensible defaults. Since Stage 4 removed the per-category questions,
 * both the results list and the resource detail page derive their `Need` this way
 * — keep it the single source so the two views always agree.
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
