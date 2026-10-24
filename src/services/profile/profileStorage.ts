import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureException } from '../monitoring';
import { VETERAN_ROLE_LABELS, type VeteranProfile, type VeteranRole } from '@/types/profile';
import { VETERAN_DOCUMENT_LABELS, type VeteranDocument } from '@/types/need';

// Versioned so a future shape change can migrate rather than misread old data.
const STORAGE_KEY = 'frontline.profile.v1';

const isRole = (v: unknown): v is VeteranRole => typeof v === 'string' && v in VETERAN_ROLE_LABELS;

const parseDocuments = (v: unknown): VeteranDocument[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const valid = v.filter(
    (d): d is VeteranDocument => typeof d === 'string' && d in VETERAN_DOCUMENT_LABELS,
  );
  return valid.length ? valid : undefined;
};

/**
 * Tolerantly parse an untrusted profile value into a usable `VeteranProfile`,
 * or null. Shared by the on-device loader and the backup-restore path, so a
 * restored remote blob gets exactly the same guarding as stored data.
 */
export function parseProfile(value: unknown): VeteranProfile | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Record<string, unknown>;
  if (typeof parsed.firstName !== 'string' || parsed.firstName.length === 0) {
    return null;
  }
  return {
    firstName: parsed.firstName,
    zip: typeof parsed.zip === 'string' && parsed.zip ? parsed.zip : undefined,
    role: isRole(parsed.role) ? parsed.role : undefined,
    documentsOnHand: parseDocuments(parsed.documentsOnHand),
    preferredRadiusMiles:
      typeof parsed.preferredRadiusMiles === 'number' &&
      Number.isFinite(parsed.preferredRadiusMiles)
        ? parsed.preferredRadiusMiles
        : undefined,
    onboardingComplete: parsed.onboardingComplete === true,
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
  };
}

/** Load the saved profile, or null if none exists or the stored value is unreadable. */
export async function loadProfile(): Promise<VeteranProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Persist the profile. Never throws. */
export async function saveProfile(profile: VeteranProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    captureException(error);
  }
}

/** Remove the profile (used by "Reset setup"). Never throws. */
export async function clearProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    captureException(error);
  }
}
