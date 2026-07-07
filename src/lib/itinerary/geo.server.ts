/**
 * Server-side coordinate backfill (mirrors the link-title backfill pattern).
 *
 * New content gets lat/lng free at parse time (places.location rides the
 * existing enrichment call). This module covers everything else — trips
 * created before the Live Map, hand-added stops, imports: on every save,
 * any visible-in-data place with an address or name but no coordinates is
 * resolved via Places Text Search (location-only field mask, the cheapest
 * tier) and persisted. The map itself never geocodes at view time.
 *
 * Bounded and best-effort: per-run cap, per-fetch timeout, overall budget,
 * 24h in-memory cache, never throws — unresolved places retry next save.
 */
import type { Block } from "@/lib/skins/types";

const FETCH_TIMEOUT_MS = 3_000;
const MAX_PLACES_PER_RUN = 8;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type LatLng = { lat: number; lng: number };
const cache = new Map<string, { hit: LatLng | null; at: number }>();

async function geocodeQuery(query: string, apiKey: string): Promise<LatLng | null> {
  const cached = cache.get(query);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.hit;
  let hit: LatLng | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.location",
        },
        body: JSON.stringify({ textQuery: query, pageSize: 1 }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          places?: Array<{ location?: { latitude?: number; longitude?: number } }>;
        };
        const loc = json.places?.[0]?.location;
        if (typeof loc?.latitude === "number" && typeof loc?.longitude === "number") {
          hit = { lat: loc.latitude, lng: loc.longitude };
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    hit = null;
  }
  cache.set(query, { hit, at: Date.now() });
  return hit;
}

/** Resolve coordinates for coordinate-less places; returns enriched copies. */
export async function enrichBlocksWithCoords(
  blocks: Block[],
  { budgetMs = 3_000, destination }: { budgetMs?: number; destination?: string | null } = {},
): Promise<Block[]> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return blocks;

    const targets: Array<{ index: number; query: string }> = [];
    blocks.forEach((b, index) => {
      if (b.kind !== "place" || b.lat != null) return;
      // Address is the strongest signal; name+destination is the fallback.
      const query = b.address
        ? [b.name, b.address].filter(Boolean).join(", ")
        : destination && b.name
          ? `${b.name}, ${destination}`
          : null;
      if (query) targets.push({ index, query });
    });
    if (targets.length === 0) return blocks;

    const found = new Map<number, LatLng>();
    await Promise.race([
      Promise.allSettled(
        targets.slice(0, MAX_PLACES_PER_RUN).map(async ({ index, query }) => {
          const hit = await geocodeQuery(query, apiKey);
          if (hit) found.set(index, hit);
        }),
      ),
      new Promise((r) => setTimeout(r, budgetMs)),
    ]);
    if (found.size === 0) return blocks;

    return blocks.map((b, index) => {
      const hit = found.get(index);
      return hit && b.kind === "place" ? { ...b, lat: hit.lat, lng: hit.lng } : b;
    });
  } catch {
    return blocks; // enrichment must never break a save
  }
}
