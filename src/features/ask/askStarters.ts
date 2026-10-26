import type { NeedCategory } from '@/types/need';

export type AskStarter = { text: string; category: NeedCategory };

/** Placeholder shared by Home's pill and the real composer. */
export const ASK_PLACEHOLDER = 'Ask about food, housing, a VA claim…';

/**
 * Starter chips on the welcome view. In the veteran's voice, because a tap sends
 * the text as the first turn; each maps to a real category so the reply has an
 * obvious action.
 */
export const ASK_STARTERS: readonly AskStarter[] = [
  { text: 'I need food this week', category: 'essentials' },
  { text: "I'm about to lose my housing", category: 'housing' },
  { text: 'Help me understand my VA disability claim', category: 'va_benefits' },
  { text: 'How do I get a copy of my DD-214?', category: 'va_benefits' },
  { text: 'I need a ride to a VA appointment', category: 'transportation' },
  { text: "I'm looking for work", category: 'jobs' },
];
