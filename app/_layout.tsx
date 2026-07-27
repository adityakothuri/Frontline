import { useEffect } from 'react';
import { Stack, useNavigationContainerRef } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { colors, fonts } from '@/theme';
import { AppErrorBoundary } from '@/components';
import { ProfileProvider } from '@/services/profile';
import { ActivityProvider } from '@/services/activity';
import { SavedProvider } from '@/services/saved';
import {
  initCrashReporting,
  navigationIntegration,
  withCrashReporting,
} from '@/services/monitoring';

// Before the first render, so a crash during startup is still reported.
initCrashReporting();

// Keep the native splash up until Inter + Fraunces are ready, so the first frame
// the user sees is already in the app's typefaces (no font swap / flash of
// system font).
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  // Gives crash reports the screen the veteran was on. No-op without a DSN.
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    if (navigationRef) navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  // Shared themed header for the stack screens pushed on top of the tabs.
  // `ios_from_right` matches the iOS default push on Android too, so pushes
  // feel native everywhere; the swipe-back gesture works from mid-screen.
  const themedHeader = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerTintColor: colors.textPrimary,
    headerTitleStyle: { fontFamily: fonts.semibold, color: colors.textPrimary },
    headerBackTitle: 'Back',
    animation: 'ios_from_right',
    fullScreenGestureEnabled: true,
  } as const;

  return (
    <AppErrorBoundary>
      <ProfileProvider>
        <ActivityProvider>
          <SavedProvider>
            <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            {/* Entry gate + onboarding swap with a fade, not a visible push. */}
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            {/* Results and the resource detail push on top of the tabs with a themed header. */}
            <Stack.Screen name="results" options={themedHeader} />
            <Stack.Screen name="resource/[id]" options={themedHeader} />
          </Stack>
          </SavedProvider>
        </ActivityProvider>
      </ProfileProvider>
    </AppErrorBoundary>
  );
}

export default withCrashReporting(RootLayout);
