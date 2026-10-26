import type { VeteranDocument } from './need';

/**
 * The on-device veteran profile captured in the one-time setup. Privacy-first:
 * name + ZIP plus a few optional preferences — never SSN, VA login, bank, or
 * diagnosis.
 */

/** How the person relates to service — shapes tone, not eligibility. */
export type VeteranRole = 'veteran' | 'active_duty' | 'family' | 'caregiver' | 'other';

export const VETERAN_ROLE_LABELS: Record<VeteranRole, string> = {
  veteran: 'Veteran',
  active_duty: 'Active duty',
  family: 'Family member',
  caregiver: 'Caregiver',
  other: 'Other',
};

/** Role options for the setup wizard + profile form (single source). */
export const ROLE_OPTIONS: { value: VeteranRole; label: string }[] = (
  Object.keys(VETERAN_ROLE_LABELS) as VeteranRole[]
).map((value) => ({ value, label: VETERAN_ROLE_LABELS[value] }));

/** Preferred search-radius options (miles). */
export const RADIUS_OPTIONS: { value: number; label: string }[] = [5, 10, 15, 25, 50].map((m) => ({
  value: m,
  label: `${m} mi`,
}));

export interface VeteranProfile {
  /** What the veteran wants to be called. */
  firstName: string;
  /** Home ZIP — captured at setup so resource searches are local without asking each time. */
  zip?: string;
  /** Optional: how the person relates to service. */
  role?: VeteranRole;
  /** Optional: documents they already have. */
  documentsOnHand?: VeteranDocument[];
  /** Optional: preferred search radius in miles; falls back to the default when unset. */
  preferredRadiusMiles?: number;
  /** True once the one-time setup has been completed. */
  onboardingComplete: boolean;
  /** When the profile was first created (ISO string). */
  createdAt: string;
}

/** The subset of profile fields a screen may edit (never touches complete/createdAt). */
export type ProfileDetails = Partial<
  Pick<VeteranProfile, 'firstName' | 'zip' | 'role' | 'documentsOnHand' | 'preferredRadiusMiles'>
>;
