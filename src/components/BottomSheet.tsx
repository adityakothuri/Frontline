import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, durations, pressScale, radii, shadows, spacing, springs } from '@/theme';
import { easings } from '@/theme/motionPresets';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AppText } from './AppText';
import { Glyph } from './Glyph';
import { PressableScale } from './PressableScale';

/** Past this fraction of its own height, a release dismisses instead of springing back. */
const DISMISS_RATIO = 0.25;
/** A downward fling this fast dismisses regardless of how far it travelled. */
const DISMISS_VELOCITY = 800;

type BottomSheetProps = {
  visible: boolean;
  /** Request to close (backdrop, close button, Android back, drag down). The
   *  sheet animates out and unmounts once `visible` flips false. */
  onClose: () => void;
  title?: string;
  /** Portion of the window the sheet may grow to before its body scrolls. */
  maxHeightRatio?: number;
  children: ReactNode;
};

// A modal sheet over a dimmed backdrop, dragged down to dismiss. The drag is on
// the grabber and header only, so the body can scroll. No KeyboardAvoidingView:
// add one if a sheet ever hosts a text input.
export function BottomSheet({
  visible,
  onClose,
  title,
  maxHeightRatio = 0.85,
  children,
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // Distance below the resting place (0 = open). Shared by entrance and drag.
  const offset = useSharedValue(windowHeight);
  const sheetHeight = useSharedValue(windowHeight);
  // Stays mounted through the exit animation, so closing never snaps.
  const [mounted, setMounted] = useState(false);

  const unmount = useCallback(() => setMounted(false), []);

  // Not keyed on `mounted`, which would restart the entrance. The exit branch is
  // a safe no-op on first render.
  useEffect(() => {
    if (visible) {
      setMounted(true);
      offset.set(reduced ? 0 : withTiming(0, { duration: durations.slow, easing: easings.out }));
      return;
    }
    if (reduced) {
      offset.set(windowHeight);
      setMounted(false);
      return;
    }
    offset.set(
      withTiming(windowHeight, { duration: durations.fast, easing: easings.in }, (finished) => {
        'worklet';
        if (finished) runOnJS(unmount)();
      }),
    );
  }, [visible, reduced, offset, windowHeight, unmount]);

  const onSheetLayout = useCallback(
    (e: LayoutChangeEvent) => sheetHeight.set(e.nativeEvent.layout.height),
    [sheetHeight],
  );

  // Direct manipulation, so it stays enabled under Reduce Motion.
  const dragToDismiss = Gesture.Pan()
    .onUpdate((e) => {
      // Never past the resting position: the sheet does not drag upward.
      offset.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      const far = e.translationY > sheetHeight.get() * DISMISS_RATIO;
      if (far || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(onClose)();
        return;
      }
      offset.set(withSpring(0, springs.gesture));
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  // The dim tracks the drag, so pulling the sheet down also lifts the overlay.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, offset.get() / sheetHeight.get()),
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      {/* A Modal is its own native window, outside the app's gesture root; on
          Android a GestureDetector inside it needs its own root. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            accessibilityRole="button"
            // Distinct from the header "Close" so screen readers don't hear two.
            accessibilityLabel="Dismiss"
            style={styles.fill}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          onLayout={onSheetLayout}
          style={[
            styles.sheet,
            {
              maxHeight: windowHeight * maxHeightRatio,
              paddingBottom: insets.bottom + spacing.lg,
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={dragToDismiss}>
            <View>
              <View style={styles.grabber} />
              <View style={styles.header}>
                {title ? (
                  <AppText variant="title" style={styles.title}>
                    {title}
                  </AppText>
                ) : (
                  <View />
                )}
                {/* A real 44pt target around the 32pt visible square. */}
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onClose}
                  scaleTo={pressScale.control}
                  containerStyle={styles.closeTarget}
                  style={styles.close}
                >
                  <Glyph name="close" size={20} />
                </PressableScale>
              </View>
            </View>
          </GestureDetector>
          <Animated.ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            {children}
          </Animated.ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    ...shadows.sheet,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: { flexShrink: 1, textTransform: 'uppercase' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  // Negative margins keep the 44pt square from adding height to the header row.
  closeTarget: {
    width: 44,
    height: 44,
    marginVertical: -spacing.sm,
    marginRight: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
  },
  body: { paddingBottom: spacing.sm },
});
