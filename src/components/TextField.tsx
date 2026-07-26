import { View, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { colors, fonts, radii, spacing } from '@/theme';
import { AppText } from './AppText';

type TextFieldProps = TextInputProps & {
  label: string;
  /** Optional helper line under the input. */
  hint?: string;
};

// A labeled text input — the one styled field used across setup + profile.
export function TextField({ label, hint, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.field}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      {/* The visible label is a sibling, so screen readers would otherwise
          announce this input as unlabeled. Naming it explicitly (and appending
          the hint) is what makes onboarding and profile usable with VoiceOver.
          A caller can still override via accessibilityLabel in inputProps. */}
      <TextInput
        accessibilityLabel={hint ? `${label}. ${hint}` : label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...inputProps}
      />
      {hint ? (
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
});
