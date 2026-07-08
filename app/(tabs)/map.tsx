import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { MapView, Marker } from '@/components/maps';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AlertMarker,
  AppText,
  ErrorState,
  Loading,
  ScreenContainer,
} from '@/components';
import { colors, radii, spacing } from '@/theme';
import { darkMapStyle } from '@/theme/mapStyle';
import { getNearbyAlerts, MAPLE_GROVE_REGION, type Alert } from '@/mock/alerts';

type Status = 'loading' | 'error' | 'ready';

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>('loading');
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Re-fetch every time the Map regains focus so a just-reported alert shows up.
  // Refocus updates silently (no loading flash) since state is only set async.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getNearbyAlerts()
        .then((data) => {
          if (!active) return;
          setAlerts(data);
          setStatus('ready');
        })
        .catch(() => {
          if (active) setStatus('error');
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const retry = () => {
    setStatus('loading');
    getNearbyAlerts()
      .then((data) => {
        setAlerts(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  };

  if (status === 'loading') {
    return (
      <ScreenContainer>
        <Loading label="Loading nearby alerts…" />
      </ScreenContainer>
    );
  }

  if (status === 'error') {
    return (
      <ScreenContainer>
        <ErrorState onRetry={retry} />
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.fill}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={MAPLE_GROVE_REGION}
        userInterfaceStyle="dark"
        customMapStyle={darkMapStyle}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {alerts.map((alert) => (
          <Marker
            key={alert.id}
            coordinate={alert.coordinate}
            anchor={{ x: 0.5, y: 1 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() =>
              router.push({ pathname: '/alert/[id]', params: { id: alert.id } })
            }
          >
            <AlertMarker category={alert.category} severity={alert.severity} />
          </Marker>
        ))}
      </MapView>

      <View
        style={[styles.header, { top: insets.top + spacing.md }]}
        pointerEvents="none"
      >
        <View style={styles.headerPill}>
          <AppText variant="subtitle">Maple Grove</AppText>
          <AppText variant="caption" color="textSecondary">
            {alerts.length === 0
              ? 'Neighborhood watch'
              : `${alerts.length} active ${alerts.length === 1 ? 'alert' : 'alerts'} nearby`}
          </AppText>
        </View>
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyWrap} pointerEvents="none">
          <View style={styles.emptyPill}>
            <AppText variant="subtitle" style={styles.center}>
              All quiet right now
            </AppText>
            <AppText variant="body" color="textSecondary" style={styles.center}>
              No active alerts nearby. Tap Report if you see something.
            </AppText>
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/report')}
        style={({ pressed }) => [
          styles.fab,
          { bottom: spacing.xl },
          pressed && styles.fabPressed,
        ]}
      >
        <Ionicons name="add" size={22} color={colors.textOnAccent} />
        <AppText variant="subtitle" color="textOnAccent">
          Report
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  header: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'flex-start',
  },
  headerPill: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPill: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  center: { textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  fabPressed: { backgroundColor: colors.accentPressed },
});
