import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii, spacing } from '@/theme';
import { AppText } from './AppText';

type BottomSheetProps = {
  visible: boolean;
  /** Request to close (backdrop tap, close button, Android back). The sheet
   * animates out and unmounts itself once `visible` flips false. */
  onClose: () => void;
  title?: string;
  /** Portion of the window the sheet may grow to before its body scrolls. */
  maxHeightRatio?: number;
  children: ReactNode;
};

// A modal sheet that slides up from the bottom over a dimmed backdrop. Built on
// RN Modal + Animated (no gesture/reanimated deps — same precedent as
// PressableScale). Content taller than `maxHeightRatio` scrolls inside the
// sheet. No text inputs live in sheets yet; add KeyboardAvoidingView here the
// day one does.
export function BottomSheet({
  visible,
  onClose,
  title,
  maxHeightRatio = 0.85,
  children,
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  // Stays mounted through the exit animation, so closing never snaps.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active) return;
      if (visible) {
        setMounted(true);
        if (reduce) {
          progress.setValue(1);
          return;
        }
        Animated.timing(progress, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      } else if (reduce) {
        progress.setValue(0);
        setMounted(false);
      } else {
        Animated.timing(progress, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setMounted(false);
        });
      }
    });
    return () => {
      active = false;
    };
  }, [visible, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [windowHeight, 0],
  });

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
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
          style={[
            styles.sheet,
            {
              maxHeight: windowHeight * maxHeightRatio,
              paddingBottom: insets.bottom + spacing.lg,
              transform: [{ translateY }],
            },
          ]}
        >
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
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
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
