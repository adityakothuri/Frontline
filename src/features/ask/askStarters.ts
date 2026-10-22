import type { NeedCategory } from '@/types/need';

export type AskStarter = { text: string; category: NeedCategory };

/** What the empty field says — on Home's faux pill and in the real composer,
 *  so the tap lands on the object it touched. */
export const ASK_PLACEHOLDER = 'Ask about food, housing, a VA claim…';

/**
 * The first things a veteran might say, offered as chips on the welcome view.
 *
 * Written in the veteran's own voice, because a tap sends the text as the
 * first turn — there is no prefill step. Each names a real category so the
 * reply has an obvious action; two go to `va_benefits` because claims and
 * DD-214 copies are the two most common benefit asks and read as different
 * problems to the person asking.
 */
export const ASK_STARTERS: readonly AskStarter[] = [
  { text: 'I need food this week', category: 'essentials' },
  { text: "I'm about to lose my housing", category: 'housing' },
  { text: 'Help me understand my VA disability claim', category: 'va_benefits' },
  { text: 'How do I get a copy of my DD-214?', category: 'va_benefits' },
  { text: 'I need a ride to a VA appointment', category: 'transportation' },
  { text: "I'm looking for work", category: 'jobs' },
];
