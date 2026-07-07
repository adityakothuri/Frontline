import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  AppText,
  Card,
  ErrorState,
  Loading,
  ScreenContainer,
  ScreenHeader,
} from '@/components';
import { colors, radii, spacing, type ColorToken } from '@/theme';
import {
  getDashboardSummary,
  type DashboardSummary,
  type Tone,
} from '@/mock/dashboard';

// Tone maps to meaning, not decoration: green = safe/confirmed, orange = needs
// attention, neutral stays quiet. The blue accent is reserved for actions, so it
// is never used here as a data color; red is reserved for serious alerts elsewhere.
const statValueColor: Record<Tone, ColorToken> = {
  neutral: 'textPrimary', // a crisp-white number reads as correctly neutral
  success: 'success',
  alert: 'warning',
};
const dotColor: Record<Tone, ColorToken> = {
  neutral: 'textSecondary', // a quiet muted mark for non-events
  success: 'success',
  alert: 'warning',
};

type Status = 'loading' | 'error' | 'ready';

export default function HomeScreen() {
  const [status, setStatus] = useState<Status>('loading');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Simulated fetch of the dashboard summary. State is only set from the async
  // callbacks (never synchronously in the effect body), so a failed load lands
  // on the error state and `retry` re-runs the effect.
  useEffect(() => {
    let active = true;
    getDashboardSummary()
      .then((data) => {
        if (!active) return;
        setSummary(data);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setStatus('loading');
    setAttempt((n) => n + 1);
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

  return (
    <ScreenContainer scroll>
      <ScreenHeader
        title="Good to see you"
        subtitle={`Watching over ${summary.neighborhood}`}
      />

      <View style={styles.stats}>
        {summary.stats.map((stat) => (
          <Card key={stat.key} style={styles.statCard}>
            <AppText variant="title" color={statValueColor[stat.tone]}>
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

      <AppText variant="heading" style={styles.sectionTitle}>
        Recent activity
      </AppText>
      <View style={styles.activity}>
        {summary.recentActivity.map((item) => (
          <Card key={item.id} style={styles.activityCard}>
            <View
              style={[
                styles.dot,
                { backgroundColor: colors[dotColor[item.tone]] },
              ]}
            />
            <View style={styles.activityBody}>
              <AppText variant="subtitle">{item.title}</AppText>
              <AppText
                variant="body"
                color="textSecondary"
                style={styles.activityDetail}
              >
                {item.detail}
              </AppText>
            </View>
            <AppText variant="caption" color="textMuted">
              {item.time}
            </AppText>
          </Card>
        ))}
      </View>

      <AppText variant="caption" color="textMuted" style={styles.demoNote}>
        Demo mode — the cameras, detections, and alerts shown here are
        simulated.
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  statCard: { flex: 1, paddingVertical: spacing.lg },
  statLabel: { marginTop: spacing.xs },
  sectionTitle: { marginBottom: spacing.md },
  activity: { gap: spacing.md },
  activityCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 10, height: 10, borderRadius: radii.pill },
  activityBody: { flex: 1 },
  activityDetail: { marginTop: 2 },
  demoNote: { marginTop: spacing.xl, textAlign: 'center' },
});
