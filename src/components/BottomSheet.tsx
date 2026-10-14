import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, durations, radii, spacing, springs } from '@/theme';
import { easings } from '@/theme/motionPresets';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AppText } from './AppText';

/** Past this fraction of its own height, a release dismisses instead of springing back. */
const DISMISS_RATIO = 0.25;
/** A downward fling this fast dismisses regardless of how far it travelled. */
const DISMISS_VELOCITY = 800;

type BottomSheetProps = {
  visible: boolean;
  /** Request to close (backdrop tap, close button, Android back, drag down).
   * The sheet animates out and unmounts itself once `visible` flips false. */
  onClose: () => void;
  title?: string;
  /** Portion of the window the sheet may grow to before its body scrolls. */
  maxHeightRatio?: number;
  children: ReactNode;
};

// A modal sheet that slides up from the bottom over a dimmed backdrop, and can
// be dragged back down to dismiss. The drag is attached to the grabber and
// header only, not the body — a pan over scrollable content has to scroll.
// Content taller than `maxHeightRatio` scrolls inside the sheet. No text inputs
// live in sheets yet; add KeyboardAvoidingView here the day one does.
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
  // How far the sheet sits below its resting place: `windowHeight` when fully
  // offscreen, 0 when open. One value covers both the entrance and the drag, so
  // a release mid-animation has a single source of truth to spring from.
  const offset = useSharedValue(windowHeight);
  const sheetHeight = useSharedValue(windowHeight);
  // Stays mounted through the exit animation, so closing never snaps.
  const [mounted, setMounted] = useState(false);

  const unmount = useCallback(() => setMounted(false), []);

  // Deliberately not keyed on `mounted`: setting it here would re-run this and
  // restart the entrance a frame after it began. Closing while already closed
  // is a no-op, so the exit branch is safe to run on first render.
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

  // Dragging is direct manipulation, not decoration, so it stays enabled under
  // Reduce Motion — taking it away would remove a control, not calm one.
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
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            accessibilityRole="button"
            // Distinct from the header "Close" button so a screen reader doesn't
            // announce two identical "Close" controls for the same sheet.
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
                {title ? <AppText variant="title">{title}</AppText> : <View />}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onClose}
                  hitSlop={8}
                  style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  closePressed: { opacity: 0.6 },
  body: { paddingBottom: spacing.sm },
});
