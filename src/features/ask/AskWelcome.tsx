import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText, NavigatorDisclaimer, PressableScale, SectionHeader } from '@/components';
import { AI_NOT_ADVICE_DISCLAIMER } from '@/services/ai';
import { colors, pressScale, rise, spacing } from '@/theme';
import { riseIn } from '@/theme/motionPresets';
import { ActionPill } from '@/features/resources/ActionPill';
import { ASK_STARTERS } from './askStarters';

type AskWelcomeProps = {
  firstName?: string;
  zip?: string;
  onStarter: (text: string) => void;
  onProfile: () => void;
};

/**
 * The empty conversation: the question, one line on what happens next, and a
 * ruled list of things a veteran might say. A starter tap sends straight away.
 * Without a ZIP it offers the profile, since nothing local can be found yet.
 */
export function AskWelcome({ firstName, zip, onStarter, onProfile }: AskWelcomeProps) {
  return (
    <Animated.View entering={riseIn(0, rise.md)} style={styles.root}>
      <View style={styles.copy}>
        <AppText variant="title" accessibilityRole="header">
          {firstName
            ? `Hi ${firstName}. What do you need help with?`
            : 'What do you need help with?'}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {zip
            ? `Say it in your own words — I'll point you to real places near ${zip}.`
            : "Say it in your own words — I'll point you to real places near you. Add your ZIP in Profile for local results."}
        </AppText>
      </View>
      {!zip ? (
        <View style={styles.row}>
          <ActionPill label="Add my ZIP" onPress={onProfile} />
        </View>
      ) : null}
      <View>
        <SectionHeader title="Or start with" style={styles.startersHeader} />
        {ASK_STARTERS.map((starter, index) => (
          <PressableScale
            key={starter.text}
            accessibilityRole="button"
            accessibilityHint="Sends this to Frontline"
            onPress={() => onStarter(starter.text)}
            scaleTo={pressScale.subtle}
            // The disclaimer's own rule closes the list.
            style={[styles.starter, index === ASK_STARTERS.length - 1 && styles.lastStarter]}
          >
            <AppText variant="bodyStrong" style={styles.starterText}>
              {starter.text}
            </AppText>
            <AppText variant="data" color="accent">
              ▸
            </AppText>
          </PressableScale>
        ))}
      </View>
      {/* Read before the first turn; it shows once more after the first reply. */}
      <NavigatorDisclaimer text={AI_NOT_ADVICE_DISCLAIMER} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xl, paddingTop: spacing.sm },
  copy: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  startersHeader: { marginBottom: spacing.xs },
  starter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  starterText: { flex: 1 },
  lastStarter: { borderBottomWidth: 0 },
});
