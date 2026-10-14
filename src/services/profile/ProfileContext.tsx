import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ProfileDetails, VeteranProfile } from '@/types/profile';
import { clearProfile, loadProfile, saveProfile } from './profileStorage';
import { clearProfileBackup, pushProfile, restoreProfile } from '../sync/backupSync';

// The app's single source of truth for the on-device veteran profile. A small
// Context (not a global state library) so the home greeting updates reactively
// after setup, and returning users are recognized on launch. This is the first
// shared state in the app; keep it minimal.
interface ProfileContextValue {
  profile: VeteranProfile | null;
  /** False until the stored profile has been read on launch (gates first-run routing). */
  isHydrated: boolean;
  /** Save (or update) the veteran's details and mark setup complete. Provided
   *  fields overwrite; omitted fields are left as they were. */
  saveDetails: (details: ProfileDetails) => Promise<void>;
  /** Clear the profile — used by "Reset setup". */
  resetProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<VeteranProfile | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  // Lets the late-arriving backup restore tell whether the veteran has since
  // written a profile of their own, without making `profile` a dependency of the
  // mount-once effect below.
  const profileRef = useRef<VeteranProfile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let active = true;
    loadProfile()
      .then((stored) => {
        if (!active) return;
        // A local profile is the whole answer — hydrate on it and skip the
        // network entirely. This is every launch after setup.
        if (stored) {
          setProfile(stored);
          setIsHydrated(true);
          return;
        }
        // No local profile (first install, or a reinstall). Hydrate as "no
        // profile" now rather than holding the app on a blank screen for a cold
        // `sync` round trip — up to 12s — and let a restore land after. Routing
        // in app/index.tsx sends this veteran to onboarding meanwhile; a restore
        // that arrives while they're still there fills the fields in.
        setIsHydrated(true);
        return restoreProfile(null).then((restored) => {
          // If the veteran finished onboarding while the pull was in flight,
          // their profile is the newer one — leave it alone. Writing `restored`
          // here would overwrite it on disk and in the backup.
          if (!active || !restored || profileRef.current) return;
          setProfile(restored);
          // Mirror the restore back so the backup's updated_at advances.
          saveProfile(restored);
          pushProfile(restored);
        });
      })
      .catch(() => {
        // isHydrated gates the entire app (app/index.tsx won't route without
        // it), so it must never be left false by an unexpected throw.
        if (active) setIsHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const saveDetails = useCallback(
    async (details: ProfileDetails) => {
      const firstName = (details.firstName ?? profile?.firstName ?? '').trim();
      const zip = (details.zip ?? profile?.zip)?.trim();
      const next: VeteranProfile = {
        firstName,
        zip: zip ? zip : undefined,
        role: details.role ?? profile?.role,
        documentsOnHand: details.documentsOnHand ?? profile?.documentsOnHand,
        preferredRadiusMiles: details.preferredRadiusMiles ?? profile?.preferredRadiusMiles,
        onboardingComplete: true,
        // Preserve the original creation time when editing an existing profile.
        createdAt: profile?.createdAt ?? new Date().toISOString(),
      };
      await saveProfile(next);
      setProfile(next);
      pushProfile(next); // mirror the edit to the backup (no-op when sync is off)
    },
    [profile],
  );

  const resetProfile = useCallback(async () => {
    await clearProfile();
    clearProfileBackup(); // so restore can't undo the reset on next launch
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ profile, isHydrated, saveDetails, resetProfile }),
    [profile, isHydrated, saveDetails, resetProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

/** Access the veteran profile. Must be used within a ProfileProvider. */
export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
