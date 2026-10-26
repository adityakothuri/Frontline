import * as SecureStore from 'expo-secure-store';
import { supabaseConfig } from '../supabase/config';

/**
 * A stable anonymous device identity for backup sync: a random UUID in the
 * keychain/keystore, which survives a reinstall on iOS (Android wipes it). It is
 * a bearer secret for that device's backup rows, so it never leaves the device.
 */

const KEY = 'frontline.device_id.v1';

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Readable during a launch sync; kept off iCloud Keychain.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

async function loadOrCreate(): Promise<string | null> {
  try {
    let id = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (!id) {
      id = globalThis.crypto.randomUUID();
      await SecureStore.setItemAsync(KEY, id, OPTIONS);
    }
    return id;
  } catch {
    return null;
  }
}

// The in-flight promise, so concurrent first calls can't mint two UUIDs.
let deviceId: Promise<string | null> | null = null;

/**
 * The device UUID, creating one on first call. Null when the backend isn't
 * configured or secure storage is unavailable; callers treat null as "sync off".
 */
export function getDeviceId(): Promise<string | null> {
  if (!supabaseConfig) return Promise.resolve(null);
  return (deviceId ??= loadOrCreate());
}
