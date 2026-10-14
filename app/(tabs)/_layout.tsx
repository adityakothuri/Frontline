import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, durations, fonts, radii, springs } from '@/theme';
import { easings } from '@/theme/motionPresets';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * A tab icon that shows its selection two ways at once: the glyph fills in, and
 * an olive pill settles in behind it. Two channels rather than one because the
 * accessibility rules forbid carrying meaning by colour alone — and because the
 * filled glyph is what still reads at a glance in bright sun.
 *
 * The pill is the same `accentSoft` vocabulary the Discover chips use, so the
 * bar looks like part of the system rather than a separate piece of chrome. It
 * is olive, never a category hue: olive owns every action in this app.
 */
function TabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: IconName;
  color: ColorValue;
  size: number;
  focused: boolean;
}) {
  const select = useSharedValue(focused ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    select.set(
      focused
        ? withSpring(1, springs.settle)
        : withTiming(0, { duration: durations.micro, easing: easings.in }),
    );
    // A small kick on the way in only — leaving a tab is not an event.
    if (focused) {
      pop.set(
        withSequence(
          withTiming(1.14, { duration: durations.micro }),
          withSpring(1, springs.settle),
        ),
      );
    }
  }, [focused, select, pop]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: select.get(),
    transform: [{ scale: 0.8 + select.get() * 0.2 }],
  }));
  const glyphStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <View style={styles.icon}>
      <Animated.View style={[styles.pill, pillStyle]} />
      <Animated.View style={glyphStyle}>
        <Ionicons
          name={focused ? name : (`${name}-outline` as IconName)}
          color={color}
          size={size}
        />
      </Animated.View>
    </View>
  );
}

const tab = (name: IconName) =>
  function renderTabIcon(props: { color: ColorValue; size: number; focused: boolean }) {
    return <TabIcon name={name} {...props} />;
  };

// Bottom-tab shell. Icons come from one set (Ionicons) and labels use Inter, so
// the bar reads as designed rather than platform-default. Five tabs: Home (the
// "what do you need help with?" entry point), Discover, Map, Saved, and Profile.
//
// The icons are rendered through react-navigation's own `tabBarIcon` rather than
// a custom `tabBar`, so tap targets, safe-area insets, the `tab` role and the
// selected state all stay the library's job.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Cross-fade between tabs ('shift' shimmers against the native map view).
        animation: 'fade',
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.backgroundElevated,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tab('home') }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: tab('compass') }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: tab('map') }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: tab('bookmark') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tab('person') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    width: 48,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
});
