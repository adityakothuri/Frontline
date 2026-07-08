import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

type ScreenEdge = 'top' | 'right' | 'bottom' | 'left';

type ScreenContainerProps = {
  children: ReactNode;
  scroll?: boolean;
  // Tab screens default to 'top' only (the tab bar owns the bottom inset);
  // full-screen routes like Welcome pass ['top', 'bottom'].
  edges?: ScreenEdge[];
  // Forms pass this so the keyboard pushes content up instead of covering the
  // submit button, and taps on chips register without a dismiss-first tap.
  keyboardAware?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function ScreenContainer({
  children,
  scroll = false,
  edges = ['top'],
  keyboardAware = false,
  contentStyle,
}: ScreenContainerProps) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
