import { Component, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';
import { AppText } from './AppText';
import { PrimaryButton } from './PrimaryButton';

type Props = { children: ReactNode };
type State = { hasError: boolean };

// Last-resort catch for a render crash anywhere in the tree, so the app shows a
// calm recovery screen instead of a white screen or a native crash. Saved items
// and the profile live on-device, so "Try again" is safe. Wire a crash reporter
// (e.g. Sentry) in componentDidCatch when one is added.
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    // Message only — no PII. Replace with a crash reporter call when available.
    console.error('Unhandled UI error:', error instanceof Error ? error.message : error);
  }

  reset = (): void => this.setState({ hasError: false });

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.root}>
        <AppText variant="title" style={styles.center}>
          Something went wrong
        </AppText>
        <AppText variant="body" color="textSecondary" style={styles.message}>
          The app hit an unexpected problem. You can try again — your saved items and profile are
          safe on this device.
        </AppText>
        <PrimaryButton label="Try again" onPress={this.reset} style={styles.action} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  center: { textAlign: 'center' },
  message: { textAlign: 'center', maxWidth: 320 },
  action: { marginTop: spacing.lg, paddingHorizontal: spacing.xxl },
});
