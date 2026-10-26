import { useState } from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import { Glyph, PressableScale } from '@/components';
import { colors, fonts, pressScale, radii, spacing } from '@/theme';
import { MAX_USER_TURN_CHARS } from '@/services/ai';
import { tapImpact } from '@/lib/haptics';
import { ASK_PLACEHOLDER } from './askStarters';

type ComposerProps = {
  onSend: (text: string) => void;
  /** False while a reply is pending or the profile has not hydrated. */
  canSend: boolean;
  /** Focus the field on mount (set when opened from Home's matching card). */
  autoFocus?: boolean;
};

/**
 * The message field, matching Home's pill. Multiline: return inserts a newline
 * and only the button sends. Stays editable while a reply is pending.
 */
export function Composer({ onSend, canSend, autoFocus = false }: ComposerProps) {
  const [text, setText] = useState('');
  const ready = canSend && text.trim().length > 0;

  const send = () => {
    if (!ready) return;
    tapImpact();
    onSend(text);
    setText('');
  };

  return (
    <View style={styles.pill}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        maxLength={MAX_USER_TURN_CHARS}
        autoFocus={autoFocus}
        placeholder={ASK_PLACEHOLDER}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Your message"
        style={styles.input}
      />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Send"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={send}
        scaleTo={pressScale.control}
        containerStyle={styles.sendSlot}
        style={[styles.send, !ready && styles.sendDisabled]}
      >
        <Glyph name="arrowRight" size={20} color={colors.textOnAccent} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    minHeight: 56,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xxs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    // Five lines at 16/22, then it scrolls inside itself.
    maxHeight: 22 * 5 + spacing.sm * 2,
    // The pill's `minHeight: 56` wins at one line, matching Home's field.
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  // Pinned to the bottom so it stays put as the field grows.
  sendSlot: {
    alignSelf: 'flex-end',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  // The same disabled strength `PrimaryButton` uses.
  sendDisabled: { opacity: 0.5 },
});
