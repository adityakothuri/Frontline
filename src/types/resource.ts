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
 * USAJOBS, GI Bill Comparison Tool, HUD, SSVF, curated veteran referrals) via
 * `ingestion/`. There is no simulated resource data anywhere in the app.
 */

type IoniconName = keyof typeof Ionicons.glyphMap;

/** What a resource offers. Distinct from the user-facing need categories (food +
 * clothing here map up to the single "essentials" need — see needMapping.ts). */
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
export type SourceType = 'official' | 'directory' | 'nonprofit' | 'community' | 'unverified';

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
 *
 * Each category owns its own muted hue, so a food resource never reads like a
 * housing one. The set is chosen against three measured constraints, not by eye
 * (see `docs/obsidian/02 Design/UI Design System.md` → Category identity hues):
 *   1. >=12 CIEDE2000 from every semantic token (accent olive, success emerald,
 *      warning amber, danger red) so a category never impersonates a state.
 *      `emergency` is the deliberate exception — there, identity IS severity.
 *   2. >=11 CIEDE2000 from every other category.
 *   3. >=3:1 contrast for the icon on its own medallion wash (the compound
 *      tint-on-tint case, which is the worst surface each hue lands on).
 * They are used for icons, pins, borders and washes — never as small text, which
 * several are too light to carry. Mirrored in NEED_CATEGORY_META (`types/need.ts`)
 * for the categories that correspond; keep the two in sync.
 */
export const RESOURCE_CATEGORY_META: Record<ResourceCategory, ResourceCategoryMeta> = {
  food: {
    label: 'Food',
    icon: 'fast-food-outline',
    blurb: 'Food pantries, meals, and grocery assistance.',
    color: '#B85C1E',
  },
  clothing: {
    label: 'Clothing',
    icon: 'shirt-outline',
    blurb: 'Clothing closets and essential-item assistance.',
    color: '#7E6144',
  },
  housing: {
    label: 'Housing',
    icon: 'home-outline',
    blurb: 'Shelter, rent help, and housing programs.',
    color: '#35521F',
  },
  healthcare: {
    label: 'Healthcare',
    icon: 'medkit-outline',
    blurb: 'Clinics, mental health, and VA health services.',
    color: '#1F7A7A',
  },
  benefits_help: {
    label: 'Benefits help',
    // Kept in step with `va_benefits` in NEED_CATEGORY_META — the two maps must
    // not show a veteran two different glyphs for the same thing.
    icon: 'document-text-outline',
    blurb: 'Help understanding and applying for VA benefits.',
    color: '#4A5580',
  },
  legal: {
    label: 'Legal',
    icon: 'shield-outline',
    blurb: 'VA-accredited VSO reps who help with claims and appeals.',
    color: '#2F5550',
  },
  jobs: {
    label: 'Jobs',
    icon: 'briefcase-outline',
    blurb: 'Employment support, training, and placement.',
    color: '#8A6B1C',
  },
  education: {
    label: 'Education',
    icon: 'school-outline',
    blurb: 'Education benefits, tuition, and training help.',
    color: '#47708A',
  },
  transportation: {
    label: 'Transportation',
    icon: 'bus-outline',
    blurb: 'Rides to appointments and transit assistance.',
    color: '#6A5266',
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
    color: '#9C606E',
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
