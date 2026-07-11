import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { AppText } from '@/components';
import { colors, radii, spacing } from '@/theme';
import { aiService } from '@/services/ai';
import type { CallScript, CallScriptTone } from '@/services/ai';
import type { Need } from '@/types/need';
import type { Resource } from '@/types/resource';
import { AiContentBlock } from './AiContentBlock';

type CallScriptCardProps = {
  need: Need;
  resource: Resource;
  /** The veteran's first name, to personalize the script. */
  firstName?: string;
  /** Which tone to generate (emergency resources use the shorter, calmer one). */
  tone?: CallScriptTone;
};

// The call-script workflow: one script, generated on mount (the veteran opts in
// by opening the sheet), personalized by name, with one-tap copy.
export function CallScriptCard({ need, resource, firstName, tone = 'standard' }: CallScriptCardProps) {
  const [script, setScript] = useState<CallScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await aiService.buildCallScript({ need, resource, tone, firstName });
      setScript(result);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [need, resource, tone, firstName]);

  useEffect(() => {
    generate();
  }, [generate]);

  // Clear any pending "Copied" reset on unmount (the sheet can be closed).
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const copy = async () => {
    if (!script) return;
    await Clipboard.setStringAsync(script.script);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1800);
  };

  if (failed) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try generating the script again"
        onPress={generate}
        style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
      >
        <AppText variant="body" color="danger">
          Couldn’t put the script together.
        </AppText>
        <AppText variant="label" color="accentPressed">
          Tap to try again
        </AppText>
      </Pressable>
    );
  }

  return (
    <AiContentBlock loading={loading} disclaimer={script?.disclaimer}>
      {script ? (
        <>
          <View style={styles.scriptBlock}>
            <AppText variant="body">{script.script}</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Script copied' : 'Copy script'}
              onPress={copy}
              hitSlop={8}
              style={({ pressed }) => [styles.copy, pressed && styles.copyPressed]}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={14}
                color={copied ? colors.success : colors.accent}
              />
              <AppText variant="label" color={copied ? 'success' : 'textSecondary'}>
                {copied ? 'Copied' : 'Copy'}
              </AppText>
            </Pressable>
          </View>
          {script.tips.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <AppText variant="body" color="textSecondary">
                •
              </AppText>
              <AppText variant="body" color="textSecondary" style={styles.tipText}>
                {tip}
              </AppText>
            </View>
          ))}
        </>
      ) : null}
    </AiContentBlock>
  );
}

const styles = StyleSheet.create({
  retry: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  retryPressed: { opacity: 0.6 },
  scriptBlock: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-end',
  },
  copyPressed: { opacity: 0.6 },
  tipRow: { flexDirection: 'row', gap: spacing.xs },
  tipText: { flex: 1 },
});
