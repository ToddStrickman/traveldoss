/**
 * Classifiers for errors thrown by the Lovable AI gateway. Gateways surface
 * the same condition in several shapes — an HTTP status number ("402"), a
 * status text ("Payment Required"), or prose ("insufficient credits") — so
 * matching any one shape silently misroutes the others (a real dossier mint
 * on 2026-07-11 retried a 402 four times, then fell back to the local parser
 * instead of telling the user to top up credits).
 */

/** Out of AI credits / payment needed — non-retryable, surface to the user. */
export function isCreditsMessage(message: string): boolean {
  return /\b402\b|credit|payment required/i.test(message);
}

/** Transient rate limiting — retry with backoff or tell the user to wait. */
export function isRateLimitMessage(message: string): boolean {
  return /\b429\b|rate limit|rate-limit|too many requests/i.test(message);
}
