import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, spacing } from '@/theme';
import { riseIn } from '@/theme/motionPresets';
import { AppText } from './AppText';
import { describeDataError } from './ErrorState';
import { PressableScale } from './PressableScale';

type RefreshFailedBannerProps = {
  /** The failure, so the line can name it (offline, timed out, our fault). */
  error?: unknown;
  onRetry: () => void;
};

/** A quiet strip for a failed refresh when results are already on screen; the
 *  list stays usable instead of being replaced by `ErrorState`. */
export function RefreshFailedBanner({ error, onRetry }: RefreshFailedBannerProps) {
  const { title } = describeDataError(error);

  return (
    <Animated.View entering={riseIn()}>
      <PressableScale
        style={styles.root}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={`${title}. Tap to try again.`}
      >
        <View style={styles.copy}>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {title} — showing what we already had
          </AppText>
        </View>
        {/* `accentPressed`: on the amber wash plain olive falls under 4.5:1. */}
        <AppText variant="data" color="accentPressed">
          Try again ▸
        </AppText>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Amber, not red: the list below still works. No horizontal margin; the
  // screen insets it.
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.warningSoft,
    borderWidth: 1.5,
    borderColor: colors.warning,
  },
  copy: { flex: 1 },
});
