import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { colors, fonts } from '@/theme';

// Keep the native splash up until Manrope is ready, so the first frame the user
// sees is already in the app's typeface (no font swap / flash of system font).
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        {/* The guided flow + results push on top of the tabs with a themed header. */}
        <Stack.Screen
          name="need/[category]"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontFamily: fonts.semibold, color: colors.textPrimary },
            headerBackTitle: 'Back',
            title: '',
          }}
        />
        <Stack.Screen
          name="results"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontFamily: fonts.semibold, color: colors.textPrimary },
            headerBackTitle: 'Back',
          }}
        />
      </Stack>
    </>
  );
}
