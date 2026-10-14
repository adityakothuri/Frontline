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

// One obvious primary action per screen. `secondary` is the quiet outline
// variant. Presses get both a color shift and a slight spring-down — the spring
// now comes from PressableScale rather than a second copy of it here, so a CTA
// and a card feel identical under the thumb.
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
            <AppText variant="subtitle" color={isSecondary ? 'textPrimary' : 'textOnAccent'}>
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
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
  },
  primary: { backgroundColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accentPressed },
  secondary: {
    backgroundColor: colors.transparent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  secondaryPressed: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.5 },
});
