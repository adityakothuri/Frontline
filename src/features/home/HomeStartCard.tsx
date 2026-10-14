import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PressableScale } from '@/components';
import { colors, radii, shadows, spacing } from '@/theme';

/**
 * Home's one action: the product's question, at the size a product's question
 * deserves.
 *
 * This replaced a 2×2 grid of the four most common needs, which had been
 * redesigned five times — labelled cards, smaller tiles, an icon-only row, then
 * a 2×2 at two different wash strengths. Every one of those failed for the same
 * reason, and it was never the wash: four small squares carry no information a
 * veteran can act on, and Discover already owns the category index. Home was a
 * menu pointing at a better menu. So the tiles are gone, and what is left is one
 * unmissable way in — which is also the only thing on this page a veteran who
 * has never used the app before actually needs.
 *
 * Olive, because this is a primary action and olive is the only colour in the
 * app allowed to say so. It is the single olive block on Home; nothing else here
 * competes with it.
 */
export function HomeStartCard() {
  const router = useRouter();

  return (
    <PressableScale
      accessibilityRole="button"
      // Stated explicitly rather than left to composition. `Pressable` is
      // `accessible` by default and merges *every* text descendant into the
      // name, so relying on the visible text would compose the heading and the
      // category list into one twenty-word announcement and then let the hint
      // restate the list a second time. The label still opens with the visible
      // heading verbatim, so Voice Control's "tap what do you need help with"
      // works and WCAG 2.5.3 holds.
      accessibilityLabel="What do you need help with? Food, housing, healthcare, VA benefits, jobs, legal and more."
      // A hint describes the *result* of activating, not the control.
      accessibilityHint="Opens the full list of categories"
      // The same destination the old grid's "Browse all 10 categories" escape
      // hatch used — Discover's full category index. That was the row veterans
      // needed anyway; it has stopped being an afterthought under four tiles.
      onPress={() => router.navigate({ pathname: '/discover', params: { shell: 'other' } })}
    >
      {({ pressed }) => (
        <View style={[styles.card, pressed && styles.cardPressed]}>
          <View style={styles.headingRow}>
            <AppText variant="title" color="textOnAccent" style={styles.heading}>
              What do you need help with?
            </AppText>
            {/* Decorative — the label above names this control. Hidden at the
                wrapper rather than on the glyph itself: the wrapper is the node
                the screen reader traverses, and an Ionicon left exposed is
                occasionally announced as its private-use codepoint. Fixed points
                rather than a proportional size, so the circle keeps its shape
                when Dynamic Type grows the heading beside it. */}
            <View
              style={styles.arrow}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Ionicons name="arrow-forward" size={20} color={colors.textOnAccent} />
            </View>
          </View>

          {/* Naming real categories rather than saying "browse resources": it is
              the fastest way to tell a veteran whether this app is for their
              problem, and it is what the four tiles were trying to do with a
              quarter of the words. `textOnAccent` at full strength, not a dimmed
              variant — grey text on a coloured background is a banned pattern
              here, so the hierarchy is carried by size and weight instead. */}
          <AppText variant="body" color="textOnAccent">
            Food, housing, healthcare, VA benefits, jobs, legal and more.
          </AppText>
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
  // `flex-start`, not `center`: once Dynamic Type wraps the heading to three
  // lines, a centred arrow drifts into the middle of the paragraph.
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heading: { flex: 1 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // A lift of the paper-white text colour, not a second hue — the only thing
    // this needs to do is separate the glyph from the olive behind it.
    //
    // 0.24 is measured, and it is a ceiling rather than a preference. Below it
    // the circle fades out in sunlight (0.16 composites to 1.36:1 against the
    // card, which is barely a shape); above it the arrow *inside* the circle
    // falls under the 3:1 non-text floor this project enforces on its own
    // category hues. 0.24 gives 1.59:1 for the circle and 3.15:1 for the glyph —
    // the only alpha where both hold.
    backgroundColor: 'rgba(251, 248, 240, 0.24)',
  },
});
