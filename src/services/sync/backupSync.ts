import type { VeteranProfile } from '@/types/profile';
import { parseProfile } from '../profile/profileStorage';
import type { SavedEntry } from '../saved/savedStorage';
import { getDeviceId } from './deviceId';
import {
  clearProfileBackupRemote,
  pullBackup,
  pushProfileBackup,
  pushSavedBackup,
  type BackupSnapshot,
} from './backupClient';

/**
 * Backup-sync orchestration. Local storage stays the source of truth; this
 * layer mirrors it to the server and restores it after a reinstall. Every
 * function is a safe no-op when the backend is unconfigured or the device id /
 * network is unavailable — so offline behavior is byte-for-byte unchanged, and
 * a sync failure never blocks or breaks the app. Pushes are fire-and-forget and
 * debounced; the server enforces updated_at monotonicity, so a reinstall's
 * empty-before-restore state can never overwrite good backup data.
 */

// One cached pull per launch — the restore paths for saved and profile share it.
let snapshot: Promise<BackupSnapshot | null> | null = null;

async function loadSnapshot(): Promise<BackupSnapshot | null> {
  const deviceId = await getDeviceId();
  if (!deviceId) return null;
  try {
    return await pullBackup(deviceId);
  } catch {
    return null; // sync must never block hydrate
  }
}

function getSnapshot(): Promise<BackupSnapshot | null> {
  if (!snapshot) snapshot = loadSnapshot();
  return snapshot;
}

/**
 * Merge the on-device saved list with the backup: a union by id preserving the
 * earliest savedAt, newest-first. Restores a reinstalled device's list and
 * folds in any ids saved before the backend was reachable. Returns the local
 * list unchanged when sync is off/unreachable.
 */
export async function reconcileSaved(local: SavedEntry[]): Promise<SavedEntry[]> {
  const remote = (await getSnapshot())?.saved;
  if (!remote || remote.length === 0) return local;

  const byId = new Map<string, SavedEntry>();
  for (const entry of [...remote, ...local]) {
    const existing = byId.get(entry.id);
    if (!existing || entry.savedAt < existing.savedAt) byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/**
 * Same-device restore for the profile: local wins when present (it's the active
 * profile on this device); otherwise restore the backup, tolerantly parsed.
 */
export async function restoreProfile(local: VeteranProfile | null): Promise<VeteranProfile | null> {
  if (local) return local;
  const remote = (await getSnapshot())?.profile;
  return remote ? parseProfile(remote) : null;
}

// --- Debounced, fire-and-forget pushes -------------------------------------

const timers: Record<string, ReturnType<typeof setTimeout>> = {};

function debounce(key: string, run: () => void, ms = 1000): void {
  if (timers[key]) clearTimeout(timers[key]);
  timers[key] = setTimeout(run, ms);
}

export function pushSaved(entries: SavedEntry[]): void {
  debounce('saved', () => {
    getDeviceId().then((deviceId) => {
      if (deviceId) pushSavedBackup(deviceId, entries, new Date().toISOString()).catch(() => {});
    });
  });
}

export function pushProfile(profile: VeteranProfile): void {
  debounce('profile', () => {
    getDeviceId().then((deviceId) => {
      if (deviceId) pushProfileBackup(deviceId, profile, new Date().toISOString()).catch(() => {});
    });
  });
}

/** "Reset setup" — tombstone the backup so restore can't resurrect the old profile. */
export function clearProfileBackup(): void {
  if (timers.profile) clearTimeout(timers.profile); // cancel any pending push
  const updatedAt = new Date().toISOString();
  getDeviceId().then((deviceId) => {
    if (deviceId) clearProfileBackupRemote(deviceId, updatedAt).catch(() => {});
  });
}
