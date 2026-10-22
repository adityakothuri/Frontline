import type { AiService } from './AiService';
import { ClaudeAiService } from './claudeAiService';

export type {
  AiService,
  NextStepPlan,
  PlanStep,
  CallScript,
  CallScriptTone,
  BenefitSummary,
  ChatAction,
  ChatContext,
  ChatReply,
  ChatRole,
  ChatTurn,
} from './AiService';
export { AI_NOT_ADVICE_DISCLAIMER } from './AiService';

/**
 * The app's AI service — real Claude via the Supabase edge-function proxy,
 * always. There is no simulated/templated fallback: on any failure the calling
 * screen shows an error/retry state. Without Supabase env, calls throw (same
 * error/retry path), never templated stand-in text.
 */
export const aiService: AiService = new ClaudeAiService();
