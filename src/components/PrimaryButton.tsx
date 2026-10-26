import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

// The one filled action on a screen: square olive block, caps label.
// `secondary` is an ink outline for the quieter alternative.
export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: PrimaryButtonProps) {
  const isSecondary = variant === 'secondary';
  const inactive = disabled || loading;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      accessibilityLabel={label}
      disabled={inactive}
      onPress={onPress}
      style={style}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.base,
            isSecondary ? styles.secondary : styles.primary,
            pressed && !inactive && (isSecondary ? styles.secondaryPressed : styles.primaryPressed),
            inactive && styles.disabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={isSecondary ? colors.textPrimary : colors.textOnAccent} />
          ) : (
            <AppText
              variant="label"
              color={isSecondary ? 'textPrimary' : 'textOnAccent'}
              style={styles.label}
            >
              {label}
            </AppText>
          )}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
  },
  label: { fontSize: 15, letterSpacing: 0.8, textTransform: 'uppercase' },
  primary: { backgroundColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accentPressed },
  secondary: { borderWidth: 1.5, borderColor: colors.textPrimary },
  secondaryPressed: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.45 },
});
