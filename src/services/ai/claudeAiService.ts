import type { Need } from '@/types/need';
import type { Resource } from '@/types/resource';
import { supabaseRequest } from '../supabase/client';
import {
  AI_NOT_ADVICE_DISCLAIMER,
  type AiService,
  type BenefitSummary,
  type CallScript,
  type CallScriptTone,
  type NextStepPlan,
} from './AiService';
import { TemplatedAiService } from './templatedAiService';

/**
 * Real Claude behind the AiService seam, via the Supabase `ai` edge function
 * (the API key never ships in the client). Any failure — network, rate limit,
 * upstream — falls back per-call to the templated implementation, which was
 * the shipped product and is always safe: AI features never hard-fail.
 *
 * The disclaimer is re-stamped client-side so its exact wording has one source
 * of truth regardless of which implementation answered.
 */

/** Claude with adaptive thinking is slower than a DB read; give it room. */
const AI_TIMEOUT_MS = 30000;

class ClaudeAiService implements AiService {
  private readonly fallback = new TemplatedAiService();

  private async callFunction<T>(body: Record<string, unknown>): Promise<T> {
    return supabaseRequest<T>('/functions/v1/ai', {
      method: 'POST',
      body,
      timeoutMs: AI_TIMEOUT_MS,
    });
  }

  async buildNextStepPlan(input: { need: Need; resource: Resource }): Promise<NextStepPlan> {
    try {
      const plan = await this.callFunction<NextStepPlan>({
        task: 'plan',
        need: input.need,
        resource: input.resource,
      });
      return { ...plan, disclaimer: AI_NOT_ADVICE_DISCLAIMER };
    } catch {
      return this.fallback.buildNextStepPlan(input);
    }
  }

  async buildCallScript(input: {
    need: Need;
    resource: Resource;
    tone: CallScriptTone;
    firstName?: string;
  }): Promise<CallScript> {
    try {
      const script = await this.callFunction<CallScript>({
        task: 'script',
        need: input.need,
        resource: input.resource,
        tone: input.tone,
        firstName: input.firstName,
      });
      return { ...script, disclaimer: AI_NOT_ADVICE_DISCLAIMER };
    } catch {
      return this.fallback.buildCallScript(input);
    }
  }

  async summarizeBenefit(input: { resource: Resource }): Promise<BenefitSummary> {
    try {
      return await this.callFunction<BenefitSummary>({
        task: 'summary',
        resource: input.resource,
      });
    } catch {
      return this.fallback.summarizeBenefit(input);
    }
  }
}

export { ClaudeAiService };
