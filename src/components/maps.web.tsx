// Web fallback for the native map primitives (see maps.tsx for why).
//
// react-native-maps can't run on react-native-web, so on web we render a calm
// placeholder instead of a map and let markers no-op. The screens still work —
// the Alerts tab lists the same alerts, and the report form still submits (the
// pin defaults to the neighborhood center). Extra map props are accepted and
// ignored; these components are only type-checked against maps.tsx (native) at
// the call sites.
import type { ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '@/theme';
import { AppText } from './AppText';

type MapViewFallbackProps = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function MapView({ style, children }: MapViewFallbackProps) {
  return (
    <View style={[styles.fallback, style]}>
      <View style={styles.card}>
        <AppText variant="subtitle" style={styles.center}>
          Map runs in the app
        </AppText>
        <AppText variant="body" color="textSecondary" style={styles.center}>
          Open Watchdog in Expo Go on iOS or Android to see the neighborhood
          map. On the web preview, use the Alerts tab to browse nearby alerts.
        </AppText>
      </View>
      {children}
    </View>
  );
}

export function Marker(_props: { children?: ReactNode }) {
  return null;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  center: { textAlign: 'center' },
});
