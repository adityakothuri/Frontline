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
 * The reminder sheet. Permission and the notification budget pick its state:
 * ask, denied (links to Settings), full, or configure. None is a dead end.
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

  // Re-seed from the stored preference each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setLead(existing?.lead ?? DEFAULT_LEAD);
    setWarnBeforeClosing(existing?.warnBeforeClosing ?? false);
    // Depending on `existing` would reset in-progress choices on context updates.
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

  const onConfirm = () => {
    setReminder(resource.id, toReminderSnapshot(resource), { lead, warnBeforeClosing });
    close();
  };

  const onTurnOff = () => {
    clearReminder(resource.id);
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
          <AppText variant="kicker" color="textSecondary">
            Notify me
          </AppText>
          <OptionGroup options={LEAD_CHOICES} value={lead} onChange={setLead} />
        </View>

        <SelectableOption
          label="Also warn me before it closes"
          description="An hour before the doors shut, on days it's open long enough."
          multiple
          selected={warnBeforeClosing}
          onPress={() => setWarnBeforeClosing((on) => !on)}
        />

        {/* Same hedge as the card: a notification must not claim more certainty. */}
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  field: { gap: spacing.sm },
});
