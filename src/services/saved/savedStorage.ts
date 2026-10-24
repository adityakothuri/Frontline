import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureException } from '../monitoring';

// Stores ids, not resource snapshots: the Saved tab re-resolves live data so
// trust signals (open-now, last-checked) are never stale.
const STORAGE_KEY = 'frontline.saved.v1';

export interface SavedEntry {
  id: string;
  /** ISO timestamp the resource was saved (newest first). */
  savedAt: string;
}

function isEntry(value: unknown): value is SavedEntry {
  const e = value as Partial<SavedEntry>;
  return typeof e?.id === 'string' && typeof e?.savedAt === 'string';
}

/** Load the saved entries (newest-first), or an empty list. Never throws. */
export async function loadSaved(): Promise<SavedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

/** Persist the saved entries. Never throws. */
export async function saveSaved(entries: SavedEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    captureException(error);
  }
}
