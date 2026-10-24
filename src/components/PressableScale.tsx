import type { ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { pressScale, springs } from '@/theme';

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  /** Styles the animated layer *inside* the Pressable — the visual box. */
  style?: StyleProp<ViewStyle>;
  /** Styles the `Pressable` itself — put layout like `flex` here, since `style`
   *  lands on an inner view. */
  containerStyle?: StyleProp<ViewStyle>;
  /** How far to scale down while pressed. Defaults to `pressScale.base`. */
  scaleTo?: number;
  /** Children, or a render function that receives the pressed state. */
  children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
};

/**
 * The app's single press feel: a critically damped scale-down while held. Runs on
 * the UI thread, so it stays smooth while JS is busy.
 */
export function PressableScale({
  style,
  containerStyle,
  scaleTo = pressScale.base,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  // `get`/`set` rather than `.value`: the React Compiler-safe accessors.
  const handleIn = (e: GestureResponderEvent) => {
    scale.set(withSpring(scaleTo, springs.press));
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    scale.set(withSpring(1, springs.press));
    onPressOut?.(e);
  };

  return (
    <Pressable {...rest} style={containerStyle} onPressIn={handleIn} onPressOut={handleOut}>
      {({ pressed }) => (
        <Animated.View style={[animatedStyle, style]}>
          {typeof children === 'function' ? children({ pressed }) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}
