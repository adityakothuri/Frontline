import { describe, expect, it } from 'vitest';
import { NEED_CATEGORIES } from '@/types/need';
import {
  buildChatContextBlock,
  CHAT_CATEGORIES,
  TASK_SCHEMAS,
} from '../../../supabase/functions/ai/prompts.ts';

// The edge function's chat schema constrains the `results` action to a mirrored
// list of category ids. If the app's list changes and the mirror does not, the
// model can be stopped from pointing at a category the app has — or pointed at
// one it no longer has. This is the only thing that notices.
describe('chat schema', () => {
  it('mirrors the app need categories exactly', () => {
    expect([...CHAT_CATEGORIES]).toEqual(NEED_CATEGORIES);
  });

  it('closes every object (structured outputs reject anything else)', () => {
    const open: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node !== 'object' || node === null) return;
      const record = node as Record<string, unknown>;
      if (record.type === 'object' && record.additionalProperties !== false) open.push(path);
      for (const [key, value] of Object.entries(record)) {
        if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${path}.${key}[${i}]`));
        else walk(value, `${path}.${key}`);
      }
    };
    for (const [task, schema] of Object.entries(TASK_SCHEMAS)) walk(schema, task);
    expect(open).toEqual([]);
  });

  it('tells the model when location is unknown, and only then', () => {
    expect(buildChatContextBlock({ radiusMiles: 15 })).toMatch(/^Location unknown/);
    expect(buildChatContextBlock({ zip: '78701', radiusMiles: 15 })).toMatch(/^<VETERAN_CONTEXT>/);
  });

  it('never uses array or string constraints the API rejects', () => {
    const banned = ['maxItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum'];
    const text = JSON.stringify(TASK_SCHEMAS);
    for (const keyword of banned) expect(text).not.toContain(`"${keyword}"`);
  });
});
