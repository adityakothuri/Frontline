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

/**
 * The AiService: real Claude via the Supabase `ai` edge function (the API key
 * never ships in the client). There is NO simulated fallback — any failure
 * (network, rate limit, upstream) propagates to the caller, which shows an
 * error/retry state (ResourceDetail's guidance retry, CallScriptCard's retry).
 * AI output is always real model output, never templated stand-in text.
 *
 * The disclaimer is re-stamped client-side so its exact wording has one source
 * of truth.
 */

/** Claude with adaptive thinking is slower than a DB read; give it room. */
const AI_TIMEOUT_MS = 30000;

class ClaudeAiService implements AiService {
  private async callFunction<T>(body: Record<string, unknown>): Promise<T> {
    return supabaseRequest<T>('/functions/v1/ai', {
      method: 'POST',
      body,
      timeoutMs: AI_TIMEOUT_MS,
    });
  }

  async buildNextStepPlan(input: { need: Need; resource: Resource }): Promise<NextStepPlan> {
    const plan = await this.callFunction<NextStepPlan>({
      task: 'plan',
      need: input.need,
      resource: input.resource,
    });
    return { ...plan, disclaimer: AI_NOT_ADVICE_DISCLAIMER };
  }

  async buildCallScript(input: {
    need: Need;
    resource: Resource;
    tone: CallScriptTone;
    firstName?: string;
  }): Promise<CallScript> {
    const script = await this.callFunction<CallScript>({
      task: 'script',
      need: input.need,
      resource: input.resource,
      tone: input.tone,
      firstName: input.firstName,
    });
    return { ...script, disclaimer: AI_NOT_ADVICE_DISCLAIMER };
  }

  async summarizeBenefit(input: { resource: Resource }): Promise<BenefitSummary> {
    return this.callFunction<BenefitSummary>({
      task: 'summary',
      resource: input.resource,
    });
  }
}

export { ClaudeAiService };
