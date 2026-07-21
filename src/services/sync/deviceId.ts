import * as SecureStore from 'expo-secure-store';
import { supabaseConfig } from '../supabase/config';

/**
 * A stable anonymous device identity for backup sync — no login, no PII. It's a
 * random UUID kept in the platform keychain/keystore (not AsyncStorage) so it
 * survives an app reinstall on iOS, which is what lets a reinstalled app find
 * its backup. On Android the keystore is wiped on uninstall, so Android gets
 * server backup but not reinstall-restore (a recovery code is a later slice).
 *
 * The UUID is a bearer capability secret — whoever holds it can read/write that
 * device's backup rows — so it's device-local only (never iCloud-synced) and
 * nothing sensitive is ever stored under it.
 */

const KEY = 'frontline.device_id.v1';

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Readable during a background/launch sync; kept off iCloud Keychain so the
  // identity stays single-device (cross-device needs an explicit recovery code).
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

let cached: string | null | undefined;

/**
 * The device UUID, creating one on first call. Returns null when the backend
 * isn't configured (offline mode) or secure storage is unavailable — callers
 * treat null as "sync disabled", so nothing changes offline.
 */
export async function getDeviceId(): Promise<string | null> {
  if (!supabaseConfig) return null;
  if (cached !== undefined) return cached;
  try {
    let id = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (!id) {
      id = globalThis.crypto.randomUUID();
      await SecureStore.setItemAsync(KEY, id, OPTIONS);
    }
    cached = id;
    return id;
  } catch {
    cached = null;
    return null;
  }
}
