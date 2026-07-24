import type { Ionicons } from '@expo/vector-icons';
import type { VeteranDocument } from './need';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * The on-device veteran profile captured in the one-time setup. Privacy-first:
 * name + ZIP plus a few optional preferences — never anything sensitive (no SSN,
 * VA login, bank, or diagnosis). Optional fields load tolerantly, so older stored
 * profiles keep working. See `docs/obsidian/04 Build Roadmap/Phase 8 Saved and Profile.md`.
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

const ROLE_ICONS: Record<VeteranRole, IconName> = {
  veteran: 'ribbon-outline',
  active_duty: 'shield-outline',
  family: 'people-outline',
  caregiver: 'heart-outline',
  other: 'ellipsis-horizontal',
};

/** Role options for the setup wizard + profile form (single source). */
export const ROLE_OPTIONS: { value: VeteranRole; label: string; icon: IconName }[] = (
  Object.keys(VETERAN_ROLE_LABELS) as VeteranRole[]
).map((value) => ({ value, label: VETERAN_ROLE_LABELS[value], icon: ROLE_ICONS[value] }));

/** Preferred search-radius options (miles). */
export const RADIUS_OPTIONS: { value: number; label: string }[] = [5, 10, 15, 25, 50].map((m) => ({
  value: m,
  label: `${m} mi`,
}));

export interface VeteranProfile {
  /** What the veteran wants to be called — used to greet them on the home screen. */
  firstName: string;
  /** Home ZIP — captured at setup so resource searches are local without asking each time. */
  zip?: string;
  /** Optional: how the person relates to service. */
  role?: VeteranRole;
  /** Optional: documents they already have (drives "what to bring" guidance later). */
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
