import type { Need } from '@/types/need';
import type { Resource } from '@/types/resource';

/**
 * The AI seam. All AI in Frontline is **embedded in workflows**, never a chatbot,
 * and is **simplified guidance — never legal, medical, financial, or
 * government-certified advice**. See `docs/obsidian/03 Technical/AI Feature Design.md`.
 *
 * The MVP ships a deterministic templated implementation
 * (`templatedAiService`). A real Claude-backed implementation later sits behind
 * this same interface, called through a proxy (the API key never ships in the
 * client — see `docs/obsidian/03 Technical/Environment Variables.md`).
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

export interface AiService {
  buildNextStepPlan(input: { need: Need; resource: Resource }): Promise<NextStepPlan>;
  buildCallScript(input: {
    need: Need;
    resource: Resource;
    tone: CallScriptTone;
  }): Promise<CallScript>;
  summarizeBenefit(input: { resource: Resource }): Promise<BenefitSummary>;
}

/** Attached to every AI surface so guidance is never mistaken for advice. */
export const AI_NOT_ADVICE_DISCLAIMER =
  'AI-generated guidance to help you take the next step — not legal, medical, financial, or government advice. Always confirm details with the official source.';
