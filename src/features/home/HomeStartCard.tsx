import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Glyph, PressableScale } from '@/components';
import { colors, radii, spacing } from '@/theme';
import { ASK_PLACEHOLDER } from '@/features/ask/askStarters';

/** Home's one action: opens Ask Frontline with the composer focused (`?focus=1`).
 *  The field is drawn like the real composer it opens. */
export function HomeStartCard() {
  const router = useRouter();

  return (
    <PressableScale
      accessibilityRole="button"
      // Opens with the visible heading verbatim, so Voice Control's "tap what do
      // you need help with" works (WCAG 2.5.3).
      accessibilityLabel="What do you need help with? Ask Frontline in your own words — food, housing, healthcare, VA benefits, jobs, legal and more."
      accessibilityHint="Opens Ask Frontline, a guided conversation"
      onPress={() => router.push({ pathname: '/ask', params: { focus: '1' } })}
    >
      {({ pressed }) => (
        <View style={styles.root}>
          <AppText variant="title" style={styles.question}>
            What do you need help with?
          </AppText>

          {/* Decorative for a screen reader: the whole block is one button. */}
          <View
            style={[styles.field, pressed && styles.fieldPressed]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <AppText variant="body" color="textSecondary" style={styles.placeholder}>
              {ASK_PLACEHOLDER}
            </AppText>
            <View style={styles.send}>
              <Glyph name="arrowRight" size={20} color={colors.textOnAccent} />
            </View>
          </View>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  question: { textTransform: 'uppercase' },
  // `minHeight`, not `height`, so Dynamic Type wraps the placeholder.
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  fieldPressed: { backgroundColor: colors.surfaceMuted },
  placeholder: { flex: 1 },
  send: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
});
