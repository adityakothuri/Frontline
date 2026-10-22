/**
 * Validation for the `chat` task's request body.
 *
 * Pure on purpose — no Deno globals, no SDK — so the app's vitest suite can
 * import it (`src/services/ai/chatRequest.test.ts`) and pin the rules that keep
 * the free-text surface bounded. The caps here are mirrored on the client in
 * `src/services/ai/chatActions.ts`; the client enforces them first so a veteran
 * sees a local message, and this file enforces them so nothing else can bypass
 * that.
 */

export type ChatRole = 'user' | 'assistant';
export type ChatTurn = { role: ChatRole; content: string };

export const CHAT_ROLES: readonly ['veteran', 'active_duty', 'family', 'caregiver', 'other'] = [
  'veteran',
  'active_duty',
  'family',
  'caregiver',
  'other',
];
export type ChatVeteranRole = (typeof CHAT_ROLES)[number];

export const CHAT_DOCUMENTS: readonly [
  'veteran_id',
  'va_card',
  'dd214',
  'photo_id',
  'proof_of_address',
  'proof_of_income',
] = ['veteran_id', 'va_card', 'dd214', 'photo_id', 'proof_of_address', 'proof_of_income'];
export type ChatDocument = (typeof CHAT_DOCUMENTS)[number];

/** What the model is told about the person. Every field is optional except the
 *  radius, which the client always has (it defaults). */
export type ChatContext = {
  zip?: string;
  state?: string;
  radiusMiles: number;
  firstName?: string;
  role?: ChatVeteranRole;
  documentsOnHand?: ChatDocument[];
};

export type ChatRequest = { messages: ChatTurn[]; context: ChatContext };
export type ChatRequestResult =
  | { ok: true; request: ChatRequest }
  | { ok: false; status: 400 | 413; error: string };

/** 12 veteran turns and the 11 replies between them. The client stops at 12
 *  turns too; past that it offers a fresh conversation. */
export const MAX_CHAT_MESSAGES = 24;
/** One phone-typed message. 1 000 characters is ~180 words — generous for a need,
 *  far short of a pasted document. */
export const MAX_USER_TURN_CHARS = 1_000;
/** Replies are prompted to ~70 words; this is headroom, not a target. */
export const MAX_ASSISTANT_TURN_CHARS = 1_500;
/** Everything the prompt sees, summed. Same ceiling as the resource tasks. */
export const MAX_CHAT_INPUT_CHARS = 20_000;

export const DEFAULT_RADIUS_MILES = 15;
const MIN_RADIUS_MILES = 1;
const MAX_RADIUS_MILES = 100;

/**
 * Only free-text field a user controls outside the messages; keep it a name,
 * nothing more. Shared with the script task, which personalises its opening.
 */
export function sanitizeFirstName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value
    .slice(0, 40)
    .replace(/[^\p{L}\p{N} '.-]/gu, '')
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/** Strip C0/C1 control characters (keeping newline and tab), squash runs of
 *  blank lines, trim. What is left is what the model reads. */
export function cleanTurnText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isRole(value: unknown): value is ChatRole {
  return value === 'user' || value === 'assistant';
}

function parseContext(raw: unknown): ChatContext {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const context: ChatContext = { radiusMiles: DEFAULT_RADIUS_MILES };

  if (typeof source.zip === 'string' && /^\d{5}$/.test(source.zip)) context.zip = source.zip;
  if (typeof source.state === 'string' && /^[A-Z]{2}$/.test(source.state)) {
    context.state = source.state;
  }
  if (typeof source.radiusMiles === 'number' && Number.isFinite(source.radiusMiles)) {
    context.radiusMiles = Math.min(
      MAX_RADIUS_MILES,
      Math.max(MIN_RADIUS_MILES, Math.round(source.radiusMiles)),
    );
  }
  const firstName = sanitizeFirstName(source.firstName);
  if (firstName) context.firstName = firstName;
  if (CHAT_ROLES.includes(source.role as ChatVeteranRole)) {
    context.role = source.role as ChatVeteranRole;
  }
  if (Array.isArray(source.documentsOnHand)) {
    const documents = source.documentsOnHand.filter((d): d is ChatDocument =>
      CHAT_DOCUMENTS.includes(d as ChatDocument),
    );
    if (documents.length > 0) context.documentsOnHand = Array.from(new Set(documents));
  }
  return context;
}

/**
 * Validate and normalise a chat request. Shape errors are 400; size errors are
 * 413, so the client can tell "shorten it" from "that is not a request".
 */
export function parseChatRequest(body: Record<string, unknown>): ChatRequestResult {
  const raw = body.messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, status: 400, error: 'messages must be a non-empty array' };
  }
  if (raw.length > MAX_CHAT_MESSAGES) {
    return { ok: false, status: 400, error: `messages must have at most ${MAX_CHAT_MESSAGES} turns` };
  }

  const messages: ChatTurn[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, status: 400, error: 'each message needs a role and content' };
    }
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (!isRole(role) || typeof content !== 'string') {
      return { ok: false, status: 400, error: 'each message needs a role and content' };
    }
    const text = cleanTurnText(content);
    if (text.length === 0) {
      return { ok: false, status: 400, error: 'a message cannot be empty' };
    }
    const cap = role === 'user' ? MAX_USER_TURN_CHARS : MAX_ASSISTANT_TURN_CHARS;
    if (text.length > cap) {
      return { ok: false, status: 413, error: `a ${role} message is longer than ${cap} characters` };
    }
    messages.push({ role, content: text });
  }

  // The API requires the first turn to be the user's; we also require the last
  // (there is nothing to reply to otherwise) and strict alternation, so a
  // replayed history can never be reordered into something the model did not say.
  if (messages[0].role !== 'user' || messages[messages.length - 1].role !== 'user') {
    return {
      ok: false,
      status: 400,
      error: 'messages must alternate user/assistant and end with a user turn',
    };
  }
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === messages[i - 1].role) {
      return {
        ok: false,
        status: 400,
        error: 'messages must alternate user/assistant and end with a user turn',
      };
    }
  }

  const context = parseContext(body.context);
  const totalChars =
    messages.reduce((sum, turn) => sum + turn.content.length, 0) + JSON.stringify(context).length;
  if (totalChars > MAX_CHAT_INPUT_CHARS) {
    return { ok: false, status: 413, error: 'Request payload too large' };
  }

  return { ok: true, request: { messages, context } };
}
