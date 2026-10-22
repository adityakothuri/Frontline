import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AiMark, AiWash, AppText, PressableScale } from '@/components';
import { colors, radii, shadows, spacing } from '@/theme';
import { ASK_PLACEHOLDER } from '@/features/ask/askStarters';

/**
 * Home's one action: the product's question, now answered in the veteran's
 * own words.
 *
 * It used to open Discover's category index — a menu pointing at a better
 * menu. It now opens Ask Frontline, where "I'm about to lose my housing"
 * gets a plain-English reply that ends in the housing results, the map, or
 * the crisis line. Discover still owns the category index, one tab away.
 *
 * The paper pill at the foot is drawn as an input because the screen it opens
 * puts the real one in the same place, focused — the tap lands on the real
 * version of the object it touched. (Ask reads `?focus=1` for exactly that.)
 * So it is drawn *exactly*: `Composer`'s 48pt surface pill with its 40pt olive
 * send disc at the trailing edge, not an approximation with a bare arrow.
 * Solid paper on olive is the only construction that passes: the pill is
 * 4.99:1 against the card, its placeholder in `accentPressed` is 6.93:1, and
 * a lightened-olive field with paper text never reaches AA at any alpha.
 *
 * Olive, because this is a primary action and olive is the only colour in the
 * app allowed to say so. It is the single olive block on Home — and under the
 * AI wash, because what it opens is the one place on Home a model speaks. The
 * wash is the identity layer (like a category hue), the olive underneath is
 * still the action; a flat olive slab read as a button, and this is a doorway.
 * The paper pill stays solid: the 4.99:1 lives on it, not on the wash.
 */
export function HomeStartCard() {
  const router = useRouter();

  return (
    <PressableScale
      accessibilityRole="button"
      // Opens with the visible heading verbatim, so Voice Control's "tap what do
      // you need help with" works and WCAG 2.5.3 holds; the rest names what the
      // conversation can do, since the eyebrow and placeholder are decorative
      // to a screen reader.
      accessibilityLabel="What do you need help with? Ask Frontline in your own words — food, housing, healthcare, VA benefits, jobs, legal and more."
      accessibilityHint="Opens Ask Frontline, a guided conversation"
      onPress={() => router.push({ pathname: '/ask', params: { focus: '1' } })}
    >
      {({ pressed }) => (
        <View style={[styles.card, pressed && styles.cardPressed]}>
          <AiWash tone="deep" style={styles.corners} />
          {/* An eyebrow beside its glyph, inline — never a tile above a heading. */}
          <View style={styles.eyebrow}>
            <AiMark size={16} on="deep" />
            <AppText variant="label" color="textOnAccent">
              Ask Frontline
            </AppText>
          </View>

          <AppText variant="title" color="textOnAccent">
            What do you need help with?
          </AppText>

          {/* Decorative for a screen reader: the card is one button, named above.
              `minHeight`, not `height`, so Dynamic Type wraps the placeholder
              rather than clipping it. */}
          <View
            style={styles.field}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <AppText variant="body" color="accentPressed" style={styles.placeholder}>
              {ASK_PLACEHOLDER}
            </AppText>
            <View style={styles.send}>
              <Ionicons name="arrow-up" size={20} color={colors.textOnAccent} />
            </View>
          </View>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    // `md`, not the `sm` every resting card uses. This is the one control on the
    // page rather than a surface holding content, and it has to sit above the
    // paper the way a button does.
    ...shadows.md,
  },
  cardPressed: { backgroundColor: colors.accentPressed },
  // The wash clips itself to these, so the card keeps its shadow.
  corners: { borderRadius: radii.lg },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // `Composer`'s pill, measure for measure: 48 tall, text inset `lg`, the disc
  // inset `xs` so it sits inside the pill's line.
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    marginTop: spacing.xs,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  placeholder: { flex: 1 },
  send: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
});
