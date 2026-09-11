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
import { placesRequest, PLACES_SEARCH_TEXT_URL } from "@/lib/maps/places-request.server";
import {
  readGeocodeCache,
  writeGeocodeCache,
  type GeocodeCacheEntry,
  type GeocodeHit,
} from "@/lib/maps/geocode-cache.server";

type PlaceBlock = Extract<Block, { kind: "place" }>;

const FETCH_TIMEOUT_MS = 3_000;
const MAX_PLACES_PER_RUN = 8;
export const MAX_GEOCODE_ATTEMPTS = 3;
const PROVIDER = "google-places";

export type GeocodeDeps = {
  fetchImpl?: typeof fetch;
  readCache?: (query: string) => Promise<GeocodeCacheEntry | undefined>;
  writeCache?: (query: string, hit: GeocodeHit | null, provider: string) => Promise<void>;
  now?: () => number;
  onServiceError?: () => void;
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
  if (typeof b.lat === "number" && Number.isFinite(b.lat) && Math.abs(b.lat) <= 90 && typeof b.lng === "number" && Number.isFinite(b.lng) && Math.abs(b.lng) <= 180) return false;
  if (b.mapHidden) return false;
  const status = b.geocode?.status;
  if (status === "manual" || status === "failed") return false;
  if (status === "needs_review") return retryNeedsReview;
  if ((b.geocode?.attempts ?? 0) >= MAX_GEOCODE_ATTEMPTS) return retryNeedsReview;
  return true;
}

async function googleTextSearch(
  query: string,
  apiKey: string,
  fetchImpl?: typeof fetch,
): Promise<GeocodeHit | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const request: RequestInit = {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        // id + location: still the Pro tier, and the id is the one Places
        // datum Google allows storing indefinitely.
        "X-Goog-FieldMask": "places.id,places.location",
      },
      body: JSON.stringify({ textQuery: query, pageSize: 1 }),
    };
    const res = fetchImpl ? await fetchImpl(PLACES_SEARCH_TEXT_URL, request) : await placesRequest(apiKey, request);
    // Service failures are not evidence that a place does not exist.
    if (!res.ok) throw new Error("Location service unavailable (" + res.status + ")");
    const json = (await res.json()) as {
      places?: Array<{ id?: string; location?: { latitude?: number; longitude?: number } }>;
    };
    const first = json.places?.[0];
    const loc = first?.location;
    if (typeof loc?.latitude === "number" && typeof loc?.longitude === "number" && Number.isFinite(loc.latitude) && Math.abs(loc.latitude) <= 90 && Number.isFinite(loc.longitude) && Math.abs(loc.longitude) <= 180) {
      return { lat: loc.latitude, lng: loc.longitude, placeId: first?.id };
    }
    if (first) throw new Error("Location service returned invalid coordinates");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Cache first, then Google; writes the outcome (hit or miss) back. */
export async function resolveGeocodeQuery(
  query: string,
  apiKey: string,
  deps: GeocodeDeps = {},
  bypassCachedMiss = false,
): Promise<{ hit: GeocodeHit | null; cacheHit: boolean }> {
  const readCache = deps.readCache ?? readGeocodeCache;
  const writeCache = deps.writeCache ?? writeGeocodeCache;
  const cached = await readCache(query);
  if (cached && (cached.hit || !bypassCachedMiss)) return { hit: cached.hit, cacheHit: true };
  const hit = await googleTextSearch(query, apiKey, deps.fetchImpl);
  await writeCache(query, hit, PROVIDER);
  return { hit, cacheHit: false };
}

/** Resolve coordinates for coordinate-less places; returns enriched copies. */
export async function enrichBlocksWithCoords(
  blocks: Block[],
  {
    budgetMs = 3_000,
    destination,
    apiKey = process.env.GOOGLE_MAPS_API_KEY,
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

    const outcomes = new Map<number, { hit: GeocodeHit | null; query: string }>();
    await Promise.race([
      Promise.allSettled(
        targets.slice(0, maxPerRun).map(async ({ index, query }) => {
          try {
            const { hit, cacheHit } = await resolveGeocodeQuery(query, apiKey, deps, retryNeedsReview);
            // Cached misses do not consume a fresh provider attempt.
            if (hit || !cacheHit) outcomes.set(index, { hit, query });
          } catch {
            deps.onServiceError?.();
          }
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
          geocode: { status: "resolved", provider: PROVIDER, attempts, query: o.query, at },
        };
      }
      return {
        ...b,
        geocode: {
          status: attempts >= MAX_GEOCODE_ATTEMPTS ? "needs_review" : "pending",
          provider: PROVIDER,
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
