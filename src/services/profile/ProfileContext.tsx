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

// The single source of truth for the on-device veteran profile.
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
  // Lets the late backup restore see a profile written since mount, without
  // making `profile` a dependency of the mount-once effect.
  const profileRef = useRef<VeteranProfile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let active = true;
    loadProfile()
      .then((stored) => {
        if (!active) return;
        if (stored) {
          setProfile(stored);
          setIsHydrated(true);
          return;
        }
        // No local profile: hydrate now rather than block on a cold `sync`
        // round trip (up to 12s), and let a restore land afterwards.
        setIsHydrated(true);
        return restoreProfile(null).then((restored) => {
          // A profile written while the pull was in flight is newer; keep it.
          if (!active || !restored || profileRef.current) return;
          setProfile(restored);
          // Mirror the restore back so the backup's updated_at advances.
          saveProfile(restored);
          pushProfile(restored);
        });
      })
      .catch(() => {
        // isHydrated gates first-run routing, so it must never stay false.
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
