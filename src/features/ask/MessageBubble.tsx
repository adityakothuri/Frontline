import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { AiMark, AiWash, AppText } from '@/components';
import { colors, radii, spacing, withAlpha } from '@/theme';
import { riseIn } from '@/theme/motionPresets';

type MessageBubbleProps = {
  role: 'user' | 'assistant';
  text: string;
};

/**
 * One turn of the conversation.
 *
 * The veteran's turn is an olive-soft tint on the right — the selection
 * vocabulary the chips use, so "mine" reads the same way everywhere. Frontline's
 * turn is the app's card material on the left under the AI wash, with the
 * olive-tinted hairline every AI block wears and the mark and "AI-generated" tag
 * in its header — the same three signals as the guidance blocks on a resource
 * page, so "a model wrote this" looks the same wherever it is true. Inter
 * throughout: the serif is for the names of things, and a reply is not a thing.
 * `selectable` so a reply can be copied into a form or a text message.
 *
 * The tag is `textSecondary`, not `textMuted`: muted drops to 4.3:1 on the wash.
 */
export function MessageBubble({ role, text }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <Animated.View entering={riseIn()} style={styles.userRow}>
        <View style={styles.userBubble}>
          <AppText variant="body" selectable>
            {text}
          </AppText>
        </View>
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={riseIn()} style={styles.assistantRow}>
      <View style={styles.assistantBubble}>
        <AiWash tone="paper" style={styles.assistantCorners} />
        <View style={styles.assistantHeader}>
          <AiMark size={14} />
          {/* One string, so the dot is spaced evenly and VoiceOver reads one
              element rather than two. */}
          <AppText variant="caption" color="textSecondary">
            Frontline · AI-generated
          </AppText>
        </View>
        <AppText variant="body" selectable>
          {text}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '84%',
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    // The one squared corner points at the person who said it.
    borderBottomRightRadius: radii.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  assistantRow: { alignItems: 'flex-start' },
  assistantBubble: {
    maxWidth: '92%',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderBottomLeftRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    // The AI block's border tier (0.45), not the paper hairline.
    borderColor: withAlpha(colors.accent, 0.45),
    padding: spacing.lg,
  },
  assistantCorners: { borderRadius: radii.md, borderBottomLeftRadius: radii.sm },
  assistantHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
