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
  /**
   * Styles the `Pressable` itself. Layout that has to act on the touchable — a
   * `flex` that makes two buttons split a row, or one tile fill its grid cell —
   * belongs here: `style` lands on an inner view, where `flex` does nothing.
   * Two call sites had already worked around this with a wrapper `View` each.
   */
  containerStyle?: StyleProp<ViewStyle>;
  /** How far to scale down while pressed. Defaults to `pressScale.base`. */
  scaleTo?: number;
  /**
   * Children, or a render function if the visual needs the pressed state too
   * (`PrimaryButton` shifts its background colour as well as scaling).
   */
  children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
};

/**
 * A Pressable that springs down slightly while held, so taps feel tactile
 * instead of rigid. The spring is critically damped — a press should stop dead,
 * not wobble — and it is the single press feel in the app: every card, chip,
 * pill and button routes through here.
 *
 * The scale runs on the UI thread, so it stays smooth even while the JS thread
 * is busy parsing a response, which is exactly when people are tapping.
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

  // `get`/`set` rather than `.value` throughout: SDK 57 runs the React Compiler,
  // which treats a shared value read or written during render as a mutation of
  // something immutable. These accessors are the compiler-safe form.
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
