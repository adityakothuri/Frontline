import { isNeedCategory, NEED_CATEGORY_META } from '@/types/need';
import type { ChatAction, ChatReply, ChatTurn } from './AiService';

/**
 * The client's half of the chat contract. The edge function schema-constrains the
 * model, but the app does not trust the wire: unknown kinds or categories are
 * dropped here before anything renders them.
 *
 * The caps mirror `supabase/functions/ai/chatRequest.ts`, which enforces them too.
 */

export const MAX_CHAT_ACTIONS = 3;
const MAX_CHAT_FOLLOW_UPS = 3;
/** Past this the screen offers a fresh conversation (also bounds hourly spend). */
export const MAX_USER_TURNS = 12;
export const MAX_USER_TURN_CHARS = 1_000;
/** A reply replayed as history is cut here; the function rejects longer ones. */
export const MAX_ASSISTANT_TURN_CHARS = 1_500;
/** The function's whole-request ceiling is 20 000 characters; the history is
 *  trimmed to this so the context block and a long new turn still fit. */
const MAX_HISTORY_CHARS = 17_000;
const MAX_FOLLOW_UP_CHARS = 120;
const MAX_ACTION_LABEL_CHARS = 60;

/** Narrow an unknown wire value to a `ChatAction`, or null. */
function parseAction(value: unknown): ChatAction | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as { kind?: unknown; category?: unknown; label?: unknown };
  switch (record.kind) {
    case 'results': {
      if (!isNeedCategory(record.category)) return null;
      const label =
        typeof record.label === 'string'
          ? record.label.trim().slice(0, MAX_ACTION_LABEL_CHARS)
          : '';
      return {
        kind: 'results',
        category: record.category,
        label: label.length > 0 ? label : NEED_CATEGORY_META[record.category].label,
      };
    }
    case 'map':
    case 'profile':
    case 'crisis':
      return { kind: record.kind };
    default:
      return null;
  }
}

/** One key per distinct action, so the model repeating itself costs nothing. */
const actionKey = (action: ChatAction): string =>
  action.kind === 'results' ? `results:${action.category}` : action.kind;

/**
 * Validate a reply from the wire. Returns null only when the `reply` text
 * itself is unusable; bad actions and follow-ups are simply dropped.
 */
export function sanitizeChatReply(raw: unknown): Omit<ChatReply, 'disclaimer'> | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as { reply?: unknown; actions?: unknown; followUps?: unknown };
  const reply = typeof record.reply === 'string' ? record.reply.trim() : '';
  if (reply.length === 0) return null;

  const seen = new Set<string>();
  const actions: ChatAction[] = [];
  for (const item of Array.isArray(record.actions) ? record.actions : []) {
    const action = parseAction(item);
    if (!action) continue;
    const key = actionKey(action);
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push(action);
  }
  // A crisis action always leads, even if the model forgets to put it first.
  actions.sort((a, b) => Number(b.kind === 'crisis') - Number(a.kind === 'crisis'));

  const followUps: string[] = [];
  for (const item of Array.isArray(record.followUps) ? record.followUps : []) {
    if (typeof item !== 'string') continue;
    const text = item.replace(/\s+/g, ' ').trim();
    if (text.length === 0 || text.length > MAX_FOLLOW_UP_CHARS || followUps.includes(text))
      continue;
    followUps.push(text);
  }

  return {
    reply,
    actions: actions.slice(0, MAX_CHAT_ACTIONS),
    followUps: followUps.slice(0, MAX_CHAT_FOLLOW_UPS),
  };
}

/**
 * The history after the veteran's next turn. A failed user turn left on screen
 * is *replaced* by a new one, since the function rejects two user turns in a row.
 */
export function appendUserTurn<T extends { role: 'user' | 'assistant' }>(
  entries: readonly T[],
  entry: T,
): T[] {
  const last = entries[entries.length - 1];
  return last?.role === 'user' ? [...entries.slice(0, -1), entry] : [...entries, entry];
}

/**
 * What the function is actually sent: replies cut to the length it accepts,
 * and the oldest exchanges dropped once the whole history would not fit. The
 * veteran's latest turn is never dropped, and the result still starts on a
 * user turn.
 */
export function trimHistory(turns: readonly ChatTurn[]): ChatTurn[] {
  let history = turns.map((turn) =>
    turn.role === 'assistant'
      ? { ...turn, content: turn.content.slice(0, MAX_ASSISTANT_TURN_CHARS) }
      : turn,
  );
  const size = () => history.reduce((sum, turn) => sum + turn.content.length, 0);
  // Drop a user+assistant pair from the front at a time, so the history still
  // opens on a user turn and alternates.
  while (history.length > 2 && size() > MAX_HISTORY_CHARS) history = history.slice(2);
  return history;
}

/**
 * Whether a veteran's message reads as a crisis, so a 988 row is pinned even if
 * the model omits it. A false positive costs one extra row — the right side to err on.
 */
const CRISIS_PATTERNS = [
  /suicid/i,
  /kill(ing)? myself/i,
  /end (my|it all|my life)/i,
  /want(ed)? to die/i,
  /hurt(ing)? myself/i,
  /self[- ]harm/i,
  /overdos/i,
  /don'?t want to be here/i,
  /not worth living/i,
];

export function mentionsCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}

/** Put a crisis action first if the veteran's own words called for one. */
export function withCrisisIfNeeded(actions: ChatAction[], userText: string): ChatAction[] {
  if (!mentionsCrisis(userText) || actions.some((a) => a.kind === 'crisis')) return actions;
  const crisis: ChatAction = { kind: 'crisis' };
  return [crisis, ...actions].slice(0, MAX_CHAT_ACTIONS);
}
