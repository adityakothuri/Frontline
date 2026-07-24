import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useProfile } from '@/services/profile';

// Entry gate — no UI. Once the stored profile is read, route straight to the
// account-creation flow (first run) or Home (returning users). The native splash
// covers this frame, so returning users never see a flash.
export default function IndexGate() {
  const router = useRouter();
  const { profile, isHydrated } = useProfile();

  useEffect(() => {
    if (!isHydrated) return;
    router.replace(profile?.onboardingComplete ? '/home' : '/onboarding');
  }, [isHydrated, profile, router]);

  return null;
}
