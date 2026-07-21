import { supabaseConfig } from '../supabase/config';
import type { AiService } from './AiService';
import { ClaudeAiService } from './claudeAiService';
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

/**
 * The app's AI service. Real Claude (via the Supabase edge-function proxy)
 * when EXPO_PUBLIC_SUPABASE_* env is set; otherwise the deterministic
 * templated implementation. ClaudeAiService itself falls back to templated
 * per-call on any failure, so AI features never hard-fail.
 */
export const aiService: AiService = supabaseConfig
  ? new ClaudeAiService()
  : new TemplatedAiService();
