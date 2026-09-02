/**
 * Path scrubbing for third-party page-view reporting.
 *
 * GA must never receive a real trip slug, guide slug, or template id: it would
 * both explode the report into one row per dossier and leak an identifier into
 * a third-party dashboard. Every dynamic segment collapses to a placeholder so
 * GA reports one row per page *type*.
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
