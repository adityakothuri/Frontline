import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, rise, spacing, radii } from '@/theme';
import { riseIn } from '@/theme/motionPresets';
import { AppText } from './AppText';
import { PrimaryButton } from './PrimaryButton';

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

// A polished, reassuring empty state — not a blank screen. Orients the user and
// says what will appear here once the feature is live. It arrives the way
// content does (`riseIn`), because it *is* the content of a screen with nothing
// to list — snapping in beside lists that rise read as a glitch.
export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Animated.View entering={riseIn(0, rise.md)} style={styles.root}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={colors.accent} />
      </View>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary" style={styles.message}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <PrimaryButton
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={styles.action}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  // A warm olive medallion, not a cold gray circle — the empty state should
  // reassure, not read as an error.
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  message: { textAlign: 'center', maxWidth: 300 },
  action: { marginTop: spacing.lg, paddingHorizontal: spacing.xxl },
});
