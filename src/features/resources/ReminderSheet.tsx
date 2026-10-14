import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, OptionGroup, PrimaryButton, SelectableOption } from '@/components';
import { describeHours } from '@/lib/hours';
import { colors, spacing } from '@/theme';
import {
  DEFAULT_LEAD,
  slotCost,
  useReminders,
  type ReminderLead,
  type ReminderPreference,
} from '@/services/reminders';
import type { Resource } from '@/types/resource';
import { sourceStatus, toReminderSnapshot } from './resourceStatus';

type ReminderSheetProps = {
  resource: Resource;
  visible: boolean;
  onClose: () => void;
};

const LEAD_CHOICES: { value: ReminderLead; label: string }[] = [
  { value: 30, label: '30 min before' },
  { value: 0, label: 'When it opens' },
  { value: 15, label: '15 min before' },
  { value: 60, label: '1 hour before' },
];

/**
 * Everything you can say to a reminder, in one sheet.
 *
 * It has four faces, and which one shows is decided by the OS and the budget
 * rather than by navigation: ask for permission, explain a refusal, admit the
 * phone is full, or configure. None of them is a dead end — the denied state
 * links into Settings, and the full state names the screen where reminders can
 * be turned off.
 */
export function ReminderSheet({ resource, visible, onClose }: ReminderSheetProps) {
  const {
    permission,
    requestPermission,
    getPreference,
    setReminder,
    clearReminder,
    slotsRemaining,
  } = useReminders();

  const existing = getPreference(resource.id);
  const [lead, setLead] = useState<ReminderLead>(existing?.lead ?? DEFAULT_LEAD);
  const [warnBeforeClosing, setWarnBeforeClosing] = useState(existing?.warnBeforeClosing ?? false);

  // Re-seed from the stored preference each time the sheet opens, so reopening
  // after a change shows what is actually armed rather than the last draft.
  useEffect(() => {
    if (!visible) return;
    setLead(existing?.lead ?? DEFAULT_LEAD);
    setWarnBeforeClosing(existing?.warnBeforeClosing ?? false);
    // `existing` is read only at the moment the sheet opens; depending on it
    // would reset the veteran's in-progress choice on every context update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const schedule = describeHours(resource.hours);
  const source = sourceStatus(resource).label;

  // What this reminder would cost if armed with the current choices, so the
  // budget check reflects the toggles rather than the stored preference.
  const draft: ReminderPreference = {
    resourceId: resource.id,
    lead,
    warnBeforeClosing,
    enabledAt: existing?.enabledAt ?? new Date().toISOString(),
    snapshot: toReminderSnapshot(resource),
  };
  const cost = slotCost(draft);
  const alreadyUsed = existing ? slotCost(existing) : 0;
  const overBudget = cost - alreadyUsed > slotsRemaining;

  const close = () => onClose();

  const onConfirm = async () => {
    await setReminder(resource.id, toReminderSnapshot(resource), { lead, warnBeforeClosing });
    close();
  };

  const onTurnOff = async () => {
    await clearReminder(resource.id);
    close();
  };

  const body = () => {
    if (permission === 'undetermined') {
      return (
        <View style={styles.section}>
          <AppText variant="body" color="textSecondary">
            Frontline can remind you before {resource.name} opens. The reminder is scheduled on this
            phone — nothing about what you save leaves it, and no one is told you were reminded.
          </AppText>
          <PrimaryButton label="Allow notifications" onPress={requestPermission} />
        </View>
      );
    }

    if (permission === 'denied') {
      return (
        <View style={styles.section}>
          <AppText variant="body" color="textSecondary">
            Notifications are turned off for Frontline, so reminders can&apos;t be delivered. You
            can turn them back on in Settings — nothing else about the app changes.
          </AppText>
          <PrimaryButton
            label="Open Settings"
            variant="secondary"
            onPress={() => Linking.openSettings()}
          />
        </View>
      );
    }

    if (overBudget && !existing) {
      return (
        <View style={styles.section}>
          <AppText variant="body" color="textSecondary">
            Your phone is holding as many reminders as it can. Turn one off in Saved to make room
            for this one — every place you&apos;re being reminded about has a lit bell there.
          </AppText>
          <PrimaryButton label="Done" variant="secondary" onPress={close} />
        </View>
      );
    }

    return (
      <View style={styles.section}>
        {schedule.length > 0 ? (
          <View style={styles.schedule}>
            {schedule.map((line) => (
              <AppText key={line} variant="body" color="textSecondary">
                {line}
              </AppText>
            ))}
          </View>
        ) : null}

        <View style={styles.field}>
          <AppText variant="label" color="textMuted">
            NOTIFY ME
          </AppText>
          <OptionGroup options={LEAD_CHOICES} value={lead} onChange={setLead} />
        </View>

        <SelectableOption
          label="Also warn me before it closes"
          description="An hour before the doors shut, on days it's open long enough."
          icon="time-outline"
          multiple
          selected={warnBeforeClosing}
          onPress={() => setWarnBeforeClosing((on) => !on)}
        />

        {/* The same hedge the card carries. A lock-screen banner must never
            claim more certainty than the screen the veteran read it on. */}
        <AppText variant="caption" color="textMuted">
          Hours come from {source}. Call ahead to confirm. Reminders use your phone&apos;s time
          zone.
        </AppText>

        <PrimaryButton
          label={existing ? 'Update reminder' : 'Turn on reminder'}
          onPress={onConfirm}
        />

        {existing ? (
          <PrimaryButton label="Turn off reminder" variant="secondary" onPress={onTurnOff} />
        ) : null}
      </View>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={close} title={resource.name}>
      {body()}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.lg },
  schedule: {
    gap: spacing.xxs,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.md,
  },
  field: { gap: spacing.sm },
});
