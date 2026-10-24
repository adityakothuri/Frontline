import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Glyph, type GlyphName } from '@/components';
import { colors, durations, fonts } from '@/theme';
import { easings } from '@/theme/motionPresets';

/**
 * A tab icon that shows selection two ways at once, never by colour alone: the
 * glyph fills in, and an olive bar draws across the top of the tab. Olive,
 * never a category hue: olive owns every action and selection in this app.
 */
function TabIcon({
  name,
  color,
  focused,
}: {
  name: GlyphName;
  color: ColorValue;
  focused: boolean;
}) {
  const select = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    select.set(withTiming(focused ? 1 : 0, { duration: durations.fast, easing: easings.out }));
  }, [focused, select]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: select.get() }] }));

  return (
    <View style={styles.icon}>
      <Animated.View style={[styles.bar, barStyle]} />
      <Glyph name={name} size={22} color={String(color)} filled={focused} />
    </View>
  );
}

const tab = (name: GlyphName) =>
  function renderTabIcon(props: { color: ColorValue; focused: boolean }) {
    return <TabIcon name={name} {...props} />;
  };

// Bottom tabs: drawn glyphs and mono caps labels. Icons go through `tabBarIcon`,
// not a custom `tabBar`, so targets, insets and the `tab` role stay the library's.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Cross-fade between tabs ('shift' shimmers against the native map view).
        animation: 'fade',
        tabBarActiveTintColor: colors.accentPressed,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1.5,
          borderTopColor: colors.textPrimary,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.mono,
          fontSize: 12,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tab('home') }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: tab('search') }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: tab('map') }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: tab('bookmark') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tab('profile') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center', width: 56 },
  // Sits on the bar's top rule, above the glyph.
  bar: {
    position: 'absolute',
    top: -8,
    width: 56,
    height: 3,
    backgroundColor: colors.accent,
  },
});
