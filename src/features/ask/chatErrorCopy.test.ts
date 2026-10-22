import { describe, expect, it } from 'vitest';
import { NotConfiguredError, SupabaseRequestError } from '@/services/supabase/client';
import { chatErrorCopy } from './chatErrorCopy';

describe('chatErrorCopy', () => {
  it('tells the veteran to wait on a rate limit or budget stop', () => {
    expect(chatErrorCopy(new SupabaseRequestError('Rate limit exceeded', 429))).toMatch(/minute/);
  });

  it('asks for a shorter message on 413', () => {
    expect(chatErrorCopy(new SupabaseRequestError('too large', 413))).toMatch(/shorter/);
  });

  it('treats a 5xx as a plain retry', () => {
    expect(chatErrorCopy(new SupabaseRequestError('Upstream failure', 502))).toBe(
      "Couldn't get an answer just now.",
    );
  });

  it('names the signal on a timeout and the connection on a network failure', () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(chatErrorCopy(abort)).toMatch(/signal/);
    expect(chatErrorCopy(new TypeError('Network request failed'))).toMatch(/connection/);
    expect(chatErrorCopy(new NotConfiguredError())).toMatch(/connection/);
  });

  it('has a plain line for anything else', () => {
    expect(chatErrorCopy('what')).toBe("Couldn't get an answer just now.");
  });
});
