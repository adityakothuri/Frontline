import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText, Chip, NavigatorDisclaimer } from '@/components';
import { AI_NOT_ADVICE_DISCLAIMER } from '@/services/ai';
import { rise, spacing } from '@/theme';
import { riseIn } from '@/theme/motionPresets';
import { NEED_CATEGORY_META } from '@/types/need';
import { ActionPill } from '@/features/resources/ActionPill';
import { ASK_STARTERS } from './askStarters';

type AskWelcomeProps = {
  firstName?: string;
  zip?: string;
  onStarter: (text: string) => void;
  onProfile: () => void;
};

/**
 * The empty conversation: the product's question in its own serif, one line
 * on what happens next, and six things a veteran might say. No AI mark of its
 * own — the stack bar directly above already shows it beside "Ask Frontline",
 * and a large glyph over a heading is the tile-above-heading reflex the design
 * rules name. A starter tap sends — one tap to a reply, no prefill step.
 * Without a ZIP the line says so and offers the profile, because nothing local
 * can be found until it is set.
 */
export function AskWelcome({ firstName, zip, onStarter, onProfile }: AskWelcomeProps) {
  return (
    <Animated.View entering={riseIn(0, rise.md)} style={styles.root}>
      <View style={styles.copy}>
        <AppText variant="title" accessibilityRole="header">
          {firstName ? `Hi ${firstName}. What do you need help with?` : 'What do you need help with?'}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {zip
            ? `Say it in your own words — I'll point you to real places near ${zip}.`
            : "Say it in your own words — I'll point you to real places near you. Add your ZIP in Profile for local results."}
        </AppText>
      </View>
      {!zip ? (
        <View style={styles.row}>
          <ActionPill icon="person-outline" label="Add my ZIP" onPress={onProfile} />
        </View>
      ) : null}
      <View style={styles.row}>
        {ASK_STARTERS.map((starter) => (
          <Chip
            key={starter.text}
            label={starter.text}
            icon={NEED_CATEGORY_META[starter.category].icon}
            onPress={() => onStarter(starter.text)}
          />
        ))}
      </View>
      {/* The AI surface's own line, where it is read before the first turn. It
          shows once more after the first reply, and never pins the footer. */}
      <NavigatorDisclaimer text={AI_NOT_ADVICE_DISCLAIMER} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xl, paddingTop: spacing.sm },
  copy: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
