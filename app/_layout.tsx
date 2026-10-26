import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useNavigationContainerRef } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { PublicSans_400Regular } from '@expo-google-fonts/public-sans/400Regular';
import { PublicSans_500Medium } from '@expo-google-fonts/public-sans/500Medium';
import { PublicSans_600SemiBold } from '@expo-google-fonts/public-sans/600SemiBold';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { OverpassMono_600SemiBold } from '@expo-google-fonts/overpass-mono/600SemiBold';
import { colors, fonts, textVariants, timings } from '@/theme';
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

// Keep the native splash up until the three families are ready, so the first frame
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
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    OverpassMono_600SemiBold,
  });

  // After the native splash, the shield draws once as an overlay, not a gate:
  // providers and Home mount underneath, so the first browse runs while it draws.
  const [introDone, setIntroDone] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  useEffect(() => {
    const ready = setTimeout(() => setIntroReady(true), timings.introHold);
    // Backstop: a launch must never hang on a missed animation callback.
    const lift = setTimeout(() => setIntroDone(true), timings.introHold + timings.finaleBudget);
    return () => {
      clearTimeout(ready);
      clearTimeout(lift);
    };
  }, []);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  // Header for screens pushed over the tabs. `ios_from_right` gives Android the
  // iOS push too, with swipe-back from mid-screen.
  const themedHeader = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerTintColor: colors.textPrimary,
    // A pushed screen is titled by what it is about, in the display face.
    headerTitleStyle: {
      fontFamily: fonts.displaySemibold,
      fontSize: textVariants.itemTitle.fontSize,
      color: colors.textPrimary,
    },
    headerBackTitle: 'Back',
    animation: 'ios_from_right',
    fullScreenGestureEnabled: true,
  } as const;

  return (
    // The error boundary stays outermost so a crash in the gesture root is caught.
    <AppErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <ProfileProvider>
          <ActivityProvider>
            <SavedProvider>
              {/* Inside SavedProvider: arming a reminder saves the resource. */}
              <RemindersProvider>
                <StatusBar style="dark" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                  }}
                >
                  <Stack.Screen name="index" options={{ animation: 'fade' }} />
                  <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                  <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                  <Stack.Screen name="results" options={themedHeader} />
                  <Stack.Screen name="resource/[id]" options={themedHeader} />
                  <Stack.Screen name="ask" options={themedHeader} />
                </Stack>
              </RemindersProvider>
            </SavedProvider>
          </ActivityProvider>
        </ProfileProvider>
        {!introDone && (
          <View style={styles.intro}>
            <ShieldTrace size={128} done={introReady} onFinish={() => setIntroDone(true)} />
          </View>
        )}
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  intro: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});

export default withCrashReporting(RootLayout);
