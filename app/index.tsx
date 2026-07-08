import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PrimaryButton, ScreenContainer } from '@/components';
import { colors, radii, spacing } from '@/theme';

// Entry screen. No sign-in for the MVP — a veteran can start finding help right
// away. `replace` so the welcome screen isn't in the tab back stack.
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.brandMark}>
          <Ionicons name="compass" size={32} color={colors.accent} />
        </View>
        <AppText variant="display" style={styles.wordmark}>
          Frontline
        </AppText>
        <AppText variant="body" color="textSecondary" style={styles.tagline}>
          Find your next step. Frontline helps veterans find benefits, local
          resources, and a clear plan for what to do next.
        </AppText>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="Get started" onPress={() => router.replace('/home')} />
        <AppText variant="caption" color="textMuted" style={styles.footNote}>
          Frontline is a resource navigator — not the VA or a government agency.
          No sign-in, and we never ask for sensitive information.
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
