import type { Ionicons } from '@expo/vector-icons';

/**
 * The canonical resource/benefit model for Frontline.
 *
 * A `Resource` is a single place or program a veteran can get help from (a food
 * pantry, a housing program, a legal-aid clinic, a benefit, etc.). This is the
 * contract every screen, card, map pin, and the trust surfacing depend on. See
 * `docs/obsidian/03 Technical/Resource Data Model.md`.
 *
 * All resource data in the MVP is **simulated** — see `seedResources.ts`.
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

export interface Resource {
  id: string;
  name: string;
  category: ResourceCategory;
  description: string;
  /** Plain-English AI summary; generated on demand, so null until requested. */
  ai_summary: string | null;
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
}

/** Display metadata for each resource category — one source of truth for UI. */
export const RESOURCE_CATEGORY_META: Record<ResourceCategory, ResourceCategoryMeta> = {
  food: {
    label: 'Food',
    icon: 'fast-food-outline',
    blurb: 'Food pantries, meals, and grocery assistance.',
  },
  clothing: {
    label: 'Clothing',
    icon: 'shirt-outline',
    blurb: 'Clothing closets and essential-item assistance.',
  },
  housing: {
    label: 'Housing',
    icon: 'home-outline',
    blurb: 'Shelter, rent help, and housing programs.',
  },
  healthcare: {
    label: 'Healthcare',
    icon: 'medkit-outline',
    blurb: 'Clinics, mental health, and VA health services.',
  },
  benefits_help: {
    label: 'Benefits help',
    icon: 'document-text-outline',
    blurb: 'Help understanding and applying for VA benefits.',
  },
  legal: {
    label: 'Legal',
    icon: 'shield-outline',
    blurb: 'Legal aid, discharge upgrades, and advocacy.',
  },
  jobs: {
    label: 'Jobs',
    icon: 'briefcase-outline',
    blurb: 'Employment support, training, and placement.',
  },
  education: {
    label: 'Education',
    icon: 'school-outline',
    blurb: 'Education benefits, tuition, and training help.',
  },
  transportation: {
    label: 'Transportation',
    icon: 'bus-outline',
    blurb: 'Rides to appointments and transit assistance.',
  },
  emergency: {
    label: 'Emergency',
    icon: 'alert-circle-outline',
    blurb: 'Crisis lines and urgent-need resources.',
  },
  community_support: {
    label: 'Community support',
    icon: 'people-outline',
    blurb: 'Peer groups, caregiver support, and local orgs.',
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
