import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useNavigationContainerRef } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { colors, fonts, timings } from '@/theme';
import { AppErrorBoundary, ShieldTrace } from '@/components';
import { ProfileProvider } from '@/services/profile';
import { ActivityProvider } from '@/services/activity';
import { SavedProvider } from '@/services/saved';
import { RemindersProvider } from '@/services/reminders';
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

  // The native splash holds until the fonts resolve; the shield then draws once
  // over the same background before the app appears, so the launch reads as one
  // continuous moment instead of a static logo blinking out.
  const [introDone, setIntroDone] = useState(false);
  // Launch has nothing to wait on once the fonts are in, so the intro holds for
  // most of one lap of the shield's arc (1100ms against a 1400ms lap) before
  // calling itself "ready" and running the finale. Nothing "completes" in that
  // window — the waiting arc never resolves by design — so the hold is a chosen
  // beat, not the length of a drawing.
  const [introReady, setIntroReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIntroReady(true), timings.introHold);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  if (!introDone) {
    return (
      <View style={styles.intro}>
        <StatusBar style="dark" />
        <ShieldTrace size={128} done={introReady} onFinish={() => setIntroDone(true)} />
      </View>
    );
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
    // The error boundary stays outermost so a crash inside the gesture root is
    // still caught. `GestureHandlerRootView` has to be an ancestor of every
    // `GestureDetector` — the only ones today are inside the stack (the call
    // script sheet), so wrapping the providers is enough.
    <AppErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <ProfileProvider>
          <ActivityProvider>
            <SavedProvider>
              {/* Inside SavedProvider on purpose: arming a reminder saves the
                  resource, so this reads `useSaved`. */}
              <RemindersProvider>
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
              </RemindersProvider>
            </SavedProvider>
          </ActivityProvider>
        </ProfileProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  intro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});

export default withCrashReporting(RootLayout);
