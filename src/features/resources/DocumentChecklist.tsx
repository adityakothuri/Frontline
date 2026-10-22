import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, spacing } from '@/theme';
import { tapSelection } from '@/lib/haptics';
import { humanizeDocument, VETERAN_DOCUMENT_LABELS, type VeteranDocument } from '@/types/need';

type DocumentChecklistProps = {
  /** Document keys the listing itself names (`dd214`, `photo_id`, …). */
  documents: string[];
  /** Plain-language documents the AI plan suggests bringing. Merged in after the
   *  listing's own, deduplicated by label. */
  suggested?: string[];
  /** What the veteran told us they already have. Those rows arrive pre-ticked
   *  and say so, which is the promise onboarding made when it asked. */
  onHand?: VeteranDocument[];
};

type Item = { key: string; label: string; have: boolean };

/**
 * "What should I bring?" — checkable rows a veteran can tick off before they go.
 * State is local and intentionally not persisted (a packing aid, not saved data).
 *
 * Two inputs the first version threw away: the plan's `whatToBring`, generated
 * for exactly this list and never rendered, and the profile's documents on hand,
 * asked for at onboarding "so we can tell you what to bring" and never read. The
 * rows a veteran already has are ticked and labelled; the rest is what is left
 * to find, which is the only part of the list that is actually a job.
 */
export function DocumentChecklist({
  documents,
  suggested = [],
  onHand = [],
}: DocumentChecklistProps) {
  const items = useMemo(
    () => buildItems(documents, suggested, onHand),
    [documents, suggested, onHand],
  );
  // Ticks the veteran has added themselves, on top of what they already own.
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());

  if (items.length === 0) {
    return (
      <AppText variant="body" color="textSecondary">
        This listing doesn’t name any documents. A photo ID is worth bringing anyway — most places
        ask for one.
      </AppText>
    );
  }

  const toggle = (key: string) => {
    tapSelection();
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <View style={styles.list}>
      {items.map((item) => {
        // An owned row starts ticked and un-ticks on tap ("not with me after
        // all"); every other row starts clear and ticks when packed.
        const checked = item.have ? !ticked.has(item.key) : ticked.has(item.key);
        // Strike-through means "packed, done" and is earned only by a tick the
        // veteran made. Owning a document is not the same as having packed it,
        // so an owned row keeps its full-strength label and says why it is ticked.
        const packed = checked && !item.have;
        return (
          <PressableScale
            key={item.key}
            accessibilityRole="checkbox"
            accessibilityLabel={
              item.have && checked ? `${item.label}, you said you have this` : item.label
            }
            accessibilityState={{ checked }}
            onPress={() => toggle(item.key)}
            scaleTo={pressScale.subtle}
            style={styles.row}
          >
            <Ionicons
              name={checked ? 'checkbox' : 'square-outline'}
              size={22}
              color={checked ? colors.accent : colors.textMuted}
            />
            <View style={styles.text}>
              <AppText
                variant="body"
                color={packed ? 'textMuted' : 'textPrimary'}
                style={packed ? styles.checkedText : undefined}
              >
                {item.label}
              </AppText>
              {item.have ? (
                <AppText variant="caption" color="textSecondary">
                  {checked ? 'You said you have this' : 'Back on your list to find'}
                </AppText>
              ) : null}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * One list from three sources. The listing's keys come first and keep their
 * canonical labels; the plan's suggestions follow, dropped where they repeat a
 * label already present (the model says "your DD-214" for a row the listing
 * calls `dd214`). Rows the veteran owns sink to the bottom: the top of the list
 * is the work.
 */
function buildItems(documents: string[], suggested: string[], onHand: VeteranDocument[]): Item[] {
  const owned = onHand.map((doc) => VETERAN_DOCUMENT_LABELS[doc].toLowerCase());
  // One direction only: the row's label has to contain the owned document's name
  // ("your DD-214 discharge papers" ⊇ "dd-214"). The reverse let a one-word
  // suggestion like "ID" claim to be the veteran's photo ID.
  const has = (label: string) => {
    const l = label.toLowerCase();
    return owned.some((o) => l.includes(o));
  };
  const seen = new Set<string>();
  const items: Item[] = [];
  const push = (key: string, label: string) => {
    const norm = label.trim().toLowerCase();
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    items.push({ key, label: label.trim(), have: has(label) });
  };
  for (const doc of documents) push(`doc:${doc}`, humanizeDocument(doc));
  suggested.forEach((text, i) => push(`ai:${i}`, text));
  return [...items.filter((i) => !i.have), ...items.filter((i) => i.have)];
}

const styles = StyleSheet.create({
  list: { gap: spacing.xxs },
  // A real 44pt row; it was ~30pt of text with 4pt of padding.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  text: { flex: 1, gap: spacing.xxs },
  checkedText: { textDecorationLine: 'line-through' },
});
