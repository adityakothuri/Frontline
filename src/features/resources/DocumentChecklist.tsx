import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from '@/components';
import { colors, spacing } from '@/theme';
import { humanizeDocument } from '@/types/need';

type DocumentChecklistProps = {
  documents: string[];
};

// "What should I bring?" — checkable rows a veteran can tick off before they go.
// State is local and intentionally not persisted (a packing aid, not saved data).
export function DocumentChecklist({ documents }: DocumentChecklistProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  if (documents.length === 0) {
    return (
      <AppText variant="body" color="textSecondary">
        No specific documents are required. A photo ID is usually helpful, even when nothing is
        asked for.
      </AppText>
    );
  }

  const toggle = (doc: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(doc)) {
        next.delete(doc);
      } else {
        next.add(doc);
      }
      return next;
    });

  return (
    <View style={styles.list}>
      {documents.map((doc) => {
        const isChecked = checked.has(doc);
        return (
          <Pressable
            key={doc}
            accessibilityRole="checkbox"
            accessibilityLabel={doc}
            accessibilityState={{ checked: isChecked }}
            onPress={() => toggle(doc)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Ionicons
              name={isChecked ? 'checkbox' : 'square-outline'}
              size={22}
              color={isChecked ? colors.accent : colors.textMuted}
            />
            <AppText
              variant="body"
              color={isChecked ? 'textMuted' : 'textPrimary'}
              style={isChecked ? styles.checkedText : undefined}
            >
              {humanizeDocument(doc)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowPressed: { opacity: 0.6 },
  checkedText: { textDecorationLine: 'line-through' },
});
