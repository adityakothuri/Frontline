import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AppText,
  Card,
  CategoryBadge,
  ErrorState,
  Loading,
  PrimaryButton,
  ScreenContainer,
  ScreenHeader,
} from '@/components';
import { colors, spacing, type ColorToken } from '@/theme';
import { formatRelativeTime, getNearbyAlerts, type Alert } from '@/mock/alerts';

type Status = 'loading' | 'error' | 'ready';

type Summary = {
  active: number;
  serious: number;
  today: number;
  recent: Alert[];
};

const DAY = 24 * 3_600_000;

// Pure: derives the dashboard summary from alerts + a captured `now` (so the
// component render itself never calls an impure clock — see react-hooks/purity).
function buildSummary(data: Alert[], now: number): Summary {
  return {
    active: data.length,
    serious: data.filter((a) => a.severity === 'high').length,
    today: data.filter((a) => now - a.createdAt < DAY).length,
    recent: data.slice(0, 3),
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [summary, setSummary] = useState<Summary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getNearbyAlerts()
        .then((data) => {
          if (!active) return;
          setSummary(buildSummary(data, Date.now()));
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
        setSummary(buildSummary(data, Date.now()));
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  };

  if (status === 'loading') {
    return (
      <ScreenContainer>
        <Loading label="Loading your neighborhood…" />
      </ScreenContainer>
    );
  }

  if (status === 'error' || !summary) {
    return (
      <ScreenContainer>
        <ErrorState onRetry={retry} />
      </ScreenContainer>
    );
  }

  const stats: {
    key: string;
    value: number;
    label: string;
    color: ColorToken;
  }[] = [
    {
      key: 'active',
      value: summary.active,
      label: 'Active nearby',
      color: 'textPrimary',
    },
    {
      key: 'serious',
      value: summary.serious,
      label: 'Serious',
      color: summary.serious > 0 ? 'danger' : 'textSecondary',
    },
    {
      key: 'today',
      value: summary.today,
      label: 'Reported today',
      color: 'textPrimary',
    },
  ];

  return (
    <ScreenContainer scroll>
      <ScreenHeader
        title="Good to see you"
        subtitle="Watching over Maple Grove"
      />

      <View style={styles.stats}>
        {stats.map((stat) => (
          <Card key={stat.key} style={styles.statCard}>
            <AppText variant="title" color={stat.color}>
              {stat.value}
            </AppText>
            <AppText
              variant="caption"
              color="textSecondary"
              style={styles.statLabel}
            >
              {stat.label}
            </AppText>
          </Card>
        ))}
      </View>

      <PrimaryButton
        label="Report an alert"
        onPress={() => router.push('/report')}
        style={styles.report}
      />

      <View style={styles.sectionRow}>
        <AppText variant="heading">Recent activity</AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/alerts')}
        >
          <AppText variant="label" color="accent">
            See all
          </AppText>
        </Pressable>
      </View>

      {summary.recent.length === 0 ? (
        <Card>
          <AppText variant="body" color="textSecondary">
            All quiet nearby. Tap “Report an alert” if you see something.
          </AppText>
        </Card>
      ) : (
        <View style={styles.activity}>
          {summary.recent.map((alert) => (
            <Pressable
              key={alert.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/alert/[id]',
                  params: { id: alert.id },
                })
              }
            >
              <Card style={styles.activityCard}>
                <View style={styles.activityBody}>
                  <CategoryBadge
                    category={alert.category}
                    severity={alert.severity}
                  />
                  <AppText variant="subtitle">{alert.title}</AppText>
                  <AppText variant="caption" color="textMuted">
                    {formatRelativeTime(alert.createdAt)}
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
      )}

      <AppText variant="caption" color="textMuted" style={styles.demoNote}>
        Demo mode — the alerts shown here are simulated neighbor reports.
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  statCard: { flex: 1, paddingVertical: spacing.lg },
  statLabel: { marginTop: spacing.xs },
  report: { marginBottom: spacing.xl },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  activity: { gap: spacing.md },
  activityCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  activityBody: { flex: 1, gap: spacing.xs },
  demoNote: { marginTop: spacing.xl, textAlign: 'center' },
});
