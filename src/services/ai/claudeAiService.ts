import type { Need } from '@/types/need';
import type { Resource } from '@/types/resource';
import { supabaseRequest } from '../supabase/client';
import { aiCacheKey, readAiCache, writeAiCache } from './aiCache';
import { sanitizeChatReply } from './chatActions';
import {
  AI_NOT_ADVICE_DISCLAIMER,
  type AiService,
  type BenefitSummary,
  type CallScript,
  type CallScriptTone,
  type ChatContext,
  type ChatReply,
  type ChatTurn,
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
 *
 * The two calls a resource page fires automatically (summary, plan) read
 * through an on-device cache keyed by a hash of their inputs — still real model
 * output, just not re-derived for a resource whose content hasn't changed.
 */

/** Claude with adaptive thinking is slower than a DB read; give it room. */
const AI_TIMEOUT_MS = 30000;

class ClaudeAiService implements AiService {
  private async callFunction<T>(body: Record<string, unknown>): Promise<T> {
    return supabaseRequest<T>('/functions/v1/ai', {
      method: 'POST',
      body,
      timeoutMs: AI_TIMEOUT_MS,
      // A second 30s attempt would leave the veteran waiting a minute for one
      // block; the per-block retry tap in the UI is the better place to decide.
      retry: false,
    });
  }

  /**
   * Run `fetcher`, or return an equivalent cached result. Only used for the two
   * calls a resource page fires automatically — a call script is generated on an
   * explicit tap, where the veteran is asking for a fresh one.
   */
  private async cached<T>(task: string, inputs: unknown, fetcher: () => Promise<T>): Promise<T> {
    const key = aiCacheKey(task, inputs);
    const hit = await readAiCache<T>(key);
    if (hit) return hit;
    const value = await fetcher();
    await writeAiCache(key, value);
    return value;
  }

  async buildNextStepPlan(input: { need: Need; resource: Resource }): Promise<NextStepPlan> {
    const plan = await this.cached('plan', { need: input.need, resource: input.resource }, () =>
      this.callFunction<NextStepPlan>({
        task: 'plan',
        need: input.need,
        resource: input.resource,
      }),
    );
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
    return this.cached('summary', { resource: input.resource }, () =>
      this.callFunction<BenefitSummary>({
        task: 'summary',
        resource: input.resource,
      }),
    );
  }

  /**
   * Never cached: every turn is a new question, and a replayed answer to a
   * different one would be wrong. The wire shape is validated here rather than
   * trusted — see `chatActions.ts`.
   */
  async chat(input: { messages: ChatTurn[]; context: ChatContext }): Promise<ChatReply> {
    const raw = await this.callFunction<unknown>({
      task: 'chat',
      messages: input.messages,
      context: input.context,
    });
    const reply = sanitizeChatReply(raw);
    if (!reply) throw new Error('Malformed chat reply');
    return { ...reply, disclaimer: AI_NOT_ADVICE_DISCLAIMER };
  }
}

export { ClaudeAiService };
