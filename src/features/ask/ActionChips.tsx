import { View, StyleSheet } from 'react-native';
import { Chip } from '@/components';
import { spacing } from '@/theme';
import type { ChatAction } from '@/services/ai';
import { actionPresentation } from '@/services/ai/chatActions';
import { ActionPill } from '@/features/resources/ActionPill';
import { CrisisBanner } from '@/features/resources/CrisisBanner';

type ActionChipsProps = {
  actions: ChatAction[];
  followUps: string[];
  /** Only the latest reply offers follow-ups; earlier ones keep their actions. */
  showFollowUps: boolean;
  onAction: (action: Exclude<ChatAction, { kind: 'crisis' }>) => void;
  onFollowUp: (text: string) => void;
};

/**
 * What a reply lets the veteran do next.
 *
 * Actions are olive `ActionPill`s — the same control that calls or saves a
 * resource, because these are actions and olive owns actions. The crisis line
 * is not a pill: `CrisisBanner compact` already is the 988 affordance (44pt,
 * labelled, red only in the glyph), and it sits above the pills on its own row
 * so it is never the third thing in a list. Follow-ups are plain chips in the
 * veteran's voice; tapping one sends it.
 */
export function ActionChips({
  actions,
  followUps,
  showFollowUps,
  onAction,
  onFollowUp,
}: ActionChipsProps) {
  const crisis = actions.some((a) => a.kind === 'crisis');
  const pills = actions.filter((a): a is Exclude<ChatAction, { kind: 'crisis' }> => a.kind !== 'crisis');
  const chips = showFollowUps ? followUps : [];
  if (!crisis && pills.length === 0 && chips.length === 0) return null;

  return (
    <View style={styles.root}>
      {crisis ? <CrisisBanner compact /> : null}
      {pills.length > 0 ? (
        <View style={styles.row}>
          {pills.map((action) => {
            const { icon, label } = actionPresentation(action);
            const key = action.kind === 'results' ? `results:${action.category}` : action.kind;
            return <ActionPill key={key} icon={icon} label={label} onPress={() => onAction(action)} />;
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
  root: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
