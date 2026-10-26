import { describe, expect, it } from 'vitest';
import {
  appendUserTurn,
  MAX_ASSISTANT_TURN_CHARS,
  MAX_CHAT_ACTIONS,
  mentionsCrisis,
  sanitizeChatReply,
  trimHistory,
  withCrisisIfNeeded,
} from './chatActions';

describe('sanitizeChatReply', () => {
  it('returns null when the reply text is unusable', () => {
    expect(sanitizeChatReply(null)).toBeNull();
    expect(sanitizeChatReply({ reply: '   ', actions: [] })).toBeNull();
    expect(sanitizeChatReply({ reply: 42 })).toBeNull();
  });

  it('keeps well-formed actions and drops the rest', () => {
    const out = sanitizeChatReply({
      reply: ' Here you go. ',
      actions: [
        { kind: 'results', category: 'housing', label: 'Housing help near you' },
        { kind: 'results', category: 'pets', label: 'Pet help' },
        { kind: 'teleport' },
        { kind: 'map' },
        'map',
        null,
      ],
      followUps: [],
    });
    expect(out).toEqual({
      reply: 'Here you go.',
      actions: [
        { kind: 'results', category: 'housing', label: 'Housing help near you' },
        { kind: 'map' },
      ],
      followUps: [],
    });
  });

  it('falls back to the category label when the model leaves it blank', () => {
    const out = sanitizeChatReply({
      reply: 'x',
      actions: [{ kind: 'results', category: 'va_benefits', label: '  ' }],
    });
    expect(out?.actions).toEqual([
      { kind: 'results', category: 'va_benefits', label: 'Disability & VA benefits' },
    ]);
  });

  it('dedupes, caps at three and puts the crisis line first', () => {
    const out = sanitizeChatReply({
      reply: 'x',
      actions: [
        { kind: 'map' },
        { kind: 'map' },
        { kind: 'results', category: 'housing', label: 'A' },
        { kind: 'results', category: 'housing', label: 'B' },
        { kind: 'crisis' },
        { kind: 'profile' },
      ],
    });
    expect(out?.actions).toHaveLength(MAX_CHAT_ACTIONS);
    expect(out?.actions[0]).toEqual({ kind: 'crisis' });
    expect(out?.actions.map((a) => a.kind)).toEqual(['crisis', 'map', 'results']);
  });

  it('cleans follow-ups: strings only, trimmed, unique, bounded', () => {
    const out = sanitizeChatReply({
      reply: 'x',
      followUps: [
        ' I also need a ride ',
        'I also need a ride',
        7,
        '',
        'a'.repeat(121),
        'b',
        'c',
        'd',
      ],
    });
    expect(out?.followUps).toEqual(['I also need a ride', 'b', 'c']);
  });
});

describe('mentionsCrisis', () => {
  it('matches the obvious phrasings', () => {
    for (const text of [
      'I want to die',
      "honestly i don't want to be here anymore",
      'thinking about killing myself',
      'I keep hurting myself',
      'self-harm again last night',
    ]) {
      expect(mentionsCrisis(text), text).toBe(true);
    }
  });

  it('leaves ordinary asks alone', () => {
    for (const text of ['I need food this week', 'help with my DD-214', 'rent is late']) {
      expect(mentionsCrisis(text), text).toBe(false);
    }
  });

  it('accepts a false positive rather than miss', () => {
    // A volunteer application mentioning the word still earns a 988 row. That is
    // the side to err on, and this test records that it is deliberate.
    expect(mentionsCrisis('applying to be a suicide-prevention volunteer')).toBe(true);
  });
});

describe('withCrisisIfNeeded', () => {
  it('prepends a crisis action when the veteran said something that calls for one', () => {
    expect(withCrisisIfNeeded([{ kind: 'map' }], 'I want to die')).toEqual([
      { kind: 'crisis' },
      { kind: 'map' },
    ]);
  });

  it('leaves the list alone otherwise, or when crisis is already there', () => {
    expect(withCrisisIfNeeded([{ kind: 'map' }], 'food')).toEqual([{ kind: 'map' }]);
    expect(withCrisisIfNeeded([{ kind: 'crisis' }, { kind: 'map' }], 'I want to die')).toEqual([
      { kind: 'crisis' },
      { kind: 'map' },
    ]);
  });
});

describe('appendUserTurn', () => {
  const u = (text: string) => ({ role: 'user' as const, text });
  const a = (text: string) => ({ role: 'assistant' as const, text });

  it('appends after a reply', () => {
    expect(appendUserTurn([u('a'), a('b')], u('c'))).toEqual([u('a'), a('b'), u('c')]);
  });

  it('replaces a trailing user turn (one that failed) instead of doubling it', () => {
    expect(appendUserTurn([u('a'), a('b'), u('failed')], u('c'))).toEqual([u('a'), a('b'), u('c')]);
    expect(appendUserTurn([], u('first'))).toEqual([u('first')]);
  });
});

describe('trimHistory', () => {
  const u = (content: string) => ({ role: 'user' as const, content });
  const a = (content: string) => ({ role: 'assistant' as const, content });

  it('cuts replies to the length the function accepts', () => {
    const out = trimHistory([u('q'), a('x'.repeat(MAX_ASSISTANT_TURN_CHARS + 50)), u('q2')]);
    expect(out[1].content).toHaveLength(MAX_ASSISTANT_TURN_CHARS);
  });

  it('drops the oldest exchanges once the whole history would not fit', () => {
    const turns = [];
    for (let i = 0; i < 12; i++) turns.push(u('u'.repeat(1000)), a('a'.repeat(1500)));
    turns.push(u('latest'));
    const out = trimHistory(turns);
    expect(out[0].role).toBe('user');
    expect(out[out.length - 1]).toEqual(u('latest'));
    expect(out.reduce((n, t) => n + t.content.length, 0)).toBeLessThanOrEqual(17_000);
    expect(out.length % 2).toBe(1);
  });

  it('caps the results label and flattens follow-up whitespace', () => {
    const out = sanitizeChatReply({
      reply: 'x',
      actions: [{ kind: 'results', category: 'jobs', label: 'L'.repeat(80) }],
      followUps: ['two\nlines  here'],
    });
    expect(out?.actions[0]).toMatchObject({ label: 'L'.repeat(60) });
    expect(out?.followUps).toEqual(['two lines here']);
  });
});

describe('withCrisisIfNeeded at the cap', () => {
  it('drops the last action to make room for the crisis line', () => {
    const full = withCrisisIfNeeded(
      [{ kind: 'map' }, { kind: 'profile' }, { kind: 'results', category: 'jobs', label: 'J' }],
      'I want to die',
    );
    expect(full.map((a) => a.kind)).toEqual(['crisis', 'map', 'profile']);
  });
});
