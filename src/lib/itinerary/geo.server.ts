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
};

/** The text sent to the geocoder for a stop, or null when nothing usable exists. */
export function geocodeQueryFor(b: PlaceBlock, destination?: string | null): string | null {
  // Address is the strongest signal; name+destination is the fallback.
  if (b.address) return [b.name, b.address].filter(Boolean).join(", ");
  if (destination && b.name) return `${b.name}, ${destination}`;
  return null;
}

/** Whether the backfill should spend a lookup on this stop. */
export function shouldAttemptGeocode(b: PlaceBlock): boolean {
  if (b.lat != null && b.lng != null) return false;
  if (b.mapHidden) return false;
  const status = b.geocode?.status;
  if (status === "manual" || status === "needs_review" || status === "failed") return false;
  if ((b.geocode?.attempts ?? 0) >= MAX_GEOCODE_ATTEMPTS) return false;
  return true;
}

async function googleTextSearch(
  query: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<GeocodeHit | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // id + location: still the Pro tier, and the id is the one Places
        // datum Google allows storing indefinitely.
        "X-Goog-FieldMask": "places.id,places.location",
      },
      body: JSON.stringify({ textQuery: query, pageSize: 1 }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      places?: Array<{ id?: string; location?: { latitude?: number; longitude?: number } }>;
    };
    const first = json.places?.[0];
    const loc = first?.location;
    if (typeof loc?.latitude === "number" && typeof loc?.longitude === "number") {
      return { lat: loc.latitude, lng: loc.longitude, placeId: first?.id };
    }
    return null;
  } catch {
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
): Promise<{ hit: GeocodeHit | null; cacheHit: boolean }> {
  const readCache = deps.readCache ?? readGeocodeCache;
  const writeCache = deps.writeCache ?? writeGeocodeCache;
  const cached = await readCache(query);
  if (cached) return { hit: cached.hit, cacheHit: true };
  const hit = await googleTextSearch(query, apiKey, deps.fetchImpl ?? fetch);
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
  }: { budgetMs?: number; destination?: string | null; apiKey?: string; deps?: GeocodeDeps } = {},
): Promise<Block[]> {
  try {
    if (!apiKey) return blocks;
    const now = deps.now ?? Date.now;

    const targets: Array<{ index: number; query: string }> = [];
    blocks.forEach((b, index) => {
      if (b.kind !== "place" || !shouldAttemptGeocode(b)) return;
      const query = geocodeQueryFor(b, destination);
      if (query) targets.push({ index, query });
    });
    if (targets.length === 0) return blocks;

    const outcomes = new Map<number, { hit: GeocodeHit | null; query: string }>();
    await Promise.race([
      Promise.allSettled(
        targets.slice(0, MAX_PLACES_PER_RUN).map(async ({ index, query }) => {
          const { hit } = await resolveGeocodeQuery(query, apiKey, deps);
          outcomes.set(index, { hit, query });
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
