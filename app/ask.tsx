import { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, NavigatorDisclaimer, PrimaryButton } from '@/components';
import { colors, spacing } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useProfile } from '@/services/profile';
import { AI_NOT_ADVICE_DISCLAIMER, type ChatAction, type ChatContext } from '@/services/ai';
import { stateFromZip } from '@/lib/zipState';
import { DEFAULT_RADIUS_MILES } from '@/types/need';
import { useChat } from '@/features/ask/useChat';
import { AskWelcome } from '@/features/ask/AskWelcome';
import { MessageBubble } from '@/features/ask/MessageBubble';
import { ActionChips } from '@/features/ask/ActionChips';
import { Composer } from '@/features/ask/Composer';
import { ChatErrorRow, ThinkingRow } from '@/features/ask/ThinkingRow';
import { chatErrorCopy } from '@/features/ask/chatErrorCopy';

// Ask Frontline: the veteran says what they need in their own words, and every
// reply ends in something to tap — places for a category, the map, the profile,
// or the Veterans Crisis Line. Every turn is a way into a workflow, not an
// open-ended chat.
//
// A plain `ScrollView`, not an inverted list: a session is at most twelve pairs,
// and `inverted` would flip screen-reader order and drag-to-dismiss.
//
// expo-router doesn't export `useHeaderHeight`, so the root view measures its
// own window offset for `keyboardVerticalOffset`.
export default function AskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { profile, isHydrated } = useProfile();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const [windowOffset, setWindowOffset] = useState<number | null>(null);
  const rootRef = useRef<View>(null);

  const zip = profile?.zip;
  const context = useMemo<ChatContext>(
    () => ({
      zip,
      state: stateFromZip(zip) ?? undefined,
      radiusMiles: profile?.preferredRadiusMiles ?? DEFAULT_RADIUS_MILES,
      firstName: profile?.firstName || undefined,
      role: profile?.role,
      documentsOnHand: profile?.documentsOnHand,
    }),
    [
      zip,
      profile?.preferredRadiusMiles,
      profile?.firstName,
      profile?.role,
      profile?.documentsOnHand,
    ],
  );

  const chat = useChat(context, isHydrated);

  const measure = useCallback(() => {
    rootRef.current?.measureInWindow((_x, y) => setWindowOffset(y));
  }, []);

  const openProfile = useCallback(
    () => router.navigate({ pathname: '/profile', params: { edit: '1' } }),
    [router],
  );

  const act = useCallback(
    (action: Exclude<ChatAction, { kind: 'crisis' }>) => {
      switch (action.kind) {
        case 'results':
          router.push({ pathname: '/results', params: { category: action.category } });
          return;
        case 'map':
          router.navigate('/map');
          return;
        case 'profile':
          openProfile();
          return;
      }
    },
    [router, openProfile],
  );

  const lastAssistantId = [...chat.entries].reverse().find((e) => e.role === 'assistant')?.id;
  // The not-advice line shows in the welcome and once after the first reply,
  // rather than pinned above the keyboard.
  const firstAssistantId = chat.entries.find((e) => e.role === 'assistant')?.id;
  const errorMessage = chat.status === 'error' ? chatErrorCopy(chat.error) : null;

  return (
    <View ref={rootRef} style={styles.root} onLayout={measure}>
      <Stack.Screen options={{ title: 'Ask Frontline' }} />
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={windowOffset ?? insets.top + 44}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.root}
            contentContainerStyle={styles.thread}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: !reduced })}
          >
            {chat.entries.length === 0 ? (
              <AskWelcome
                firstName={profile?.firstName || undefined}
                zip={zip}
                onStarter={chat.send}
                onProfile={openProfile}
              />
            ) : (
              chat.entries.map((entry) => (
                <View key={entry.id} style={styles.turn}>
                  <MessageBubble role={entry.role} text={entry.text} />
                  {entry.role === 'assistant' ? (
                    <ActionChips
                      actions={entry.actions}
                      followUps={entry.followUps}
                      showFollowUps={
                        entry.id === lastAssistantId && chat.status === 'idle' && !chat.atCap
                      }
                      onAction={act}
                      onFollowUp={chat.send}
                    />
                  ) : null}
                  {entry.id === firstAssistantId ? (
                    <NavigatorDisclaimer
                      text={AI_NOT_ADVICE_DISCLAIMER}
                      style={styles.disclaimer}
                    />
                  ) : null}
                </View>
              ))
            )}
            {chat.status === 'pending' ? <ThinkingRow zip={zip} /> : null}
            {errorMessage ? <ChatErrorRow message={errorMessage} onRetry={chat.retry} /> : null}
          </ScrollView>

          <View style={styles.foot}>
            {chat.atCap ? (
              <>
                <AppText variant="caption" color="textSecondary" style={styles.capNote}>
                  {"That's a full conversation. Start a fresh one to keep going."}
                </AppText>
                <PrimaryButton
                  label="Start a new conversation"
                  variant="secondary"
                  onPress={chat.reset}
                />
              </>
            ) : (
              <Composer onSend={chat.send} canSend={chat.canSend} autoFocus={focus === '1'} />
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  thread: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  // A reply and its actions are one turn, ruled off like a log entry.
  turn: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  disclaimer: { marginTop: spacing.xs },
  capNote: { textAlign: 'center' },
  foot: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
