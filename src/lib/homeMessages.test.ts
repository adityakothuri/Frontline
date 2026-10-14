import { describe, expect, it } from 'vitest';
import { dailyHomeMessage } from './homeMessages';

// `dailyHomeMessage` is the only pure unit on Home, and its two invariants are
// both easy to break by editing the copy alone: the index has to stay inside the
// array, and the message has to stay put for a whole day rather than changing
// under a veteran mid-session.
describe('dailyHomeMessage', () => {
  it('returns a real message for any day of a year', () => {
    for (let day = 0; day < 365; day += 1) {
      const message = dailyHomeMessage(new Date(Date.UTC(2026, 0, 1 + day)));
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    }
  });

  it('holds the same message across a single day', () => {
    const morning = dailyHomeMessage(new Date(Date.UTC(2026, 7, 5, 0, 0, 1)));
    const midday = dailyHomeMessage(new Date(Date.UTC(2026, 7, 5, 12, 30)));
    const night = dailyHomeMessage(new Date(Date.UTC(2026, 7, 5, 23, 59, 59)));
    expect(midday).toBe(morning);
    expect(night).toBe(morning);
  });

  it('moves on to a different message the next day', () => {
    const today = dailyHomeMessage(new Date(Date.UTC(2026, 7, 5, 9)));
    const tomorrow = dailyHomeMessage(new Date(Date.UTC(2026, 7, 6, 9)));
    expect(tomorrow).not.toBe(today);
  });

  // The start card asks "What do you need help with?" directly beneath this
  // line. Two of the original six messages asked the same thing in other words,
  // so the page put a question above a question and answered neither.
  it('never asks a question, so it cannot compete with the start card', () => {
    for (let day = 0; day < 30; day += 1) {
      expect(dailyHomeMessage(new Date(Date.UTC(2026, 0, 1 + day)))).not.toContain('?');
    }
  });
});
