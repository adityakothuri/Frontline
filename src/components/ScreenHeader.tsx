import type { ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { colors, durations, spacing } from '@/theme';
import { fadeIn, ruleDraw } from '@/theme/motionPresets';
import { AppText } from './AppText';
import { LocationButton } from './LocationButton';

type ScreenHeaderProps = {
  title: string;
  /** One line that states a fact ("207 places near 78701"). */
  subtitle?: string;
  /** Set when the subtitle is live, so changes fade in rather than swap. */
  subtitleKey?: string;
  /** The ZIP line above the title, where location scopes what is shown. */
  location?: { zip?: string; onPress: () => void };
  /** Optional trailing control aligned to the title's right edge. */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

// The masthead every tab opens with: ZIP line, condensed caps title, one live
// fact, then the heavy rule that every screen's content hangs from.
export function ScreenHeader({
  title,
  subtitle,
  subtitleKey,
  location,
  action,
  style,
}: ScreenHeaderProps) {
  const reduceMotion = useReducedMotion();
  return (
    <View style={[styles.root, style]}>
      {location ? <LocationButton zip={location.zip} onPress={location.onPress} /> : null}
      <View style={styles.titleRow}>
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
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
      <Animated.View entering={reduceMotion ? undefined : ruleDraw} style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: spacing.xl },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { flexShrink: 1, textTransform: 'uppercase' },
  subtitle: { marginTop: spacing.xs },
  rule: {
    height: 2,
    backgroundColor: colors.rule,
    marginTop: spacing.md,
    transformOrigin: 'left',
  },
});
