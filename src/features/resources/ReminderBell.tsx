import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Glyph, PressableScale } from '@/components';
import { colors, durations, pressScale, springs } from '@/theme';
import { isRemindable, useReminders } from '@/services/reminders';
import type { Resource } from '@/types/resource';
import { ReminderSheet } from './ReminderSheet';

type ReminderBellProps = {
  resource: Resource;
};

/** Asks before an unsave also cancels a reminder; keeping it is the default. */
export function confirmUnsaveWithReminder(resourceName: string, onDropReminder: () => void) {
  Alert.alert(
    'Reminder still on',
    `You'll still be reminded before ${resourceName} opens. Turn that off too?`,
    [
      { text: 'Keep reminder', style: 'cancel' },
      { text: 'Turn it off', style: 'destructive', onPress: onDropReminder },
    ],
  );
}

/**
 * The reminder bell. Renders nothing unless the hours are good enough to remind
 * against. Its motion (a glyph kick, no ring) is deliberately quieter than save's.
 */
export function ReminderBell({ resource }: ReminderBellProps) {
  const { isReminded } = useReminders();
  const [sheetOpen, setSheetOpen] = useState(false);

  const armed = isReminded(resource.id);
  const scale = useSharedValue(1);
  const wasArmed = useRef(armed);

  useEffect(() => {
    if (armed && !wasArmed.current) {
      scale.set(
        withSequence(
          withTiming(1.25, { duration: durations.micro }),
          withSpring(1, springs.settle),
        ),
      );
    }
    wasArmed.current = armed;
  }, [armed, scale]);

  const glyphStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  if (!isRemindable(resource.hours, resource.category)) return null;

  const label = armed
    ? `Change opening reminder for ${resource.name}`
    : `Remind me when ${resource.name} opens`;

  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: armed }}
        onPress={() => setSheetOpen(true)}
        scaleTo={pressScale.control}
        style={styles.bell}
      >
        <Animated.View style={glyphStyle}>
          <Glyph name="bell" filled={armed} color={armed ? colors.accent : colors.textSecondary} />
        </Animated.View>
      </PressableScale>

      <ReminderSheet resource={resource} visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
