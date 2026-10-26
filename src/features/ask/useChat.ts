import { useCallback, useEffect, useRef, useState } from 'react';
import {
  aiService,
  appendUserTurn,
  MAX_USER_TURN_CHARS,
  MAX_USER_TURNS,
  trimHistory,
  withCrisisIfNeeded,
  type ChatAction,
  type ChatContext,
  type ChatTurn,
} from '@/services/ai';
import { reportDataError } from '@/services/monitoring';
import { tapImpact } from '@/lib/haptics';

export type ChatEntry =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; actions: ChatAction[]; followUps: string[] };

export type ChatStatus = 'idle' | 'pending' | 'error';

/**
 * One Ask Frontline conversation. Session-only by design: free text may be
 * sensitive, so the transcript never touches AsyncStorage.
 * `request` (as in `CallScriptCard`) drops replies that land after a reset,
 * retry or unmount.
 */
export function useChat(context: ChatContext, ready: boolean) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<unknown>(undefined);
  const request = useRef(0);
  const nextId = useRef(0);
  const contextRef = useRef(context);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );

  const userTurns = entries.filter((e) => e.role === 'user').length;
  const atCap = userTurns >= MAX_USER_TURNS;
  const canSend = ready && status !== 'pending' && !atCap;

  /** Ask for a reply to `history` (which already ends on the veteran's turn). */
  const ask = useCallback(async (history: ChatEntry[]) => {
    const id = ++request.current;
    setStatus('pending');
    setError(undefined);
    const messages: ChatTurn[] = trimHistory(
      history.map((e) => ({ role: e.role, content: e.text })),
    );
    const latest = history[history.length - 1]?.text ?? '';
    try {
      const reply = await aiService.chat({ messages, context: contextRef.current });
      if (id !== request.current) return;
      setEntries((prev) => [
        ...prev,
        {
          id: `a${nextId.current++}`,
          role: 'assistant',
          text: reply.reply,
          actions: withCrisisIfNeeded(reply.actions, latest),
          followUps: reply.followUps,
        },
      ]);
      setStatus('idle');
      tapImpact();
    } catch (err) {
      if (id !== request.current) return;
      reportDataError('Ask Frontline', err);
      setError(err);
      setStatus('error');
    }
  }, []);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim().slice(0, MAX_USER_TURN_CHARS);
      if (text.length === 0 || !canSend) return;
      const entry: ChatEntry = { id: `u${nextId.current++}`, role: 'user', text };
      // Replaces a failed turn rather than following it — see `appendUserTurn`.
      const history = appendUserTurn(entries, entry);
      setEntries(history);
      void ask(history);
    },
    [ask, canSend, entries],
  );

  /** The failed turn is already the last entry, so the history is unchanged. */
  const retry = useCallback(() => {
    if (status !== 'error' || entries[entries.length - 1]?.role !== 'user') return;
    void ask(entries);
  }, [ask, entries, status]);

  const reset = useCallback(() => {
    request.current += 1;
    setEntries([]);
    setStatus('idle');
    setError(undefined);
  }, []);

  return { entries, status, error, userTurns, atCap, canSend, send, retry, reset };
}
