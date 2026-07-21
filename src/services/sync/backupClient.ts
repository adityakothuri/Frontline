import type { VeteranProfile } from '@/types/profile';
import { supabaseRequest } from '../supabase/client';
import type { SavedEntry } from '../saved/savedStorage';

/** Typed calls to the `sync` edge function (the only path to the backup tables). */

export type BackupSnapshot = {
  saved: SavedEntry[] | null;
  savedUpdatedAt: string | null;
  profile: VeteranProfile | null;
  profileUpdatedAt: string | null;
};

/** Backup can be slower/less critical than a read; keep the timeout modest. */
const SYNC_TIMEOUT_MS = 6000;

const call = <T>(body: Record<string, unknown>): Promise<T> =>
  supabaseRequest<T>('/functions/v1/sync', { method: 'POST', body, timeoutMs: SYNC_TIMEOUT_MS });

export const pullBackup = (deviceId: string): Promise<BackupSnapshot> =>
  call<BackupSnapshot>({ action: 'pull', deviceId });

export const pushSavedBackup = (
  deviceId: string,
  entries: SavedEntry[],
  updatedAt: string,
): Promise<unknown> => call({ action: 'pushSaved', deviceId, entries, updatedAt });

export const pushProfileBackup = (
  deviceId: string,
  profile: VeteranProfile,
  updatedAt: string,
): Promise<unknown> => call({ action: 'pushProfile', deviceId, profile, updatedAt });

export const clearProfileBackupRemote = (deviceId: string, updatedAt: string): Promise<unknown> =>
  call({ action: 'clearProfile', deviceId, updatedAt });
