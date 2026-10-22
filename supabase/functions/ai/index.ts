/**
 * Frontline AI proxy — the only place the Anthropic API key lives.
 *
 * POST { task: 'plan'|'script'|'summary', resource, need?, firstName?, tone? }
 * -> the exact NextStepPlan / CallScript / BenefitSummary shape from
 *    src/services/ai/AiService.ts (client re-stamps the disclaimer).
 * POST { task: 'chat', messages, context }
 * -> the ChatReply shape from the same file (see chatRequest.ts for the rules).
 *
 * Errors: 400 malformed, 401 unauthorized, 405 method, 413 payload too large,
 * 429 rate-limited/over-budget, 502 upstream/shape failure — the client surfaces
 * an error/retry state (there is no templated fallback).
 */
import Anthropic from 'npm:@anthropic-ai/sdk';
import {
  buildChatContextBlock,
  buildSystemPrompt,
  buildUserMessage,
  CHAT_SYSTEM_CORE,
  NOT_ADVICE_DISCLAIMER,
  TASK_SCHEMAS,
  type AiTask,
  type ResourceTask,
} from './prompts.ts';
import { parseChatRequest, sanitizeFirstName } from './chatRequest.ts';

const RATE_LIMIT_PER_HOUR = 30;
// The chat gets its own hourly bucket. A resource page fires two calls per
// open; one ten-turn conversation would otherwise spend a third of the shared
// allowance and a veteran who chats and then browses five places would hit 429
// on a resource page. Separate buckets mean neither surface can starve the
// other. The client also caps a session at 12 turns.
const CHAT_RATE_LIMIT_PER_HOUR = 20;

// Upper bound on caller-supplied prompt input (resource + need, serialized).
// A real resource is ~1 KB and a need ~0.5 KB; 20k chars is generous headroom
// while stopping a caller from inflating input tokens (hence cost) with a giant
// blob. Rejected with 413 before the model is ever called.
const MAX_INPUT_CHARS = 20_000;

// Bound the upstream call at the function too, not just in the client. The app
// aborts at 30s (AI_TIMEOUT_MS in src/services/ai/claudeAiService.ts), so a
// single 25s attempt returns a clean 502 just under that instead of tying up an
// isolate until the platform kills it. Retries are off on purpose: Opus with
// adaptive thinking legitimately runs long, so a second attempt would blow past
// the client's abort — and the UI already offers the veteran a retry.
const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
  timeout: 25_000,
  maxRetries: 0,
});

/**
 * The caller's IP for rate-limiting. `x-forwarded-for` is `client, proxy1, …`;
 * the LEFT-most value is client-supplied and trivially spoofable (a fresh value
 * per request would defeat the limiter), so use the RIGHT-most hop — the one
 * appended by the trusted platform proxy.
 */
function clientIp(request: Request): string {
  const parts = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) ?? 'unknown';
}

// Per-task model selection to control cost. Summaries auto-load on every
// resource open, so they run on cheap Haiku; plans and call scripts are richer,
// user-triggered guidance and run on Opus. The chat is a conversation a veteran
// is waiting on, so it runs the current Opus at low effort — the effort setting
// is its latency control — and can be moved to Sonnet via env without a
// redeploy if measured latency says so. Each is overridable via env so the
// models can be tuned without a code change. ANTHROPIC_MODEL stays the Opus
// default (backward compatible with the existing deploy).
const DEFAULT_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-4-8';
const TASK_MODELS: Record<AiTask, string> = {
  summary: Deno.env.get('ANTHROPIC_MODEL_SUMMARY') ?? 'claude-haiku-4-5',
  plan: Deno.env.get('ANTHROPIC_MODEL_PLAN') ?? DEFAULT_MODEL,
  script: Deno.env.get('ANTHROPIC_MODEL_SCRIPT') ?? DEFAULT_MODEL,
  chat: Deno.env.get('ANTHROPIC_MODEL_CHAT') ?? 'claude-opus-5-5',
};

// Adaptive thinking and the `effort` control exist on every current model
// except Haiku 4.5, which rejects both with a 400. Structured outputs
// (output_config.format) work on every tier. Gate the two fields on the model
// so the Haiku summary request is a shape Haiku accepts.
const supportsEffortControls = (model: string): boolean => model !== 'claude-haiku-4-5';

// Global hourly spend cap (USD, all callers combined). Soft app-level guard:
// at the limit we 429 and the client shows an error/retry. The hard backstop is
// the spend cap in the Anthropic console. Tune via env without a redeploy.
const AI_HOURLY_BUDGET_USD = Number(Deno.env.get('AI_HOURLY_BUDGET_USD') ?? '5');

