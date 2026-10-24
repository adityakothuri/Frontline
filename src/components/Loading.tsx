import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing, timings } from '@/theme';
import { AppText } from './AppText';
import { ShieldTrace } from './ShieldTrace';

type LoadingProps = {
  label?: string;
};

// The loading state for data-backed screens: the self-drawing shield. The
// container carries the accessibility label (the mark is decorative).
// `useLoadingGate` below decides *when* it shows.
export function Loading({ label }: LoadingProps) {
  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      <ShieldTrace />
      {label ? (
        <AppText variant="body" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

type LoadingGate = {
  /** Content must not render yet. */
  holding: boolean;
  /** Render `<Loading>`. False during the initial quiet window. */
  showShield: boolean;
};

/**
 * Decides when the shield is on screen. Shows nothing during the initial quiet
 * window (most reads settle inside it); content takes over the instant it arrives.
 */
export function useLoadingGate(loading: boolean): LoadingGate {
  const [quietOver, setQuietOver] = useState(false);

  useEffect(() => {
    if (!loading) {
      setQuietOver(false);
      return;
    }
    const timer = setTimeout(() => setQuietOver(true), timings.loadingQuiet);
    return () => clearTimeout(timer);
  }, [loading]);

  return { holding: loading, showShield: loading && quietOver };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  label: { textAlign: 'center' },
});
