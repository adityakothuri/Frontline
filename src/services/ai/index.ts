import type { AiService } from './AiService';
import { ClaudeAiService } from './claudeAiService';

export type {
  AiService,
  NextStepPlan,
  CallScript,
  CallScriptTone,
  BenefitSummary,
  ChatAction,
  ChatContext,
  ChatReply,
  ChatTurn,
} from './AiService';
export { AI_NOT_ADVICE_DISCLAIMER } from './AiService';
export {
  appendUserTurn,
  MAX_USER_TURN_CHARS,
  MAX_USER_TURNS,
  trimHistory,
  withCrisisIfNeeded,
} from './chatActions';

/** The app's AI service: real Claude via the Supabase edge-function proxy. */
export const aiService: AiService = new ClaudeAiService();
