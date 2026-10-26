import type { Need, NeedCategory, VeteranDocument } from '@/types/need';
import type { VeteranRole } from '@/types/profile';
import type { Resource } from '@/types/resource';

/**
 * The AI seam: plans, scripts, summaries and the Ask Frontline navigator, every
 * reply ending in an in-app action. Simplified guidance, never legal, medical,
 * financial or government-certified advice. Implemented by `ClaudeAiService`.
 */

export interface PlanStep {
  title: string;
  detail: string;
}

export interface NextStepPlan {
  steps: PlanStep[];
  /** Documents worth bringing, in plain language. */
  whatToBring: string[];
  /** A fallback suggestion if this resource can't help. */
  backup: string | null;
  disclaimer: string;
}

export type CallScriptTone = 'standard' | 'short';

export interface CallScript {
  tone: CallScriptTone;
  /** The script to read aloud on the phone. */
  script: string;
  /** Short reassurance/how-to tips around the call. */
  tips: string[];
  disclaimer: string;
}

export interface BenefitSummary {
  whatItIs: string;
  whoItHelps: string;
  whoMayQualify: string;
  documentsNeeded: string[];
  deadlinesOrWarnings: string | null;
  whatToDoNext: string;
  sourceUrl: string | null;
  /** Confidence/verification note — flags non-official or unverified sources. */
  verificationNote: string;
}

// --- Ask Frontline ---------------------------------------------------------

export type ChatRole = 'user' | 'assistant';

/** One turn of the conversation as the model sees it: plain text only. */
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

/**
 * What a reply can ask the veteran to do next. Every kind maps to a real
 * destination in the app; the model cannot point anywhere else.
 */
export type ChatAction =
  | { kind: 'results'; category: NeedCategory; label: string }
  | { kind: 'map' }
  | { kind: 'profile' }
  | { kind: 'crisis' };

/** What the app knows about the person asking. Never anything sensitive. */
export interface ChatContext {
  zip?: string;
  state?: string;
  radiusMiles: number;
  firstName?: string;
  role?: VeteranRole;
  documentsOnHand?: VeteranDocument[];
}

export interface ChatReply {
  /** Plain text, a few short sentences. */
  reply: string;
  /** At most three, most useful first; a crisis action is always first. */
  actions: ChatAction[];
  /** Up to three things the veteran might say next, in their own voice. */
  followUps: string[];
  disclaimer: string;
}

export interface AiService {
  buildNextStepPlan(input: { need: Need; resource: Resource }): Promise<NextStepPlan>;
  buildCallScript(input: {
    need: Need;
    resource: Resource;
    tone: CallScriptTone;
    /** The veteran's first name, to personalize the standard script. Optional. */
    firstName?: string;
  }): Promise<CallScript>;
  summarizeBenefit(input: { resource: Resource }): Promise<BenefitSummary>;
  /** One turn of Ask Frontline. `messages` is the whole history so far, ending
   *  with the veteran's latest turn; nothing is remembered between calls. */
  chat(input: { messages: ChatTurn[]; context: ChatContext }): Promise<ChatReply>;
}

/** Attached to every AI surface so guidance is never mistaken for advice. */
export const AI_NOT_ADVICE_DISCLAIMER =
  'AI-generated guidance to help you take the next step — not legal, medical, financial, or government advice. Always confirm details with the official source.';
