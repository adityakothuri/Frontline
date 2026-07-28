import type { Ionicons } from '@expo/vector-icons';

/**
 * The structured "need" produced by the "What do you need help with?" guided
 * flow (Phase 3). It is the query that drives resource discovery and every AI
 * output. See `docs/obsidian/02 Design/App Flow.md`.
 */

type IoniconName = keyof typeof Ionicons.glyphMap;

/** The 11 user-facing need categories shown on the home grid. */
export type NeedCategory =
  | 'essentials'
  | 'housing'
  | 'healthcare'
  | 'disability_benefits'
  | 'education_benefits'
  | 'jobs'
  | 'legal'
  | 'transportation'
  | 'family_caregiver'
  | 'emergency'
  | 'general_benefits';

/** How soon the veteran needs help — affects sorting and "open now" emphasis. */
export type Urgency = 'today' | 'this_week' | 'info';

/** Whether the veteran wants in-person help, online help, or either. */
export type Modality = 'in_person' | 'online' | 'either';

/** What kind of help the veteran wants for this need. */
export type HelpType = 'call' | 'visit' | 'apply' | 'understand';

/** Documents a veteran may already have on hand (checklist, never uploads). */
export type VeteranDocument =
  | 'veteran_id'
  | 'va_card'
  | 'dd214'
  | 'photo_id'
  | 'proof_of_address'
  | 'proof_of_income';

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
  icon: IoniconName;
  /** One-line helper shown under the label on the home cards. */
  description: string;
  /** A category-coded accent used for its icon chip. */
  color: string;
}

/**
 * Display metadata for the 11 need categories — one source of truth for the home grid.
 * Each category owns its own muted hue, chosen against the measured constraints
 * documented on RESOURCE_CATEGORY_META (`types/resource.ts`): >=12 CIEDE2000 from
 * every semantic token, >=11 from every other category, >=3:1 for the icon on its
 * own medallion wash. Every hue here matches its counterpart in
 * RESOURCE_CATEGORY_META — keep the two in sync.
 */
export const NEED_CATEGORY_META: Record<NeedCategory, NeedCategoryMeta> = {
  essentials: { label: 'Essentials', icon: 'basket-outline', description: 'Food, clothing, and everyday basics', color: '#B85C1E' },
  housing: { label: 'Housing', icon: 'home-outline', description: 'Shelter, rent, and homeless services', color: '#35521F' },
  healthcare: { label: 'Healthcare', icon: 'medkit-outline', description: 'Clinics, mental health, and VA care', color: '#1F7A7A' },
  disability_benefits: { label: 'Disability benefits', icon: 'ribbon-outline', description: 'Claims, ratings, and compensation', color: '#7E6144' },
  education_benefits: { label: 'Education benefits', icon: 'school-outline', description: 'GI Bill, tuition, and training', color: '#47708A' },
  jobs: { label: 'Job / employment', icon: 'briefcase-outline', description: 'Hiring, resumes, and job training', color: '#8A6B1C' },
  legal: { label: 'Legal help', icon: 'shield-outline', description: 'VA-accredited reps for your claims', color: '#2F5550' },
  transportation: { label: 'Transportation', icon: 'bus-outline', description: 'Rides to appointments and errands', color: '#6A5266' },
  family_caregiver: { label: 'Family / caregiver', icon: 'people-outline', description: 'Support for families and caregivers', color: '#9C606E' },
  emergency: { label: 'Emergency help', icon: 'alert-circle-outline', description: 'Crisis lines and urgent support', color: '#B04A38' },
  general_benefits: { label: 'General VA benefits', icon: 'document-text-outline', description: 'Explore other VA benefits', color: '#4A5580' },
};

/** Stable display order for the home grid. */
export const NEED_CATEGORIES: NeedCategory[] = [
  'essentials',
  'housing',
  'healthcare',
  'disability_benefits',
  'education_benefits',
  'jobs',
  'legal',
  'transportation',
  'family_caregiver',
  'emergency',
  'general_benefits',
];

export const URGENCY_LABELS: Record<Urgency, string> = {
  today: 'I need something today',
  this_week: 'Sometime this week',
  info: "Just looking for information",
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
