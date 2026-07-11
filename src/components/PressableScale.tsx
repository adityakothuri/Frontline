import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** How far to scale down while pressed. */
  scaleTo?: number;
  children?: ReactNode;
};

// A Pressable that springs down slightly while held, so taps feel tactile instead
// of rigid. Wraps children in an Animated.View; the visual style goes on it.
export function PressableScale({
  style,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  const handleIn = (e: GestureResponderEvent) => {
    spring(scaleTo);
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    spring(1);
    onPressOut?.(e);
  };

  return (
    <Pressable {...rest} onPressIn={handleIn} onPressOut={handleOut}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
