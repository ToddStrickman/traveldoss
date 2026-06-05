/**
 * Retry helpers shared by Gmail / Google Docs gateway calls.
 *
 * - `fetchWithRetry` retries transient HTTP failures (network errors,
 *   429, and 5xx) with exponential backoff + jitter.
 * - `withRetry` wraps an arbitrary async thunk with the same policy and
 *   is used to retry whole pipelines (e.g. create-doc + batchUpdate).
 *
 * 4xx (other than 429) are NOT retried — they are auth / scope /
 * validation errors that won't succeed on a second attempt.
 */

export type RetryOptions = {
  attempts?: number;
  baseMs?: number;
  maxMs?: number;
  onAttempt?: (info: { attempt: number; error: unknown }) => void;
};

const DEFAULTS: Required<Omit<RetryOptions, "onAttempt">> = {
  attempts: 3,
  baseMs: 400,
  maxMs: 4000,
};

function backoff(attempt: number, baseMs: number, maxMs: number): number {
  const exp = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
  // full jitter
  return Math.floor(Math.random() * exp);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: RetryOptions = {},
): Promise<Response> {
  const { attempts, baseMs, maxMs } = { ...DEFAULTS, ...opts };
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok || !isRetryableStatus(res.status) || attempt === attempts) {
        return res;
      }
      lastError = new Error(`HTTP ${res.status}`);
      opts.onAttempt?.({ attempt, error: lastError });
    } catch (err) {
      lastError = err;
      opts.onAttempt?.({ attempt, error: err });
      if (attempt === attempts) throw err;
    }
    await new Promise((r) => setTimeout(r, backoff(attempt, baseMs, maxMs)));
  }
  // Should be unreachable, but TS needs a return.
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { attempts, baseMs, maxMs } = { ...DEFAULTS, ...opts };
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      opts.onAttempt?.({ attempt, error: err });
      if (attempt === attempts) throw err;
      // Don't retry obvious non-transient errors (auth / validation).
      const msg = err instanceof Error ? err.message : String(err);
      if (/\b(401|403|404|invalid|unauthorized|forbidden)\b/i.test(msg)) {
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, backoff(attempt, baseMs, maxMs)));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}