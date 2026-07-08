import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AppText,
  Card,
  CategoryBadge,
  EmptyState,
  ErrorState,
  Loading,
  ScreenContainer,
  ScreenHeader,
} from '@/components';
import { colors, spacing } from '@/theme';
import {
  formatDistance,
  formatRelativeTime,
  getNearbyAlerts,
  type Alert,
} from '@/mock/alerts';

type Status = 'loading' | 'error' | 'ready';

export default function AlertsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [alerts, setAlerts] = useState<Alert[]>([]);

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
        <ScreenHeader
          title="Nearby alerts"
          subtitle="Reported by your neighbors"
        />
        <Loading label="Loading nearby alerts…" />
      </ScreenContainer>
    );
  }

  if (status === 'error') {
    return (
      <ScreenContainer>
        <ScreenHeader
          title="Nearby alerts"
          subtitle="Reported by your neighbors"
        />
        <ErrorState onRetry={retry} />
      </ScreenContainer>
    );
  }

  if (alerts.length === 0) {
    return (
      <ScreenContainer>
        <ScreenHeader
          title="Nearby alerts"
          subtitle="Reported by your neighbors"
        />
        <EmptyState
          icon="checkmark-circle-outline"
          title="All quiet nearby"
          message="No active alerts in your neighborhood right now. New reports will show up here."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <ScreenHeader
        title="Nearby alerts"
        subtitle="Reported by your neighbors"
      />
      <View style={styles.list}>
        {alerts.map((alert) => (
          <Pressable
            key={alert.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/alert/[id]', params: { id: alert.id } })
            }
          >
            <Card style={styles.row}>
              <View style={styles.rowBody}>
                <CategoryBadge
                  category={alert.category}
                  severity={alert.severity}
                />
                <AppText variant="subtitle">{alert.title}</AppText>
                <AppText variant="body" color="textSecondary" numberOfLines={2}>
                  {alert.description}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {formatRelativeTime(alert.createdAt)} ·{' '}
                  {formatDistance(alert.coordinate)}
                </AppText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </Card>
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: { flex: 1, gap: spacing.xs },
});
