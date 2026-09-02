/**
 * Path and URL scrubbing for third-party page-view reporting.
 *
 * GA must never receive a real trip slug, guide slug, or template id: it would
 * both explode the report into one row per dossier and leak an identifier into
 * a third-party dashboard. `/t/<slug>` is worse than noisy — it is a capability
 * URL, so possessing the slug is enough to read the dossier. Every dynamic
 * segment collapses to a placeholder so GA reports one row per page *type*.
 */

const RULES: Array<[RegExp, string]> = [
  [/^\/t\/[^/]+/, "/t/:slug"],
  [/^\/guides\/[^/]+/, "/guides/:slug"],
  [/^\/templates\/[^/]+/, "/templates/:id"],
  [/^\/auth\/.+/, "/auth/*"],
];

/** Collapses dynamic URL segments to stable placeholders. Query and hash are dropped. */
export function scrubPath(pathname: string): string {
  const path = (pathname || "/").split("?")[0].split("#")[0];
  for (const [re, replacement] of RULES) {
    if (re.test(path)) {
      const rest = path.replace(re, "");
      return replacement + rest;
    }
  }
  return path;
}

/**
 * Query keys whose values must never be transmitted. Supabase OAuth callbacks
 * park tokens in the URL, and a referrer captured from such a page would carry
 * them verbatim.
 */
const SENSITIVE_PARAM_KEYS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "code",
  "id_token",
  "key",
  "password",
  "provider_refresh_token",
  "provider_token",
  "refresh_token",
  "secret",
  "session",
  "state",
  "token",
]);

const REDACTED = "[Filtered]";

/**
 * Scrub a full URL (used for `page_referrer`): placeholder the path, redact
 * sensitive query values, drop the fragment. A string that does not parse as an
 * absolute URL falls back to `scrubPath`, so a malformed input can never leak a
 * slug.
 */
export function scrubUrl(raw: string): string {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    url.pathname = scrubPath(url.pathname);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_PARAM_KEYS.has(key.toLowerCase())) {
        url.searchParams.set(key, REDACTED);
      }
    }
    url.hash = "";
    return url.toString();
  } catch {
    return scrubPath(raw);
  }
}