// $/1M tokens, mirrored from the model catalog. Unknown models fall back to
// Opus pricing (conservative — never under-counts spend against the budget).
// The 5.x line is priced at the Opus 5 / Sonnet 5 list prices.
const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-5-5': { input: 5, output: 25 },
};

type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

/** Actual USD for one call. All input classes billed at input rate = a safe over-estimate. */
function estimateCostUsd(model: string, usage: Usage): number {
  const price = MODEL_PRICES[model] ?? { input: 5, output: 25 };
  const inputTokens =
    (usage.input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0);
  const outputTokens = usage.output_tokens ?? 0;
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function isTask(value: unknown): value is AiTask {
  return value === 'plan' || value === 'script' || value === 'summary' || value === 'chat';
}

/**
 * Bump-and-check the caller's hourly window. `bucket` keys a separate window
 * for a surface with its own budget (the chat); the RPC takes any string.
 */
async function checkRateLimit(request: Request, bucket?: 'chat'): Promise<boolean> {
  // Fully fail-open: the limiter must never take AI down, including on
  // network errors reaching the database.
  try {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(clientIp(request)),
    );
    const ipHash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const key = bucket ? `${bucket}:${ipHash}` : ipHash;
    const limit = bucket === 'chat' ? CHAT_RATE_LIMIT_PER_HOUR : RATE_LIMIT_PER_HOUR;

    // Service-role env vars are auto-injected into deployed functions; the
    // rate_limits table/function are granted to service_role only.
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/increment_rate_limit`,
      {
        method: 'POST',
        headers: {
          apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_ip_hash: key }),
      },
    );
    if (!response.ok) return true;
    const count = (await response.json()) as number;
    return count <= limit;
  } catch {
    return true;
  }
}

/** Service-role RPC helper for the spend-budget ledger. Returns null on failure. */
async function callSpendRpc(fn: string, body: Record<string, unknown>): Promise<number | null> {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return (await response.json()) as number;
  } catch {
    return null;
  }
}

/** True when this hour's Claude spend is already at/over budget. Fail-open: on a
 *  DB error we allow the call (the Anthropic console cap is the hard backstop). */
async function overBudget(): Promise<boolean> {
  const spend = await callSpendRpc('current_ai_spend', {});
  return spend !== null && spend >= AI_HOURLY_BUDGET_USD;
}

/** Record a completed call's cost against the hourly window. Best-effort. */
async function recordSpend(model: string, usage: Usage): Promise<void> {
  await callSpendRpc('add_ai_spend', { p_usd: estimateCostUsd(model, usage) });
}

/** The text block of a model response, or null when there is none to parse. */
function responseText(response: Anthropic.Message): string | null {
  return response.content.find((block) => block.type === 'text')?.text ?? null;
}

/**
 * The navigator chat. The history is replayed as plain text — the assistant's
 * earlier `reply` strings, never the action JSON — with the stable system core
 * and the latest user turn marked for the prompt cache, so each turn pays for
 * the new text rather than the whole conversation.
 */
async function handleChat(request: Request, body: Record<string, unknown>): Promise<Response> {
  const parsed = parseChatRequest(body);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status);
  const { messages, context } = parsed.request;

  if (!(await checkRateLimit(request, 'chat'))) {
    return json({ error: 'Rate limit exceeded — try again later' }, 429);
  }
  if (await overBudget()) {
    return json({ error: 'AI budget reached — try again later' }, 429);
  }

  const model = TASK_MODELS.chat;
  const useEffortControls = supportsEffortControls(model);
  const last = messages.length - 1;

  try {
    const response = await anthropic.messages.create({
      model,
      // A reply is ~70 words plus its JSON; thinking at low effort shares this
      // cap. 2048 bounds the cost of any single turn.
      max_tokens: 2048,
      ...(useEffortControls ? { thinking: { type: 'adaptive' as const } } : {}),
      system: [
        { type: 'text', text: CHAT_SYSTEM_CORE, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: buildChatContextBlock(context) },
      ],
      output_config: {
        ...(useEffortControls ? { effort: 'low' as const } : {}),
        format: { type: 'json_schema', schema: TASK_SCHEMAS.chat },
      },
      messages: messages.map((turn, i) =>
        i === last
          ? {
              role: turn.role,
              content: [
                { type: 'text' as const, text: turn.content, cache_control: { type: 'ephemeral' as const } },
              ],
            }
          : { role: turn.role, content: turn.content },
      ),
    });

    await recordSpend(model, response.usage as Usage);

    // A refusal is an answer, not an outage: a retry would only repeat it, so
    // the veteran gets a fixed line and the conversation keeps its footing.
    if (response.stop_reason === 'refusal') {
      return json({
        reply:
          "I can only help with finding veteran resources and benefits, so I'll leave that one. Tell me what kind of help you're looking for.",
        actions: [],
        followUps: [],
        disclaimer: NOT_ADVICE_DISCLAIMER,
      });
    }
    const text = responseText(response);
    // Hitting the cap means truncated JSON; that one a retry can fix.
    if (!text || response.stop_reason === 'max_tokens') {
      return json({ error: 'Empty model response' }, 502);
    }
    const content = JSON.parse(text) as {
      reply: string;
      actions: unknown[];
      followUps: string[];
    };
    return json({
      reply: content.reply,
      actions: content.actions.slice(0, 3),
      followUps: content.followUps.slice(0, 3),
      disclaimer: NOT_ADVICE_DISCLAIMER,
    });
  } catch (error) {
    console.error('ai chat error:', error instanceof Error ? error.message : error);
    return json({ error: 'Upstream failure' }, 502);
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  // verify_jwt is off (the newer sb_publishable_ anon keys aren't JWTs), so the
  // function gates itself: the `apikey` header must be this project's anon key.
  // Supabase injects SUPABASE_ANON_KEY into deployed functions.
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!anonKey || request.headers.get('apikey') !== anonKey) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { task, resource, need } = body;
  if (!isTask(task)) return json({ error: 'task must be plan | script | summary | chat' }, 400);
  if (task === 'chat') return handleChat(request, body);
  const resourceTask: ResourceTask = task;

  if (
    typeof resource !== 'object' ||
    resource === null ||
    typeof (resource as { id?: unknown }).id !== 'string'
  ) {
    return json({ error: 'resource is required' }, 400);
  }
  if (
    (resourceTask === 'plan' || resourceTask === 'script') &&
    (typeof need !== 'object' || need === null)
  ) {
    return json({ error: 'need is required for this task' }, 400);
  }

  // Bound caller-supplied input before spending tokens on it.
  const inputChars = JSON.stringify(resource).length + (need ? JSON.stringify(need).length : 0);
  if (inputChars > MAX_INPUT_CHARS) {
    return json({ error: 'Request payload too large' }, 413);
  }

  if (!(await checkRateLimit(request))) {
    return json({ error: 'Rate limit exceeded — try again later' }, 429);
  }

  // Global hourly spend cap — return 429 rather than overspend.
  if (await overBudget()) {
    return json({ error: 'AI budget reached — try again later' }, 429);
  }

  const tone = body.tone === 'short' ? 'short' : 'standard';
  const firstName = sanitizeFirstName(body.firstName);

  const model = TASK_MODELS[resourceTask];
  const useEffortControls = supportsEffortControls(model);

  try {
    const response = await anthropic.messages.create({
      model,
      // Thinking tokens share this budget; low effort + 4096 keeps short
      // guidance outputs from truncating while still bounding abuse cost. On
      // Haiku (no adaptive thinking / effort) the cap alone bounds output.
      max_tokens: 4096,
      // Adaptive thinking + effort only on the models that support them (Opus
      // here); Haiku would 400. Structured outputs stay on for every task.
      ...(useEffortControls ? { thinking: { type: 'adaptive' as const } } : {}),
      system: buildSystemPrompt(resourceTask),
      output_config: {
        ...(useEffortControls ? { effort: 'low' as const } : {}),
        format: { type: 'json_schema', schema: TASK_SCHEMAS[resourceTask] },
      },
      messages: [
        {
          role: 'user',
          content: buildUserMessage({ task: resourceTask, resource, need, firstName, tone }),
        },
      ],
    });

    // Record actual cost (input tokens are billed even on a refusal/empty reply).
    await recordSpend(model, response.usage as Usage);

    if (response.stop_reason === 'refusal') return json({ error: 'Model declined' }, 502);
    const text = responseText(response);
    if (!text) return json({ error: 'Empty model response' }, 502);
    const content = JSON.parse(text) as Record<string, unknown>;

    // Assemble the exact client shapes; constants and resource-derived fields
    // are added here, not asked of the model.
    const sourceUrl = (resource as { source_url?: string | null }).source_url ?? null;
    const payload =
      resourceTask === 'plan'
        ? { ...content, disclaimer: NOT_ADVICE_DISCLAIMER }
        : resourceTask === 'script'
          ? { tone, ...content, disclaimer: NOT_ADVICE_DISCLAIMER }
          : { ...content, sourceUrl }; // BenefitSummary carries no disclaimer field

    return json(payload);
  } catch (error) {
    console.error('ai function error:', error instanceof Error ? error.message : error);
    return json({ error: 'Upstream failure' }, 502);
  }
});
