import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, radii, spacing } from '@/theme';
import { tapImpact } from '@/lib/haptics';
import { aiService } from '@/services/ai';
import { reportDataError } from '@/services/monitoring';
import type { CallScript, CallScriptTone } from '@/services/ai';
import type { Need } from '@/types/need';
import { RESOURCE_CATEGORY_META, type Resource } from '@/types/resource';
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
  // Which request is the one whose answer still matters. The sheet can be closed
  // mid-generation and Retry can be tapped twice; without this, a response
  // landing late set state on an unmounted card, or an older one overwrote the
  // newer. Bumped on every generate and on unmount.
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
      // Reported, not just shown — see useAiGuidance: a silent AI failure is
      // invisible in monitoring while every resource read is not.
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
      // No clipboard (web permissions, a stripped build) — the script is still
      // on screen to read from; a failed copy is not worth an alert.
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
        <AppText variant="label" color="accentPressed">
          Tap to try again
        </AppText>
      </PressableScale>
    );
  }

  return (
    // No `title` here — the sheet's own header already names the card, so the
    // block renders no header and therefore no breathing sparkle. The sweep line
    // is the only motion in this wait, which is also the longest one in the app,
    // behind a modal where there is nothing else to look at. Hence a real label
    // rather than the default "Generating…".
    <AiContentBlock
      color={RESOURCE_CATEGORY_META[resource.category].color}
      loading={loading}
      loadingLabel="Writing your call script…"
    >
      {script ? (
        <>
          <View style={styles.scriptBlock}>
            <AppText variant="body">{script.script}</AppText>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Script copied' : 'Copy script'}
              onPress={copy}
              scaleTo={pressScale.chip}
              containerStyle={styles.copySlot}
              style={styles.copy}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={14}
                color={copied ? colors.success : colors.accent}
              />
              <AppText variant="label" color={copied ? 'success' : 'textSecondary'}>
                {copied ? 'Copied' : 'Copy'}
              </AppText>
            </PressableScale>
          </View>
          {/* Index-qualified: the model can repeat a tip verbatim. */}
          {script.tips.map((tip, i) => (
            <View key={`${i}-${tip}`} style={styles.tipRow}>
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
    minHeight: 44,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  scriptBlock: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  copySlot: { alignSelf: 'flex-end' },
  // A real 44pt target that hugs its label; it was an 18pt line with hitSlop.
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  tipRow: { flexDirection: 'row', gap: spacing.xs },
  tipText: { flex: 1 },
});
