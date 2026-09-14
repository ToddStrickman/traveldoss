/**
 * Server-side coordinate backfill (mirrors the link-title backfill pattern).
 *
 * New content gets lat/lng free at parse time (places.location rides the
 * existing enrichment call). This module covers everything else — trips
 * created before the Live Map, hand-added stops, imports: on every save,
 * any visible-in-data place with an address or name but no coordinates is
 * resolved via Places Text Search (location + id field mask, the Pro tier)
 * and persisted on the block. The map itself never geocodes at view time.
 *
 * Bounded and best-effort: per-run cap, per-fetch timeout, overall budget,
 * never throws. Three things changed for Live Map v2:
 *
 *   1. The cache is the shared `geocode_cache` table, not a per-isolate Map
 *      (which was cold on almost every Cloudflare Worker request).
 *   2. Every attempt is recorded on the block (`geocode.attempts`); after
 *      MAX_GEOCODE_ATTEMPTS misses the stop becomes `needs_review` and is
 *      never auto-retried, so an unresolvable name stops costing money on
 *      every save. An owner fix (`status: "manual"`) is never touched.
 *   3. The Places id is stored (`placeId`) for dedupe and later details.
 */
import type { Block } from "@/lib/skins/types";
import {
  readGeocodeCache,
  writeGeocodeCache,
  type GeocodeCacheEntry,
  type GeocodeHit,
} from "@/lib/maps/geocode-cache.server";
import {
  GOOGLE_PROVIDER,
  PHOTON_PROVIDER,
  resolveWithProviders,
  type GeocodeProvider,
} from "@/lib/maps/geocode-providers.server";

type PlaceBlock = Extract<Block, { kind: "place" }>;

const FETCH_TIMEOUT_MS = 3_000;
const MAX_PLACES_PER_RUN = 8;
export const MAX_GEOCODE_ATTEMPTS = 3;
const PROVIDER = GOOGLE_PROVIDER;

export type GeocodeDeps = {
  fetchImpl?: typeof fetch;
  readCache?: (query: string) => Promise<GeocodeCacheEntry | undefined>;
  writeCache?: (query: string, hit: GeocodeHit | null, provider: string) => Promise<void>;
  now?: () => number;
};

/** The text sent to the geocoder for a stop, or null when nothing usable exists. */
export function geocodeQueryFor(b: PlaceBlock, destination?: string | null): string | null {
  // Address is the strongest signal; name+destination is the fallback.
  if (b.address) return [b.name, b.address].filter(Boolean).join(", ");
  if (destination && b.name) return `${b.name}, ${destination}`;
  return null;
}

/** Whether the backfill should spend a lookup on this stop. An explicit
 *  owner request (`retryNeedsReview`) may give a capped stop one more go;
 *  automatic saves never do. */
export function shouldAttemptGeocode(
  b: PlaceBlock,
  { retryNeedsReview = false }: { retryNeedsReview?: boolean } = {},
): boolean {
  if (b.lat != null && b.lng != null) return false;
  if (b.mapHidden) return false;
  const status = b.geocode?.status;
  if (status === "manual" || status === "failed") return false;
  if (status === "needs_review") return retryNeedsReview;
  if ((b.geocode?.attempts ?? 0) >= MAX_GEOCODE_ATTEMPTS) return retryNeedsReview;
  return true;
}

/**
 * Cache first, then the provider ladder (free Photon, Google as fallback).
 *
 * A *fault* — misconfiguration, a rejected request, a timeout — is never
 * written to the cache and is reported so the caller can leave the stop
 * completely untouched. Only a genuine empty answer is cached as a miss.
 */
export async function resolveGeocodeQuery(
  query: string,
  apiKey: string | undefined,
  deps: GeocodeDeps = {},
): Promise<{ hit: GeocodeHit | null; cacheHit: boolean; fault: boolean; provider: GeocodeProvider }> {
  const readCache = deps.readCache ?? readGeocodeCache;
  const writeCache = deps.writeCache ?? writeGeocodeCache;
  const cached = await readCache(query);
  if (cached) return {
    hit: cached.hit,
    cacheHit: true,
    fault: false,
    provider: cached.provider === PHOTON_PROVIDER ? PHOTON_PROVIDER : GOOGLE_PROVIDER,
  };

  const outcome = await resolveWithProviders(query, {
    apiKey,
    fetchImpl: deps.fetchImpl ?? fetch,
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  if (outcome.kind === "fault") {
    return { hit: null, cacheHit: false, fault: true, provider: outcome.provider };
  }
  const hit = outcome.kind === "hit" ? outcome.hit : null;
  await writeCache(query, hit, outcome.provider);
  return { hit, cacheHit: false, fault: false, provider: outcome.provider };
}

/** Resolve coordinates for coordinate-less places; returns enriched copies. */
export async function enrichBlocksWithCoords(
  blocks: Block[],
  {
    budgetMs = 3_000,
    destination,
    /** Connector connection key. Callers resolve the environment value; an
     *  explicit `undefined` disables enrichment entirely. */
    apiKey,
    deps = {},
    maxPerRun = MAX_PLACES_PER_RUN,
    retryNeedsReview = false,
  }: {
    budgetMs?: number;
    destination?: string | null;
    apiKey?: string;
    deps?: GeocodeDeps;
    /** Per-call cap: 8 on autosave, more for an explicit owner request. */
    maxPerRun?: number;
    retryNeedsReview?: boolean;
  } = {},
): Promise<Block[]> {
  try {
    if (!apiKey) return blocks;
    const now = deps.now ?? Date.now;

    const targets: Array<{ index: number; query: string }> = [];
    blocks.forEach((b, index) => {
      if (b.kind !== "place" || !shouldAttemptGeocode(b, { retryNeedsReview })) return;
      const query = geocodeQueryFor(b, destination);
      if (query) targets.push({ index, query });
    });
    if (targets.length === 0) return blocks;

    const outcomes = new Map<number, { hit: GeocodeHit | null; query: string; provider: GeocodeProvider }>();
    await Promise.race([
      Promise.allSettled(
        targets.slice(0, maxPerRun).map(async ({ index, query }) => {
          const { hit, fault, provider } = await resolveGeocodeQuery(query, apiKey, deps);
          // A fault is a problem with us, not with the address: record nothing,
          // spend no attempt, so the next pass can still resolve this stop.
          if (fault) return;
          outcomes.set(index, { hit, query, provider });
        }),
      ),
      new Promise((r) => setTimeout(r, budgetMs)),
    ]);
    if (outcomes.size === 0) return blocks;

    const at = new Date(now()).toISOString();
    return blocks.map((b, index) => {
      const o = outcomes.get(index);
      if (!o || b.kind !== "place") return b;
      const attempts = (b.geocode?.attempts ?? 0) + 1;
      if (o.hit) {
        return {
          ...b,
          lat: o.hit.lat,
          lng: o.hit.lng,
          ...(o.hit.placeId ? { placeId: o.hit.placeId } : {}),
          geocode: { status: "resolved", provider: o.provider, attempts, query: o.query, at },
        };
      }
      return {
        ...b,
        geocode: {
          status: attempts >= MAX_GEOCODE_ATTEMPTS ? "needs_review" : "pending",
          provider: o.provider,
          attempts,
          query: o.query,
          at,
        },
      };
    });
  } catch {
    return blocks; // enrichment must never break a save
  }
}
