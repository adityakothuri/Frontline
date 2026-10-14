import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, durations, radii, springs } from '@/theme';
import { isRemindable, useReminders } from '@/services/reminders';
import type { Resource } from '@/types/resource';
import { ActionPill } from './ActionPill';
import { ReminderSheet } from './ReminderSheet';

type ReminderBellProps = {
  resource: Resource;
  /** `pill` sits in the detail action row; `icon` sits beside a card's bookmark. */
  shape: 'pill' | 'icon';
};

/**
 * Asks before dropping a reminder along with the save.
 *
 * Exported for the two save controls to call, because un-saving is the one path
 * that can cancel a reminder the veteran never touched. Silently cancelling
 * something they set up is the worse failure of the two, so keeping it is the
 * default and the destructive option has to be chosen.
 */
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
 * The bell.
 *
 * It renders nothing at all when the resource can't carry a reminder — unknown
 * hours, a 24/7 line, a job posting — which is most of the catalogue. That
 * silence is the point: where a bell *does* appear, the hours behind it are
 * good enough to act on.
 *
 * Motion is deliberately quieter than the bookmark's. Saving gets the glyph kick
 * *and* the expanding ring; arming a reminder gets the kick alone. Two full
 * celebrations on one card would be the reward-on-every-tap pattern the
 * anti-slop rules ban, and the save is the louder of the two beats.
 */
export function ReminderBell({ resource, shape }: ReminderBellProps) {
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

  const icon = armed ? 'notifications' : 'notifications-outline';
  const label = armed
    ? `Change opening reminder for ${resource.name}`
    : `Remind me when ${resource.name} opens`;

  return (
    <>
      {shape === 'pill' ? (
        <ActionPill
          icon={icon}
          label={armed ? 'Reminder on' : 'Remind me'}
          active={armed}
          selected={armed}
          onPress={() => setSheetOpen(true)}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: armed }}
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [styles.bell, pressed && styles.bellPressed]}
        >
          <Animated.View style={glyphStyle}>
            <Ionicons name={icon} size={18} color={armed ? colors.accent : colors.textMuted} />
          </Animated.View>
        </Pressable>
      )}

      <ReminderSheet resource={resource} visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  // The same real 44pt target the bookmark beside it meets.
  bell: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  bellPressed: { opacity: 0.5 },
});
