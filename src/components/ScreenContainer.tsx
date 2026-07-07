import type { ReactNode } from 'react';
import {
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
  contentStyle?: StyleProp<ViewStyle>;
};

export function ScreenContainer({
  children,
  scroll = false,
  edges = ['top'],
  contentStyle,
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, contentStyle]}>
          {children}
        </View>
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
