/**
 * Shared HTTP for ingestion adapters — timeout, retry, and rate-limit backoff.
 *
 * WHY THIS EXISTS
 *
 * Every adapter had grown its own copy of the same loop: an AbortController with
 * a timeout, a retry counter, exponential backoff, and a 429 `Retry-After`
 * check. Seven near-identical implementations that each got a slightly different
 * detail right — one honoured `Retry-After`, another didn't; one cleared its
 * timeout in a `finally`, another leaked it. The second data audit added five
 * more sources, which made "copy the loop again" the wrong answer.
 *
 * The behaviour here is the union of what the existing adapters learned the hard
 * way against real providers:
 *
 *   * 429 and 5xx are retried; 4xx other than 429 are not, because a 403 or a
 *     404 will still be a 403 or a 404 in eight seconds.
 *   * `Retry-After` is honoured when the server sends one — guessing at backoff
 *     when the provider has told us the answer is how you get rate-limited
 *     harder.
 *   * A browser-shaped `User-Agent` by default: va.gov's OGC app and
 *     careeronestop.org both 403 a bare fetch.
 *   * Aborts and network errors retry, since ECONNRESET on a large va.gov
 *     download is transient and common.
 *
 * Adapters that need something genuinely different (Feeding America's tolerance
 * for losing whole pages, the Census geocoder's 20-minute batches) keep their own
 * logic — this is for the ordinary case, not a mandate.
 */

/** Providers that reject a non-browser client, so this is the default. */
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (compatible; FrontlineIngest/1.0; +https://github.com/adiKothuri)';

export interface HttpOptions {
  /** Milliseconds before the request is aborted. */
  timeoutMs?: number;
  /** Retries after the first attempt. */
  maxRetries?: number;
  /** First backoff delay; doubles per attempt. */
  retryBaseMs?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  /** Label used in error messages, e.g. 'SAMHSA'. */
  label?: string;
}

const DEFAULTS = {
  timeoutMs: 45_000,
  maxRetries: 3,
  retryBaseMs: 1_000,
} as const;

/** Retry a 429 or a 5xx; anything else in the 4xx range is a real answer. */
const isRetryableStatus = (status: number): boolean => status === 429 || status >= 500;

/**
 * The longest `Retry-After` worth honouring. Beyond this the server is not
 * throttling us, it is telling us to come back another day — api.data.gov answers
 * an exhausted key quota with `Retry-After: 66729` (18½ hours). Sleeping on that
 * silently hangs an ingest run for the rest of the day, so it becomes a hard
 * failure instead, with a message that names the real problem.
 */
const MAX_RETRY_AFTER_MS = 120_000;

/** `Retry-After` is either seconds or an HTTP date; both appear in the wild. */
function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch with retry. Resolves with the `Response` for any non-retryable status —
 * including 4xx — so callers can treat, say, a 400 as "past the last page"
 * (NASVH) rather than an error. Throws only when retries are exhausted.
 */
export async function httpRequest(url: string, options: HttpOptions = {}): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxRetries = options.maxRetries ?? DEFAULTS.maxRetries;
  const retryBaseMs = options.retryBaseMs ?? DEFAULTS.retryBaseMs;
  const label = options.label ?? 'http';

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: { 'user-agent': DEFAULT_USER_AGENT, ...options.headers },
        body: options.body,
        signal: controller.signal,
      });
      if (!isRetryableStatus(response.status)) return response;
      if (attempt >= maxRetries) {
        throw new Error(
          `${label}: HTTP ${response.status} for ${url} after ${attempt + 1} attempts`,
        );
      }
      // The server told us how long to wait; believe it over our own guess.
      // A server asking us back in 18 hours is not throttling, it is closed for the
      // day (api.data.gov answers an exhausted key with `Retry-After: 66729`).
      // Sleeping on that hangs the whole ingest run, so it becomes a hard failure.
      const requested = retryAfterMs(response.headers.get('retry-after'));
      if (requested !== null && requested > MAX_RETRY_AFTER_MS) {
        throw new Error(
          `${label}: HTTP ${response.status} for ${url} with Retry-After ` +
            `${Math.round(requested / 1000)}s — that is a spent quota, not a rate limit. ` +
            `Refusing to sleep; fix the key or the request volume.`,
        );
      }
      const wait = requested ?? retryBaseMs * 2 ** attempt;
      console.warn(
        `[ingest] ${label}: HTTP ${response.status} — retrying in ${Math.round(wait / 1000)}s`,
      );
      await sleep(wait);
    } catch (err) {
      clearTimeout(timeout);
      // A thrown Error from the status branch above is already final.
      if (err instanceof Error && err.message.startsWith(`${label}: HTTP`)) throw err;
      if (attempt >= maxRetries) throw err;
      const wait = retryBaseMs * 2 ** attempt;
      console.warn(
        `[ingest] ${label}: ${String(err).slice(0, 90)} — retrying in ${Math.round(wait / 1000)}s`,
      );
      await sleep(wait);
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Fetch and parse JSON, throwing on any non-OK status. */
export async function fetchJson<T>(url: string, options: HttpOptions = {}): Promise<T> {
  const response = await httpRequest(url, {
    ...options,
    headers: { accept: 'application/json', ...options.headers },
  });
  if (!response.ok) {
    throw new Error(`${options.label ?? 'http'}: HTTP ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

/** Fetch and return the body as text, throwing on any non-OK status. */
export async function fetchText(url: string, options: HttpOptions = {}): Promise<string> {
  const response = await httpRequest(url, options);
  if (!response.ok) {
    throw new Error(`${options.label ?? 'http'}: HTTP ${response.status} for ${url}`);
  }
  return await response.text();
}

/** POST a JSON body and parse the JSON response. */
export async function postJson<T>(
  url: string,
  body: unknown,
  options: HttpOptions = {},
): Promise<T> {
  return fetchJson<T>(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...options.headers },
  });
}
