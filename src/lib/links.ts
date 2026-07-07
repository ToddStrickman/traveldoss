/**
 * Link-title utilities (isomorphic — safe in browser and server).
 *
 * Raw URLs should never face the traveler. The display chain for any link is:
 *   1. resolved site title (fetched server-side at save/ingest, stored on the block)
 *   2. the place's own name
 *   3. a prettified domain ("www.memmohotels.com" → "Memmo Hotels")
 *   4. the raw URL (only if nothing else exists)
 */

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

/** All http(s) URLs found inside a free-text field. */
export function extractUrls(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(URL_RE)) {
    // Trim trailing punctuation that's prose, not URL ("…goldeneye.com/.")
    out.push(m[0].replace(/[.,;:!?]+$/, ""));
  }
  return out;
}

/** "https://www.memmohotels.com/principereal" → "Memmo Hotels" */
export function prettyDomain(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    const base = host.split(".").slice(0, -1).join(".") || host;
    return base
      .split(/[-_.]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return url;
  }
}

/**
 * Clean a fetched <title> / og:site_name into a link label:
 * keep the most meaningful segment, drop boilerplate, cap length.
 * "GoldenEye | Luxury Resort in Jamaica | Book Direct" → "GoldenEye"
 * (og:site_name is preferred upstream, which is usually already clean.)
 */
export function cleanSiteTitle(raw: string): string | null {
  const decoded = raw
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!decoded) return null;
  // Split on common title separators and keep the first informative segment.
  const segments = decoded.split(/\s*[|·•»–—]\s*|\s+-\s+/).filter(Boolean);
  const BOILER = /^(home|homepage|welcome|official site|official website|book direct|index)$/i;
  const seg = segments.find((s) => !BOILER.test(s.trim())) ?? segments[0];
  if (!seg) return null;
  const title = seg.trim();
  if (title.length < 2) return null;
  return title.length > 60 ? `${title.slice(0, 57).trimEnd()}…` : title;
}

/** Hosts we never fetch and never bother titling from metadata (titles are
 *  generic — "Google Maps"); the caller falls back to name/domain instead. */
const SKIP_TITLE_HOSTS = /(^|\.)(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl|bing\.com|apple\.com)$/i;

export function shouldFetchTitle(url: string): boolean {
  try {
    return !SKIP_TITLE_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** SSRF guard: only public http(s) destinations are ever fetched. */
export function isSafePublicHttpUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // IPv6 literal or mapped
  if (host.includes(":")) return false;
  // IPv4 literal — block private / loopback / link-local / metadata ranges.
  const ip = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    if (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    )
      return false;
  }
  return true;
}
