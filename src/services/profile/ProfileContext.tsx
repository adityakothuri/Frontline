import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ProfileDetails, VeteranProfile } from '@/types/profile';
import { clearProfile, loadProfile, saveProfile } from './profileStorage';

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

  useEffect(() => {
    let active = true;
    loadProfile().then((stored) => {
      if (!active) return;
      setProfile(stored);
      setIsHydrated(true);
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
    },
    [profile],
  );

  const resetProfile = useCallback(async () => {
    await clearProfile();
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
