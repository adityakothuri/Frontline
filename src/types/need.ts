import type { Ionicons } from '@expo/vector-icons';

/**
 * The structured "need" produced by the "What do you need help with?" guided
 * flow (Phase 3). It is the query that drives resource discovery and every AI
 * output. See `docs/obsidian/02 Design/App Flow.md`.
 */

type IoniconName = keyof typeof Ionicons.glyphMap;

/** The 12 user-facing need categories shown on the home grid. */
export type NeedCategory =
  | 'food'
  | 'clothing'
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
}

/** Display metadata for the 12 need categories — one source of truth for the home grid. */
export const NEED_CATEGORY_META: Record<NeedCategory, NeedCategoryMeta> = {
  food: { label: 'Food', icon: 'fast-food-outline' },
  clothing: { label: 'Clothing', icon: 'shirt-outline' },
  housing: { label: 'Housing', icon: 'home-outline' },
  healthcare: { label: 'Healthcare', icon: 'medkit-outline' },
  disability_benefits: { label: 'Disability benefits', icon: 'ribbon-outline' },
  education_benefits: { label: 'Education benefits', icon: 'school-outline' },
  jobs: { label: 'Job / employment', icon: 'briefcase-outline' },
  legal: { label: 'Legal help', icon: 'shield-outline' },
  transportation: { label: 'Transportation', icon: 'bus-outline' },
  family_caregiver: { label: 'Family / caregiver', icon: 'people-outline' },
  emergency: { label: 'Emergency help', icon: 'alert-circle-outline' },
  general_benefits: { label: 'General VA benefits', icon: 'document-text-outline' },
};

/** Stable display order for the home grid. */
export const NEED_CATEGORIES: NeedCategory[] = [
  'food',
  'clothing',
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

/** A sensible default search radius when the veteran hasn't set one. */
export const DEFAULT_RADIUS_MILES = 15;
