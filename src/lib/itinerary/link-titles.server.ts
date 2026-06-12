/**
 * Server-side link-title resolution (Node dev / Cloudflare Workers prod).
 *
 * Best-effort enrichment that runs inside the existing save/ingest server
 * functions: any raw URL on a block gains a stored human title so the
 * renderer never shows a bare URL. Failures are silent — an unresolved URL
 * simply stays untitled and is retried on the next save ("resolve on next
 * save" backfill model). Never throws.
 */
import type { Block } from "@/lib/skins/types";
import {
  cleanSiteTitle,
  extractUrls,
  isSafePublicHttpUrl,
  prettyDomain,
  shouldFetchTitle,
} from "@/lib/links";

const FETCH_TIMEOUT_MS = 4_000;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_URLS_PER_RUN = 12;

/** Module-level cache (per server instance). TTL keeps stale titles bounded. */
const cache = new Map<string, { title: string | null; at: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function fromCache(url: string): { title: string | null } | undefined {
  const hit = cache.get(url);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(url);
    return undefined;
  }
  return hit;
}

/** Fetch a page and pull og:site_name → og:title → <title>, cleaned. */
async function fetchTitle(url: string): Promise<string | null> {
  const cached = fromCache(url);
  if (cached !== undefined) return cached.title;
  let title: string | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "TravelDossLinkBot/1.0 (+https://traveldoss.com)",
        },
      });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.includes("html")) {
        // Read only the head of the document — titles live early.
        const reader = res.body?.getReader();
        let html = "";
        if (reader) {
          const decoder = new TextDecoder();
          let bytes = 0;
          while (bytes < MAX_BODY_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            html += decoder.decode(value, { stream: true });
            if (html.includes("</title>") && /og:(site_name|title)/.test(html)) break;
          }
          void reader.cancel().catch(() => {});
        } else {
          html = (await res.text()).slice(0, MAX_BODY_BYTES);
        }
        const og =
          html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ??
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i) ??
          html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
        const t = og?.[1] ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
        if (t) title = cleanSiteTitle(t);
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    title = null; // network error / timeout / abort — fall back silently
  }
  cache.set(url, { title, at: Date.now() });
  return title;
}

type PlaceBlock = Extract<Block, { kind: "place" }>;
type TextLinkBlock = Extract<Block, { kind: "note" | "paragraph" }>;
type DayBlock = Extract<Block, { kind: "day" }>;

/** Collect every URL on the blocks that still needs a title. */
function collectPending(blocks: Block[]): string[] {
  const pending = new Set<string>();
  const consider = (url: string | undefined, hasTitle: boolean) => {
    if (!url || hasTitle) return;
    if (!isSafePublicHttpUrl(url) || !shouldFetchTitle(url)) return;
    pending.add(url);
  };
  for (const b of blocks) {
    if (b.kind === "place") {
      consider(b.website, Boolean(b.websiteTitle));
      consider(b.ticketLink, Boolean(b.ticketLinkTitle));
      for (const u of extractUrls(b.note ?? "")) consider(u, Boolean(b.linkTitles?.[u]));
    } else if (b.kind === "note" || b.kind === "paragraph") {
      for (const u of extractUrls(b.text)) consider(u, Boolean(b.linkTitles?.[u]));
    } else if (b.kind === "day") {
      for (const u of extractUrls(b.notes ?? "")) consider(u, Boolean(b.linkTitles?.[u]));
    }
  }
  return [...pending].slice(0, MAX_URLS_PER_RUN);
}

/**
 * Resolve titles for any untitled URLs and return enriched copies of the
 * blocks. Bounded by `budgetMs` overall — whatever doesn't finish in time is
 * left untitled for the next save to pick up.
 */
export async function enrichBlocksWithLinkTitles(
  blocks: Block[],
  { budgetMs = 5_000 }: { budgetMs?: number } = {},
): Promise<Block[]> {
  try {
    const urls = collectPending(blocks);
    if (urls.length === 0) return blocks;

    const titles = new Map<string, string>();
    await Promise.race([
      Promise.allSettled(
        urls.map(async (u) => {
          const t = await fetchTitle(u);
          if (t) titles.set(u, t);
        }),
      ),
      new Promise((r) => setTimeout(r, budgetMs)),
    ]);
    if (titles.size === 0) return blocks;

    const textTitles = (b: PlaceBlock | TextLinkBlock | DayBlock, text: string) => {
      let map: Record<string, string> | undefined;
      for (const u of extractUrls(text)) {
        const t = titles.get(u);
        if (t && !b.linkTitles?.[u]) map = { ...(map ?? b.linkTitles ?? {}), [u]: t };
      }
      return map;
    };

    return blocks.map((b) => {
      if (b.kind === "place") {
        const noteMap = textTitles(b, b.note ?? "");
        const websiteTitle =
          !b.websiteTitle && b.website ? titles.get(b.website) : undefined;
        const ticketLinkTitle =
          !b.ticketLinkTitle && b.ticketLink ? titles.get(b.ticketLink) : undefined;
        if (!noteMap && !websiteTitle && !ticketLinkTitle) return b;
        return {
          ...b,
          ...(websiteTitle ? { websiteTitle } : {}),
          ...(ticketLinkTitle ? { ticketLinkTitle } : {}),
          ...(noteMap ? { linkTitles: noteMap } : {}),
        };
      }
      if (b.kind === "note" || b.kind === "paragraph") {
        const map = textTitles(b, b.text);
        return map ? { ...b, linkTitles: map } : b;
      }
      if (b.kind === "day") {
        const map = textTitles(b, b.notes ?? "");
        return map ? { ...b, linkTitles: map } : b;
      }
      return b;
    });
  } catch {
    return blocks; // enrichment must never break a save
  }
}

/** Re-export for callers that want the display fallback chain server-side. */
export { prettyDomain };
