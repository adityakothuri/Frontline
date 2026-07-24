import type { Ionicons } from '@expo/vector-icons';

/**
 * The canonical resource/benefit model for Frontline.
 *
 * A `Resource` is a single place or program a veteran can get help from (a food
 * pantry, a housing program, a legal-aid clinic, a benefit, etc.). This is the
 * contract every screen, card, map pin, and the trust surfacing depend on. See
 * `docs/obsidian/03 Technical/Resource Data Model.md`.
 *
 * All resources are REAL, ingested from official and directory sources (VA,
 * USAJOBS, GI Bill Comparison Tool, LSC, HUD, curated veteran referrals) via
 * `ingestion/`. There is no simulated resource data anywhere in the app.
 */

type IoniconName = keyof typeof Ionicons.glyphMap;

/** What a resource offers. Distinct from the 12 user-facing need categories. */
export type ResourceCategory =
  | 'food'
  | 'clothing'
  | 'housing'
  | 'healthcare'
  | 'benefits_help'
  | 'legal'
  | 'jobs'
  | 'education'
  | 'transportation'
  | 'emergency'
  | 'community_support';

/** Where a resource's information came from — drives the trust badge. */
export type SourceType =
  | 'official'
  | 'directory'
  | 'nonprofit'
  | 'community'
  | 'unverified';

/** How confident we are the information is current and correct. */
export type VerificationStatus = 'verified' | 'needs_review' | 'unverified';

/**
 * Why this resource belongs in a veterans' app — the hybrid inclusion rule.
 * `veteran_specific`: exists to serve veterans (VA, Vet Centers, VSOs, GPD/SSVF,
 * DAV, CVSOs). `veteran_benefit`: a place/program that offers a concrete veteran
 * benefit (GI Bill-approved school, veterans' hiring preference). `general`:
 * open to everyone and clearly labeled so — used to backfill categories with no
 * veteran-specific local coverage (legal aid, housing counseling, food pantries).
 * Veteran rows always take priority: they fill the per-category result cap first
 * and win distance ties. Every row must carry one of these labels (DB NOT NULL).
 */
export type VeteranRelevance = 'veteran_specific' | 'veteran_benefit' | 'general';

export interface Resource {
  id: string;
  name: string;
  category: ResourceCategory;
  description: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  /**
   * Human-readable hours. When set, use the controlled format understood by
   * `@/lib/hours` so "open now" can be derived, e.g. `Mon-Fri 09:00-17:00`
   * (semicolon-separated day groups). Free text is allowed but yields "unknown".
   */
  hours: string | null;
  /** Who may qualify — always hedged language, never a determination. */
  eligibility: string | null;
  /** Documents worth bringing; drives the "What should I bring?" checklist. */
  documents_needed: string[];
  source_url: string | null;
  source_type: SourceType;
  /** Why it's in a veterans' app — veteran-first, general clearly labeled. */
  veteran_relevance: VeteranRelevance;
  verification_status: VerificationStatus;
  /** ISO date the info was last confirmed. Stale dates trigger a warning. */
  last_checked: string;
  /** ISO date the record last changed. */
  last_updated: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ResourceCategoryMeta {
  label: string;
  icon: IoniconName;
  /** One-line description of what this category covers. */
  blurb: string;
  /** A category-coded accent used for its icon chip and map pin. */
  color: string;
}

/**
 * Display metadata for each resource category — one source of truth for UI.
 * Colors come from the app's olive/earth family and match the corresponding
 * need category in NEED_CATEGORY_META (`types/need.ts`); keep the two in sync.
 */
export const RESOURCE_CATEGORY_META: Record<ResourceCategory, ResourceCategoryMeta> = {
  food: {
    label: 'Food',
    icon: 'fast-food-outline',
    blurb: 'Food pantries, meals, and grocery assistance.',
    color: '#A56E24',
  },
  clothing: {
    label: 'Clothing',
    icon: 'shirt-outline',
    blurb: 'Clothing closets and essential-item assistance.',
    color: '#8A6A48',
  },
  housing: {
    label: 'Housing',
    icon: 'home-outline',
    blurb: 'Shelter, rent help, and housing programs.',
    color: '#5F7326',
  },
  healthcare: {
    label: 'Healthcare',
    icon: 'medkit-outline',
    blurb: 'Clinics, mental health, and VA health services.',
    color: '#4E7D5B',
  },
  benefits_help: {
    label: 'Benefits help',
    icon: 'document-text-outline',
    blurb: 'Help understanding and applying for VA benefits.',
    color: '#46602A',
  },
  legal: {
    label: 'Legal',
    icon: 'shield-outline',
    blurb: 'Legal aid, discharge upgrades, and advocacy.',
    color: '#587045',
  },
  jobs: {
    label: 'Jobs',
    icon: 'briefcase-outline',
    blurb: 'Employment support, training, and placement.',
    color: '#A98E2E',
  },
  education: {
    label: 'Education',
    icon: 'school-outline',
    blurb: 'Education benefits, tuition, and training help.',
    color: '#87702A',
  },
  transportation: {
    label: 'Transportation',
    icon: 'bus-outline',
    blurb: 'Rides to appointments and transit assistance.',
    color: '#6F8F5A',
  },
  emergency: {
    label: 'Emergency',
    icon: 'alert-circle-outline',
    blurb: 'Crisis lines and urgent-need resources.',
    color: '#B04A38',
  },
  community_support: {
    label: 'Community support',
    icon: 'people-outline',
    blurb: 'Peer groups, caregiver support, and local orgs.',
    color: '#7E9146',
  },
};

/** Stable display order for resource categories. */
export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  'food',
  'clothing',
  'housing',
  'healthcare',
  'benefits_help',
  'legal',
  'jobs',
  'education',
  'transportation',
  'emergency',
  'community_support',
];
