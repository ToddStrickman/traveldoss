/**
 * Automatic fallback images for day/activity galleries.
 *
 * When a day ships no (or too few) real photos, the carousel fills with
 * royalty-free, commercially usable images resolved at view time from
 * keyless open APIs:
 *
 *   1. Wikimedia Commons — primary. No API key, explicit CORS support
 *      (origin=*), no hard anonymous quota, and excellent coverage of
 *      landmarks/cities. `filetype:bitmap` keeps SVG maps and TIFF scans
 *      out of the results.
 *   2. Openverse — secondary top-up. CC-licensed aggregate; anonymous
 *      access is rate-limited, so it only runs when Commons came up short.
 *
 * Queries are RANKED most-specific-first (e.g. "Villa Cimbrone Ravello" →
 * "Ravello Italy" → "Amalfi Coast") and tried in order until enough images
 * are collected — so a day about the Pantheon shows the Pantheon, not a
 * generic postcard of Italy.
 *
 * Resolved sets are cached in localStorage (30 days) keyed by the ranked
 * queries, so a dossier keeps the same photos between sessions, and the
 * resolution itself is deterministic (top-N of a stable search) so other
 * devices converge on the same images too.
 *
 * All results carry provider/license/creator/sourcePageUrl so attribution
 * affordances can render (CC BY needs visible credit; CC0/PD does not).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { GalleryImage } from "../types";

const CACHE_PREFIX = "td_fb_imgs_v1:";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;

/** Session-scoped memo so 20 collapsed/expanded re-mounts of a day don't
 *  re-read localStorage or re-fetch. */
const memoryCache = new Map<string, GalleryImage[]>();

type CacheEntry = { at: number; images: GalleryImage[] };

function readCache(key: string): GalleryImage[] | null {
  const hit = memoryCache.get(key);
  if (hit) return hit;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || !Array.isArray(parsed.images)) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    memoryCache.set(key, parsed.images);
    return parsed.images;
  } catch {
    return null;
  }
}

