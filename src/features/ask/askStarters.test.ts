import { describe, expect, it } from 'vitest';
import { isNeedCategory } from '@/types/need';
import { ASK_STARTERS } from './askStarters';

describe('ASK_STARTERS', () => {
  it('each names a real category', () => {
    for (const starter of ASK_STARTERS) expect(isNeedCategory(starter.category)).toBe(true);
  });

  it('are short, distinct, and fit a chip', () => {
    const texts = ASK_STARTERS.map((s) => s.text);
    expect(new Set(texts).size).toBe(texts.length);
    for (const text of texts) expect(text.length).toBeLessThanOrEqual(60);
  });
});
