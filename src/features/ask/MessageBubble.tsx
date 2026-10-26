import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components';
import { colors, spacing } from '@/theme';
import { fadeIn } from '@/theme/motionPresets';

type MessageBubbleProps = {
  role: 'user' | 'assistant';
  text: string;
};

/**
 * One turn of the conversation, set as a transcript entry rather than a chat
 * bubble: a mono speaker label, then the words. Frontline's turns carry the
 * olive left rule every piece of model output wears.
 * `selectable` so a reply can be copied into a form or a text message.
 */
export function MessageBubble({ role, text }: MessageBubbleProps) {
  const assistant = role === 'assistant';
  return (
    <Animated.View entering={fadeIn()} style={[styles.turn, assistant && styles.assistant]}>
      <AppText variant="kicker" color={assistant ? 'accent' : 'textSecondary'}>
        {assistant ? 'Frontline' : 'You'}
      </AppText>
      <AppText variant="body" selectable>
        {text}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  turn: { gap: spacing.xs },
  assistant: { borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: spacing.lg },
});
