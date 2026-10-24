import { useEffect, useState } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { OptionGroup, TextField } from '@/components';
import { useProfile } from '@/services/profile';
import { stateFromZip } from '@/lib/zipState';
import { OnboardingWelcome } from '@/features/onboarding/OnboardingWelcome';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { OnboardingComplete } from '@/features/onboarding/OnboardingComplete';
import { ROLE_OPTIONS, RADIUS_OPTIONS, type VeteranRole } from '@/types/profile';
import { DOCUMENT_OPTIONS, type VeteranDocument } from '@/types/need';

type Draft = {
  firstName: string;
  zip: string;
  role?: VeteranRole;
  documentsOnHand: VeteranDocument[];
  preferredRadiusMiles?: number;
};

// The 5 questions that carry a progress bar (welcome + finish bookend it).
const PROMPTS = 5;

// The full one-time setup flow: a welcome, one prompt per screen, then "Finish
// setup" which saves the profile. Held in a draft, saved once at the end.
export default function OnboardingScreen() {
  const router = useRouter();
  const { saveDetails } = useProfile();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({ firstName: '', zip: '', documentsOnHand: [] });
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  // So each step's progress bar animates from where it was (screen step N is
  // prompt N-1). State, not a ref: it's read during render.
  const [prevStep, setPrevStep] = useState(0);
  const go = (to: number) => {
    setPrevStep(step);
    setStep(Math.max(0, to));
  };
  const next = () => go(step + 1);
  const back = () => go(step - 1);
  const prevIndex = prevStep - 1;

  // The hardware back button steps back through the wizard instead of leaving
  // the route — on the welcome screen it falls through to the OS.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      go(step - 1);
      return true;
    });
    return () => subscription.remove();
    // `go` reads `step` from this render; the listener is rebuilt per step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Five digits isn't enough (`00000`): the ZIP must map to a state, the same
  // table search uses.
  const zipComplete = draft.zip.length === 5;
  const zipValid = zipComplete && stateFromZip(draft.zip) !== null;

  const create = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveDetails({
        firstName: draft.firstName,
        zip: draft.zip,
        role: draft.role,
        documentsOnHand: draft.documentsOnHand.length ? draft.documentsOnHand : undefined,
        preferredRadiusMiles: draft.preferredRadiusMiles,
      });
      router.replace('/home');
    } catch {
      // Rare (the save is on-device), but never leave a spinning button.
      Alert.alert(
        'Couldn’t finish setup',
        'Something went wrong saving your details. Please try again.',
      );
      setSaving(false);
    }
  };

  switch (step) {
    case 0:
      return <OnboardingWelcome onStart={next} />;
    case 1:
      return (
        <OnboardingStep
          key={step}
          stepIndex={0}
          previousStepIndex={prevIndex}
          stepCount={PROMPTS}
          title="What should we call you?"
          subtitle="Just a first name so Frontline can greet you. Nothing sensitive."
          onBack={back}
          onContinue={next}
          canContinue={draft.firstName.trim().length > 0}
        >
          <TextField
            label="First name"
            value={draft.firstName}
            onChangeText={(t) => set({ firstName: t })}
            placeholder="e.g. Marcus"
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            maxLength={40}
            returnKeyType="next"
            onSubmitEditing={() => draft.firstName.trim() && next()}
          />
        </OnboardingStep>
      );
    case 2:
      return (
        <OnboardingStep
          key={step}
          stepIndex={1}
          previousStepIndex={prevIndex}
          stepCount={PROMPTS}
          title="Where are you looking for help?"
          subtitle="Your ZIP code finds resources near you — used only for that."
          onBack={back}
          onContinue={next}
          canContinue={zipValid}
        >
          <TextField
            label="ZIP code"
            value={draft.zip}
            onChangeText={(t) => set({ zip: t.replace(/[^0-9]/g, '') })}
            placeholder="e.g. 90015"
            keyboardType="number-pad"
            maxLength={5}
            returnKeyType="next"
            onSubmitEditing={() => zipValid && next()}
            hint={
              zipComplete && !zipValid
                ? 'That doesn’t look like a US ZIP code — check the digits.'
                : 'Required — so we can show help nearby.'
            }
          />
        </OnboardingStep>
      );
    case 3:
      return (
        <OnboardingStep
          key={step}
          stepIndex={2}
          previousStepIndex={prevIndex}
          stepCount={PROMPTS}
          title="Which best describes you?"
          subtitle="Optional — so Frontline knows who it’s talking to."
          onBack={back}
          onSkip={next}
          onContinue={next}
          canContinue
        >
          <OptionGroup
            variant="row"
            options={ROLE_OPTIONS}
            value={draft.role}
            onChange={(v) => set({ role: v })}
          />
        </OnboardingStep>
      );
    case 4:
      return (
        <OnboardingStep
          key={step}
          stepIndex={3}
          previousStepIndex={prevIndex}
          stepCount={PROMPTS}
          title="Which of these do you have?"
          subtitle="Optional — tick what you already have, and each place’s checklist will show what’s left to find."
          onBack={back}
          onSkip={next}
          onContinue={next}
          canContinue
        >
          <OptionGroup
            variant="row"
            multiple
            options={DOCUMENT_OPTIONS}
            value={draft.documentsOnHand}
            onChange={(v) => set({ documentsOnHand: v })}
          />
        </OnboardingStep>
      );
    case 5:
      return (
        <OnboardingStep
          key={step}
          stepIndex={4}
          previousStepIndex={prevIndex}
          stepCount={PROMPTS}
          title="How far should we look?"
          subtitle="Optional — your preferred search distance. You can change it anytime."
          onBack={back}
          onSkip={next}
          onContinue={next}
          canContinue
        >
          <OptionGroup
            options={RADIUS_OPTIONS}
            value={draft.preferredRadiusMiles}
            onChange={(v) => set({ preferredRadiusMiles: v })}
          />
        </OnboardingStep>
      );
    default:
      return <OnboardingComplete draft={draft} onBack={back} onCreate={create} loading={saving} />;
  }
}
