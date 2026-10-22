import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii, spacing, withAlpha } from '@/theme';
import { riseIn } from '@/theme/motionPresets';
import { AppText } from './AppText';
import { describeDataError } from './ErrorState';
import { PressableScale } from './PressableScale';

type RefreshFailedBannerProps = {
  /** The failure, so the line can name it (offline, timed out, our fault). */
  error?: unknown;
  onRetry: () => void;
};

/**
 * A quiet strip for a refresh that failed while the screen already had results.
 *
 * The full-screen `ErrorState` is the right answer when there is nothing to
 * show. It is the wrong one when a veteran has a list of nearby help on screen
 * and a background refresh fails: replacing that list with an apology takes away
 * working information they could have acted on. This keeps the list and reports
 * the failure at the top, where it can be ignored or retried.
 */
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
        <Ionicons name="cloud-offline-outline" size={16} color={colors.textSecondary} />
        <View style={styles.copy}>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {title} — showing what we already had
          </AppText>
        </View>
        {/* `accentPressed`, not `accent`: at 12px on the warning wash over paper
            the plain olive measures 3.85:1, under the 4.5:1 small-text bar. This
            is the same substitution the map's filter chips make. */}
        <AppText variant="caption" color="accentPressed">
          Try again
        </AppText>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Amber, not red: nothing is broken for the veteran — the list below is still
  // usable — so this sits in the same "check the source" register the
  // verification chips use.
  // No horizontal margin: the screen insets this. It used to carry `spacing.xl`
  // itself, which on Results — already padded by `ScreenContainer` — sat the
  // strip a full gutter narrower than the cards under it.
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.warningSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(colors.warning, 0.35),
  },
  copy: { flex: 1 },
});