function writeCache(key: string, images: GalleryImage[]): void {
  memoryCache.set(key, images);
  try {
    window.localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ at: Date.now(), images } satisfies CacheEntry),
    );
  } catch {
    /* storage full/blocked — memory cache still holds it for the session */
  }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const res = await fetch(url, { signal: AbortSignal.any([signal, timeout]) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/** Wikimedia Commons file search → GalleryImage[]. */
async function searchCommons(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<GalleryImage[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: "6",
    gsrlimit: String(Math.min(limit * 2, 20)),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1280",
  });
  const json = (await fetchJson(
    `https://commons.wikimedia.org/w/api.php?${params}`,
    signal,
  )) as {
    query?: {
      pages?: Record<
        string,
        {
          index?: number;
          title?: string;
          imageinfo?: Array<{
            thumburl?: string;
            width?: number;
            height?: number;
            descriptionurl?: string;
            extmetadata?: Record<string, { value?: string }>;
          }>;
        }
      >;
    };
  };
  const pages = Object.values(json.query?.pages ?? {});
  // `index` preserves search ranking — object key order does not.
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const out: GalleryImage[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl) continue;
    // Skip low-res originals and extreme panoramas/strips that crop badly.
    const w = info.width ?? 0;
    const h = info.height ?? 0;
    if (w < 640 || h < 400) continue;
    if (w / Math.max(h, 1) > 4 || h / Math.max(w, 1) > 3) continue;
    const meta = info.extmetadata ?? {};
    out.push({
      src: info.thumburl,
      alt: stripHtml(meta.ImageDescription?.value ?? "") ||
        (page.title ?? "").replace(/^File:/, "").replace(/\.[a-z]+$/i, "") ||
        `Photo of ${query}`,
      provider: "wikimedia",
      license: stripHtml(meta.LicenseShortName?.value ?? "") || undefined,
      licenseUrl: meta.LicenseUrl?.value || undefined,
      creator: stripHtml(meta.Artist?.value ?? "") || undefined,
      sourcePageUrl: info.descriptionurl,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Openverse commercial-use search → GalleryImage[]. Secondary source. */
async function searchOpenverse(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<GalleryImage[]> {
  const params = new URLSearchParams({
    q: query,
    license_type: "commercial",
    page_size: String(limit),
  });
  const json = (await fetchJson(
    `https://api.openverse.org/v1/images/?${params}`,
    signal,
  )) as {
    results?: Array<{
      url?: string;
      title?: string;
      license?: string;
      license_url?: string;
      creator?: string;
      foreign_landing_url?: string;
      width?: number;
      height?: number;
    }>;
  };
  const out: GalleryImage[] = [];
  for (const r of json.results ?? []) {
    if (!r.url) continue;
    if ((r.width ?? 1280) < 640) continue;
    out.push({
      src: r.url,
      alt: r.title || `Photo of ${query}`,
      provider: "openverse",
      license: r.license ? r.license.toUpperCase() : undefined,
      licenseUrl: r.license_url || undefined,
      creator: r.creator || undefined,
      sourcePageUrl: r.foreign_landing_url || undefined,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Try ranked queries against Commons, then top up from Openverse. */
async function resolveFallbackImages(
  queries: string[],
  want: number,
  signal: AbortSignal,
): Promise<GalleryImage[]> {
  const seen = new Set<string>();
  const collected: GalleryImage[] = [];
  const push = (imgs: GalleryImage[]) => {
    for (const im of imgs) {
      if (collected.length >= want) return;
      if (seen.has(im.src)) continue;
      seen.add(im.src);
      collected.push(im);
    }
  };

  for (const q of queries) {
    if (collected.length >= want) break;
    try {
      push(await searchCommons(q, want - collected.length, signal));
    } catch {
      /* source down or aborted — try the next rank/source */
    }
  }
  if (collected.length < want) {
    for (const q of queries) {
      if (collected.length >= want) break;
      try {
        push(await searchOpenverse(q, want - collected.length, signal));
      } catch {
        /* secondary source is best-effort */
      }
    }
  }
  return collected;
}

export type FallbackImagesStatus = "idle" | "loading" | "done";

/**
 * Resolve up to `want` fallback images for the ranked `queries`.
 * `enabled: false` (inert previews, print, no need) renders nothing and
 * fetches nothing. `nonce` > 0 bypasses the cache (the Retry affordance).
 */
export function useFallbackImages({
  queries,
  want,
  enabled,
  nonce = 0,
}: {
  queries: string[];
  want: number;
  enabled: boolean;
  nonce?: number;
}): { images: GalleryImage[]; status: FallbackImagesStatus } {
  const cacheKey = useMemo(() => queries.join("|").slice(0, 400), [queries]);
  const [state, setState] = useState<{
    key: string;
    images: GalleryImage[];
    status: FallbackImagesStatus;
  }>({ key: "", images: [], status: "idle" });
  const nonceRef = useRef(nonce);

  useEffect(() => {
    if (!enabled || want <= 0 || queries.length === 0) return;
    if (typeof window === "undefined") return;
    // Unit tests render these components with a real fetch available —
    // never let a render hit live image APIs from the test runner.
    // (Vite statically replaces NODE_ENV in app builds, so this is free.)
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") return;
    const bypassCache = nonce !== nonceRef.current && nonce > 0;
    nonceRef.current = nonce;
    if (!bypassCache) {
      const cached = readCache(cacheKey);
      if (cached) {
        setState({ key: cacheKey, images: cached, status: "done" });
        return;
      }
    }
    const ctrl = new AbortController();
    setState((s) =>
      s.key === cacheKey && s.status === "loading"
        ? s
        : { key: cacheKey, images: [], status: "loading" },
    );
    resolveFallbackImages(queries, want, ctrl.signal)
      .then((images) => {
        if (ctrl.signal.aborted) return;
        // Cache even an empty result (avoids re-hammering hopeless queries),
        // but with the memory layer only so a reload can try again.
        if (images.length > 0) writeCache(cacheKey, images);
        else memoryCache.set(cacheKey, images);
        setState({ key: cacheKey, images, status: "done" });
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setState({ key: cacheKey, images: [], status: "done" });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, want, enabled, nonce]);

  if (!enabled || state.key !== cacheKey) return { images: [], status: "idle" };
  return { images: state.images, status: state.status };
}

/**
 * Ranked query builder for a day: named stops first (most specific), then
 * the day's own label, then the bare destination. "Villa Cimbrone Ravello"
 * beats "Italy".
 */
export function buildDayImageQueries(args: {
  destination: string;
  dayLabel?: string | null;
  placeNames: string[];
}): string[] {
  const dest = args.destination.trim();
  const queries: string[] = [];
  for (const name of args.placeNames.slice(0, 4)) {
    // The app's "Kind · Venue" convention: the venue is the image-worthy
    // part ("Dinner · Belcanto" → "Belcanto").
    const m = name.trim().match(/^([A-Za-z][A-Za-z' ]{0,24}?)\s*·\s*(.+)$/);
    const kind = (m?.[1] ?? "").trim();
    const n = (m?.[2] ?? name).trim();
    // Transit legs and generic labels make terrible image queries. A meal
    // kind keeps its venue ("Dinner · Belcanto" → "Belcanto"), but a
    // transit kind's remainder is a route, not a place.
    if (n.includes("→") || n.includes("->")) continue;
    if (n.length < 4) continue;
    if (/^(taxi|transfer|transit|uber|train|bus|ferry|flight|drive|rental)\b/i.test(kind)) continue;
    if (/^(lunch|dinner|breakfast|coffee|taxi|transfer|transit|check.?in|check.?out|free time|rest day)\b/i.test(n)) {
      continue;
    }
    queries.push(dest ? `${n} ${dest}` : n);
    if (queries.length >= 2) break;
  }
  const label = (args.dayLabel ?? "").trim();
  if (label && !/^day\s*\d+$/i.test(label) && dest) {
    queries.push(`${dest} ${label}`);
  }
  if (dest) queries.push(dest);
  return [...new Set(queries)].filter(Boolean);
}
