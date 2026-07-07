import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PrimaryButton, ScreenContainer } from '@/components';
import { colors, radii, spacing } from '@/theme';

// Entry screen. For the MVP this only offers demo mode — real sign-in is a later
// phase. `replace` so the welcome screen isn't in the tab back stack.
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.brandMark}>
          <Ionicons name="shield-checkmark" size={32} color={colors.accent} />
        </View>
        <AppText variant="display" style={styles.wordmark}>
          Watchdog
        </AppText>
        <AppText variant="body" color="textSecondary" style={styles.tagline}>
          Neighborhood safety, verified by people. AI watches for you — you
          decide what the neighborhood sees.
        </AppText>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label="Enter demo mode"
          onPress={() => router.replace('/home')}
        />
        <AppText variant="caption" color="textMuted" style={styles.footNote}>
          A guided demo with simulated cameras and alerts. Sign-in arrives with
          the full release.
        </AppText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', alignItems: 'flex-start' },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.xl,
  },
  wordmark: { marginBottom: spacing.md },
  tagline: { maxWidth: 340 },
  footer: { gap: spacing.md },
  footNote: { textAlign: 'center' },
});
