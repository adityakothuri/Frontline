import { useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from '@/theme';
import { AppText } from './AppText';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

// One obvious primary action per screen. `secondary` is the quiet outline
// variant. Presses get both a color shift and a slight spring-down, so every
// CTA in the app feels tactile the same way cards do (PressableScale).
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
  const [scale] = useState(() => new Animated.Value(1));

  const spring = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 5 }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => spring(0.97)}
      onPressOut={() => spring(1)}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.base,
            isSecondary ? styles.secondary : styles.primary,
            pressed && (isSecondary ? styles.secondaryPressed : styles.primaryPressed),
            inactive && styles.disabled,
            style,
            { transform: [{ scale }] },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={isSecondary ? colors.textPrimary : colors.textOnAccent} />
          ) : (
            <AppText variant="subtitle" color={isSecondary ? 'textPrimary' : 'textOnAccent'}>
              {label}
            </AppText>
          )}
        </Animated.View>
      )}
    </Pressable>
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
