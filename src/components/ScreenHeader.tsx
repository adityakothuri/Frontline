import type { ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { durations, spacing } from '@/theme';
import { fadeIn } from '@/theme/motionPresets';
import { AppText } from './AppText';
import { LocationButton } from './LocationButton';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /**
   * Set when the subtitle is live (a count, a place). A new sentence then
   * arrives with a short fade rather than being overwritten in place — the
   * one change on a screen small enough to miss entirely otherwise.
   */
  subtitleKey?: string;
  /** The location pill above the title, on screens where location scopes
   *  what is shown. Omit on screens it does not apply to (Saved). */
  location?: { zip?: string; onPress: () => void };
  /** Optional trailing control (e.g. an icon button) aligned to the title's right edge. */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The masthead every tab opens with: the location pill where location
 * matters, the Fraunces title, and one live Inter line that states a fact
 * ("23 places near 78701", "3 places you want to come back to"). Discover and
 * Map used to hand-roll this block while Saved and Profile used a static
 * version; one implementation is what turns "they happen to look similar" into
 * the thing a veteran recognises on every screen.
 */
export function ScreenHeader({
  title,
  subtitle,
  subtitleKey,
  location,
  action,
  style,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.root, style]}>
      {location ? (
        <View style={styles.location}>
          <LocationButton zip={location.zip} onPress={location.onPress} />
        </View>
      ) : null}
      <View style={styles.titleRow}>
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {action}
      </View>
      {subtitle ? (
        <Animated.View
          key={subtitleKey ?? 'static'}
          entering={subtitleKey ? fadeIn(0, durations.fast) : undefined}
        >
          <AppText variant="body" color="textSecondary" style={styles.subtitle}>
            {subtitle}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: spacing.xl },
  location: { marginBottom: spacing.md },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { flexShrink: 1 },
  subtitle: { marginTop: spacing.sm },
});
