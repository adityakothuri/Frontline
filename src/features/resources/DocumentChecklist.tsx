import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText, Glyph, PressableScale } from '@/components';
import { colors, pressScale, spacing } from '@/theme';
import { tapSelection } from '@/lib/haptics';
import { humanizeDocument, VETERAN_DOCUMENT_LABELS, type VeteranDocument } from '@/types/need';

type DocumentChecklistProps = {
  /** Document keys the listing itself names (`dd214`, `photo_id`, …). */
  documents: string[];
  /** Documents the AI plan suggests; merged after the listing's, deduped by label. */
  suggested?: string[];
  /** Documents the veteran said they have; those rows arrive pre-ticked. */
  onHand?: VeteranDocument[];
};

type Item = { key: string; label: string; have: boolean };

/**
 * "What should I bring?" — rows to tick off before going. State is local and not
 * persisted (a packing aid, not saved data).
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
        // Strike-through only for the veteran's own ticks: owning is not packing.
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
            <View style={[styles.box, checked && styles.boxOn]}>
              {checked ? <Glyph name="check" size={16} color={colors.surface} /> : null}
            </View>
            <View style={styles.text}>
              <AppText
                variant="body"
                color={packed ? 'textSecondary' : 'textPrimary'}
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

/** Merges listing keys, then plan suggestions (minus repeats), with owned rows
 *  sunk to the bottom so the top of the list is what is left to find. */
function buildItems(documents: string[], suggested: string[], onHand: VeteranDocument[]): Item[] {
  const owned = onHand.map((doc) => VETERAN_DOCUMENT_LABELS[doc].toLowerCase());
  // One direction only: the label must contain the owned name, or a one-word
  // suggestion like "ID" would match photo ID.
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
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  box: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  text: { flex: 1, gap: spacing.xxs },
  checkedText: { textDecorationLine: 'line-through' },
});
