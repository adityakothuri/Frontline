import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, spacing } from '@/theme';
import { tapImpact } from '@/lib/haptics';
import { aiService } from '@/services/ai';
import { reportDataError } from '@/services/monitoring';
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
export function CallScriptCard({
  need,
  resource,
  firstName,
  tone = 'standard',
}: CallScriptCardProps) {
  const [script, setScript] = useState<CallScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Id of the request whose answer still matters, so a late or superseded
  // response is ignored. Bumped on every generate and on unmount.
  const request = useRef(0);

  const generate = useCallback(async () => {
    const mine = ++request.current;
    setLoading(true);
    setFailed(false);
    try {
      const result = await aiService.buildCallScript({ need, resource, tone, firstName });
      if (mine !== request.current) return;
      setScript(result);
    } catch (error) {
      if (mine !== request.current) return;
      // Reported as well as shown, as in useAiGuidance.
      reportDataError('Call script', error);
      setFailed(true);
    } finally {
      if (mine === request.current) setLoading(false);
    }
  }, [need, resource, tone, firstName]);

  useEffect(() => {
    generate();
  }, [generate]);

  // On unmount (the sheet can be closed): retire any in-flight request and clear
  // a pending "Copied" reset.
  useEffect(
    () => () => {
      request.current += 1;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const copy = async () => {
    if (!script) return;
    try {
      await Clipboard.setStringAsync(script.script);
    } catch {
      // A failed copy is not worth an alert; the script is still on screen.
      return;
    }
    tapImpact();
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1800);
  };

  if (failed) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Try writing the script again"
        onPress={generate}
        scaleTo={pressScale.subtle}
        style={styles.retry}
      >
        <AppText variant="body">Couldn’t write the script just now.</AppText>
        <AppText variant="data" color="accent">
          Try again ▸
        </AppText>
      </PressableScale>
    );
  }

  return (
    // No `title`: the sheet's header names the card.
    <AiContentBlock loading={loading} loadingLabel="Writing your call script…">
      {script ? (
        <>
          {/* Set like a printed script: a SAY label and the words to read. */}
          <View style={styles.scriptBlock}>
            <AppText variant="kicker" color="textSecondary">
              Say
            </AppText>
            <AppText variant="body">{script.script}</AppText>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Script copied' : 'Copy script'}
              onPress={copy}
              scaleTo={pressScale.chip}
              containerStyle={styles.copySlot}
              style={styles.copy}
            >
              <AppText variant="data" color={copied ? 'success' : 'accent'}>
                {copied ? 'Copied ✓' : 'Copy ▸'}
              </AppText>
            </PressableScale>
          </View>
          {script.tips.length > 0 ? (
            <AppText variant="kicker" color="textSecondary">
              If it helps
            </AppText>
          ) : null}
          {/* Index-qualified: the model can repeat a tip verbatim. */}
          {script.tips.map((tip, i) => (
            <View key={`${i}-${tip}`} style={styles.tipRow}>
              <AppText variant="body" color="textSecondary">
                —
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
  retry: { gap: spacing.xs, minHeight: 44, paddingVertical: spacing.md },
  scriptBlock: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  copySlot: { alignSelf: 'flex-end' },
  // A real 44pt target that hugs its label.
  copy: { minHeight: 44, justifyContent: 'center' },
  tipRow: { flexDirection: 'row', gap: spacing.sm },
  tipText: { flex: 1 },
});
