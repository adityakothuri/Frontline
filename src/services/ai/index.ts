import type { AiService } from './AiService';
import { TemplatedAiService } from './templatedAiService';

export type {
  AiService,
  NextStepPlan,
  PlanStep,
  CallScript,
  CallScriptTone,
  BenefitSummary,
} from './AiService';
export { AI_NOT_ADVICE_DISCLAIMER } from './AiService';

/** The app's AI service. Swap for a real Claude-backed implementation later. */
export const aiService: AiService = new TemplatedAiService();
