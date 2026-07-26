import { describe, expect, it } from 'vitest';
import { aiCacheKey } from './aiCache';

// The cache is only safe because the key changes whenever the prompt inputs do.
// These pin that property — a regression here would serve a veteran stale
// guidance for a resource whose details have since changed.
describe('aiCacheKey', () => {
  const resource = { id: 'va:123', name: 'VA Clinic', eligibility: 'Veterans only' };

  it('is stable for identical inputs', () => {
    expect(aiCacheKey('summary', { resource })).toBe(aiCacheKey('summary', { resource }));
  });

  it('changes when any resource field changes', () => {
    const edited = { ...resource, eligibility: 'Veterans and dependents' };
    expect(aiCacheKey('summary', { resource: edited })).not.toBe(
      aiCacheKey('summary', { resource }),
    );
  });

  it('separates tasks over the same resource', () => {
    expect(aiCacheKey('plan', { resource })).not.toBe(aiCacheKey('summary', { resource }));
  });

  it('separates plans for different needs over the same resource', () => {
    const a = aiCacheKey('plan', { need: { category: 'housing' }, resource });
    const b = aiCacheKey('plan', { need: { category: 'food' }, resource });
    expect(a).not.toBe(b);
  });
});
