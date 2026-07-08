import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AppText,
  Card,
  CategoryBadge,
  ErrorState,
  Loading,
  ScreenContainer,
} from '@/components';
import { colors, radii, spacing } from '@/theme';
import {
  formatDistance,
  formatRelativeTime,
  formatTimeUntil,
  getAlertById,
  type Alert,
} from '@/mock/alerts';

type Status = 'loading' | 'error' | 'ready';

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <AppText variant="body" color="textSecondary" style={styles.metaLabel}>
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

export default function AlertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [alert, setAlert] = useState<Alert | null>(null);

  useEffect(() => {
    let active = true;
    getAlertById(id)
      .then((data) => {
        if (!active) return;
        setAlert(data);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [id]);

  const close = () => router.back();

  return (
    <ScreenContainer scroll edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={close}
          hitSlop={8}
          style={styles.close}
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      {status === 'loading' ? (
        <View style={styles.stateWrap}>
          <Loading label="Loading alert…" />
        </View>
      ) : status === 'error' || !alert ? (
        <View style={styles.stateWrap}>
          <ErrorState
            title="Alert not found"
            message="This alert may have expired or been removed from the neighborhood map."
          />
        </View>
      ) : (
        <View style={styles.body}>
          <CategoryBadge category={alert.category} severity={alert.severity} />
          <AppText variant="title" style={styles.title}>
            {alert.title}
          </AppText>
          <AppText variant="body" color="textSecondary">
            {alert.description}
          </AppText>

          <Card style={styles.meta}>
            <MetaRow
              icon="time-outline"
              label="Reported"
              value={formatRelativeTime(alert.createdAt)}
            />
            <MetaRow
              icon="navigate-outline"
              label="Distance"
              value={formatDistance(alert.coordinate)}
            />
            <MetaRow
              icon="hourglass-outline"
              label="Expires"
              value={formatTimeUntil(alert.expiresAt)}
            />
            <MetaRow
              icon="person-outline"
              label="Reported by"
              value={alert.reporterLabel}
            />
          </Card>

          <AppText variant="caption" color="textMuted" style={styles.footnote}>
            Simulated demo alert — reported by a neighbor, not a verified
            authority.
          </AppText>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.sm,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stateWrap: { minHeight: 320 },
  body: { gap: spacing.md },
  title: { marginTop: spacing.xs },
  meta: { gap: spacing.md, marginTop: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaLabel: { flex: 1 },
  footnote: { marginTop: spacing.sm },
});
