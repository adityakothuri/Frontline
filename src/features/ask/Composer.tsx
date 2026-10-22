import { useState } from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableScale } from '@/components';
import { colors, fonts, pressScale, radii, spacing } from '@/theme';
import { MAX_USER_TURN_CHARS } from '@/services/ai/chatActions';
import { tapImpact } from '@/lib/haptics';
import { ASK_PLACEHOLDER } from './askStarters';

type ComposerProps = {
  onSend: (text: string) => void;
  /** False while a reply is pending or the profile has not hydrated. */
  canSend: boolean;
  /** Focus the field on mount — set when Home's card, which draws this same
   *  pill, was what opened the screen. Without that the card would be a lie. */
  autoFocus?: boolean;
};

/**
 * The message field: the same 48pt paper pill Home's card draws, now real,
 * with the one olive control on the screen at its trailing edge.
 *
 * Multiline, because a need is sometimes a paragraph; return inserts a newline
 * and the button sends, so a nervous thumb never fires a half-typed message.
 * The field stays editable while a reply is pending — a veteran can draft the
 * next thing — and only the send is held.
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
        <Ionicons name="arrow-up" size={20} color={colors.textOnAccent} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    minHeight: 48,
    paddingLeft: spacing.lg,
    // 2 + 44 + 2: the send target fills the pill's height.
    paddingRight: spacing.xxs,
    paddingVertical: spacing.xxs,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    // Five lines at 16/22, then it scrolls inside itself.
    maxHeight: 22 * 5 + spacing.sm * 2,
    // 2 + 8 + 22 + 8 + 2 = 42, so `minHeight: 48` on the pill wins at one line
    // and the field is the same 48pt object Home draws.
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  // A real 44pt target, pinned to the bottom of the pill so it stays put as
  // the field grows; the olive disc inside it is 40 so the pill keeps its line.
  sendSlot: {
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  // The same disabled strength `PrimaryButton` uses.
  sendDisabled: { opacity: 0.5 },
});
