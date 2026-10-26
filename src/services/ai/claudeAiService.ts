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
 * Real Claude via the Supabase `ai` edge function (the API key never ships in
 * the client). There is no simulated fallback: any failure, including a
 * malformed response, propagates to the caller's error/retry state. The
 * disclaimer is re-stamped here so its wording has one source of truth.
 */

/** Claude with adaptive thinking is slower than a DB read; give it room. */
const AI_TIMEOUT_MS = 30000;

const isString = (value: unknown): value is string => typeof value === 'string';
const stringsIn = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(isString) : [];
const stringOrNull = (value: unknown): string | null => (isString(value) ? value : null);

/** Narrow a wire plan to `NextStepPlan`, or null when it has no usable steps. */
function parsePlan(raw: unknown): Omit<NextStepPlan, 'disclaimer'> | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const steps = (Array.isArray(record.steps) ? record.steps : []).flatMap((step: unknown) => {
    const { title, detail } = (step ?? {}) as Record<string, unknown>;
    return isString(title) && isString(detail) ? [{ title, detail }] : [];
  });
  if (steps.length === 0) return null;
  return { steps, whatToBring: stringsIn(record.whatToBring), backup: stringOrNull(record.backup) };
}

/** Narrow a wire summary to `BenefitSummary`, or null when a required line is missing. */
function parseSummary(raw: unknown): BenefitSummary | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const { whatItIs, whoItHelps, whoMayQualify, whatToDoNext, verificationNote } = record;
  if (
    !isString(whatItIs) ||
    !isString(whoItHelps) ||
    !isString(whoMayQualify) ||
    !isString(whatToDoNext) ||
    !isString(verificationNote)
  ) {
    return null;
  }
  return {
    whatItIs,
    whoItHelps,
    whoMayQualify,
    documentsNeeded: stringsIn(record.documentsNeeded),
    deadlinesOrWarnings: stringOrNull(record.deadlinesOrWarnings),
    whatToDoNext,
    sourceUrl: stringOrNull(record.sourceUrl),
    verificationNote,
  };
}

export class ClaudeAiService implements AiService {
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
   * Fetch and validate, or return a valid cached result. Only for the calls a
   * resource page fires automatically; a call script is an explicit request for
   * a fresh one. A cache entry that no longer parses is refetched.
   */
  private async cached<T>(
    task: string,
    body: Record<string, unknown>,
    parse: (raw: unknown) => T | null,
  ): Promise<T> {
    const key = aiCacheKey(task, body);
    const hit = parse(await readAiCache(key));
    if (hit) return hit;
    const value = parse(await this.callFunction<unknown>({ task, ...body }));
    if (!value) throw new Error(`Malformed ${task} response`);
    await writeAiCache(key, value);
    return value;
  }

  async buildNextStepPlan(input: { need: Need; resource: Resource }): Promise<NextStepPlan> {
    const plan = await this.cached(
      'plan',
      { need: input.need, resource: input.resource },
      parsePlan,
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
    return this.cached('summary', { resource: input.resource }, parseSummary);
  }

  /** Never cached: every turn is a new question. */
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
