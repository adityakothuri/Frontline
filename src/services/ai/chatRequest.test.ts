import { describe, expect, it } from 'vitest';
import {
  cleanTurnText,
  MAX_CHAT_MESSAGES,
  MAX_USER_TURN_CHARS,
  parseChatRequest,
  sanitizeFirstName,
} from '../../../supabase/functions/ai/chatRequest.ts';

const user = (content: string) => ({ role: 'user', content });
const assistant = (content: string) => ({ role: 'assistant', content });

/** A valid alternating history ending on the veteran, `pairs` replies deep. */
const history = (pairs: number) => {
  const out: { role: string; content: string }[] = [];
  for (let i = 0; i < pairs; i++) out.push(user(`turn ${i}`), assistant(`reply ${i}`));
  out.push(user('latest'));
  return out;
};

describe('parseChatRequest', () => {
  it('accepts a single user turn and fills the default context', () => {
    const result = parseChatRequest({ messages: [user('I need food this week')] });
    expect(result).toEqual({
      ok: true,
      request: {
        messages: [{ role: 'user', content: 'I need food this week' }],
        context: { radiusMiles: 15 },
      },
    });
  });

  it('requires a non-empty array of messages', () => {
    expect(parseChatRequest({})).toMatchObject({ ok: false, status: 400 });
    expect(parseChatRequest({ messages: [] })).toMatchObject({ ok: false, status: 400 });
    expect(parseChatRequest({ messages: 'hi' })).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects a bad role, a non-string body and an empty turn', () => {
    expect(parseChatRequest({ messages: [{ role: 'system', content: 'x' }] })).toMatchObject({
      status: 400,
    });
    expect(parseChatRequest({ messages: [{ role: 'user', content: 3 }] })).toMatchObject({
      status: 400,
    });
    expect(parseChatRequest({ messages: [user('   \u0007 ')] })).toMatchObject({ status: 400 });
  });

  it('requires the first and last turns to be the user and strict alternation', () => {
    expect(parseChatRequest({ messages: [assistant('hi'), user('x')] })).toMatchObject({
      status: 400,
    });
    expect(parseChatRequest({ messages: [user('x'), assistant('hi')] })).toMatchObject({
      status: 400,
    });
    expect(parseChatRequest({ messages: [user('x'), user('y')] })).toMatchObject({ status: 400 });
    expect(parseChatRequest({ messages: history(3) })).toMatchObject({ ok: true });
  });

  it('caps the turn count with a 400 and the turn length with a 413', () => {
    expect(parseChatRequest({ messages: history(11) }).ok).toBe(true); // 23 messages
    const tooMany = [...history(11), assistant('r'), user('u')]; // 25
    expect(tooMany.length).toBe(MAX_CHAT_MESSAGES + 1);
    expect(parseChatRequest({ messages: tooMany })).toMatchObject({ status: 400 });

    const long = 'a'.repeat(MAX_USER_TURN_CHARS + 1);
    expect(parseChatRequest({ messages: [user(long)] })).toMatchObject({ status: 413 });
  });

  it('rejects a history whose total would not fit, with a 413', () => {
    const turns = [];
    for (let i = 0; i < 10; i++) turns.push(user('u'.repeat(1000)), assistant('a'.repeat(1400)));
    turns.push(user('latest'));
    expect(parseChatRequest({ messages: turns })).toMatchObject({ status: 413 });
  });

  it('cleans control characters but keeps newlines', () => {
    const result = parseChatRequest({
      messages: [user('line one\u0000\n\n\n\nline two\u001B[0m')],
    });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.request.messages[0].content).toBe('line one\n\nline two[0m');
  });

  it('keeps only well-formed context fields', () => {
    const result = parseChatRequest({
      messages: [user('x')],
      context: {
        zip: '7870',
        state: 'tx',
        radiusMiles: 400,
        firstName: '  Marcus <script>',
        role: 'admiral',
        documentsOnHand: ['dd214', 'passport', 'dd214'],
      },
    });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.request.context).toEqual({
        radiusMiles: 100,
        firstName: 'Marcus script',
        documentsOnHand: ['dd214'],
      });
    }
  });

  it('passes a well-formed context through', () => {
    const result = parseChatRequest({
      messages: [user('x')],
      context: { zip: '78701', state: 'TX', radiusMiles: 25, role: 'veteran' },
    });
    if (result.ok) {
      expect(result.request.context).toEqual({
        zip: '78701',
        state: 'TX',
        radiusMiles: 25,
        role: 'veteran',
      });
    }
  });
});

describe('cleanTurnText / sanitizeFirstName', () => {
  it('trims and squashes blank runs', () => {
    expect(cleanTurnText('  a\n\n\n\nb\t  ')).toBe('a\n\nb');
  });

  it('keeps a name a name', () => {
    expect(sanitizeFirstName("Mary-Jo O'Neil")).toBe("Mary-Jo O'Neil");
    expect(sanitizeFirstName('')).toBeUndefined();
    expect(sanitizeFirstName(42)).toBeUndefined();
  });
});
