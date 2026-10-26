import { View, StyleSheet } from 'react-native';
import { AppText, Chip, PressableScale } from '@/components';
import { colors, pressScale, spacing } from '@/theme';
import { tapSelection } from '@/lib/haptics';
import type { ChatAction } from '@/services/ai';
import { NEED_CATEGORY_META } from '@/types/need';
import { CrisisBanner } from '@/features/resources/CrisisBanner';

type StepAction = Exclude<ChatAction, { kind: 'crisis' }>;

type ActionChipsProps = {
  actions: ChatAction[];
  followUps: string[];
  /** Only the latest reply offers follow-ups; earlier ones keep their actions. */
  showFollowUps: boolean;
  onAction: (action: StepAction) => void;
  onFollowUp: (text: string) => void;
};

/** How a step is labelled and announced. The crisis action is `CrisisBanner`'s. */
function actionPresentation(action: StepAction): { label: string; hint: string } {
  switch (action.kind) {
    case 'results':
      return {
        label: action.label,
        hint: `Opens nearby places for ${NEED_CATEGORY_META[action.category].label}`,
      };
    case 'map':
      return { label: 'Open the map', hint: 'Opens the map tab' };
    case 'profile':
      return {
        label: 'Update my profile',
        hint: 'Opens your profile to change your ZIP, radius or documents',
      };
  }
}

/**
 * A reply's next steps (olive, numbered) and follow-up chips that send on tap.
 * The crisis action renders as `CrisisBanner compact` above the list, not a step.
 */
export function ActionChips({
  actions,
  followUps,
  showFollowUps,
  onAction,
  onFollowUp,
}: ActionChipsProps) {
  const crisis = actions.some((a) => a.kind === 'crisis');
  const pills = actions.filter((a): a is StepAction => a.kind !== 'crisis');
  const chips = showFollowUps ? followUps : [];
  if (!crisis && pills.length === 0 && chips.length === 0) return null;

  return (
    <View style={styles.root}>
      {crisis ? <CrisisBanner compact /> : null}
      {pills.length > 0 ? (
        <View style={styles.steps}>
          {pills.map((action, i) => {
            const { label, hint } = actionPresentation(action);
            const key = action.kind === 'results' ? `results:${action.category}` : action.kind;
            return (
              <PressableScale
                key={key}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint={hint}
                onPress={() => {
                  tapSelection();
                  onAction(action);
                }}
                scaleTo={pressScale.subtle}
                style={styles.step}
              >
                <AppText variant="data" color="textSecondary">
                  {String(i + 1).padStart(2, '0')}
                </AppText>
                <AppText variant="bodyStrong" color="accent" style={styles.stepLabel}>
                  {label}
                </AppText>
                <AppText variant="data" color="accent">
                  ▸
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      ) : null}
      {chips.length > 0 ? (
        <View style={styles.row}>
          {chips.map((text) => (
            <Chip key={text} label={text} onPress={() => onFollowUp(text)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  steps: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stepLabel: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
