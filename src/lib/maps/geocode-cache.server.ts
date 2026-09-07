/**
 * Server-only geocode cache (Supabase table `geocode_cache`).
 *
 * The old in-memory Map in geo.server.ts lived inside one Cloudflare
 * Worker isolate, so in production it was cold almost every time. This
 * table is shared by every isolate and every dossier: the fifth traveller
 * who plans dinner at Belcanto costs nothing. Misses are cached too, for
 * seven days, so a query that Google cannot resolve is not retried on every
 * save by every dossier that contains it.
 *
 * Never throws. A missing service key (local dev) or a table error simply
 * means "no cache" and the caller proceeds as before.
 */

export type GeocodeHit = { lat: number; lng: number; placeId?: string };
export type GeocodeCacheEntry = { hit: GeocodeHit | null; provider: string };

const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeGeocodeQuery(query: string): string {
  return query
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[,\s]+$/g, "")
    .trim();
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** `undefined` = no row; `{ hit: null }` = a cached miss still inside its TTL. */
export async function readGeocodeCache(query: string): Promise<GeocodeCacheEntry | undefined> {
  try {
    const key = await sha256Hex(normalizeGeocodeQuery(query));
    const db = await admin();
    const { data, error } = await db
      .from("geocode_cache")
      .select("lat, lng, place_id, provider, resolved_at, miss_count")
      .eq("query_hash", key)
      .maybeSingle();
    if (error || !data) return undefined;
    if (typeof data.lat === "number" && typeof data.lng === "number") {
      return { hit: { lat: data.lat, lng: data.lng, placeId: data.place_id ?? undefined }, provider: data.provider };
    }
    const age = Date.now() - new Date(data.resolved_at).getTime();
    if (age < MISS_TTL_MS) return { hit: null, provider: data.provider };
    return undefined; // stale miss: let the caller try again
  } catch {
    return undefined;
  }
}

export async function writeGeocodeCache(
  query: string,
  hit: GeocodeHit | null,
  provider: string,
): Promise<void> {
  try {
    const normalized = normalizeGeocodeQuery(query);
    const key = await sha256Hex(normalized);
    const db = await admin();
    await db.from("geocode_cache").upsert(
      {
        query_hash: key,
        query: normalized.slice(0, 400),
        lat: hit?.lat ?? null,
        lng: hit?.lng ?? null,
        place_id: hit?.placeId ?? null,
        provider,
        resolved_at: new Date().toISOString(),
        miss_count: hit ? 0 : 1,
      },
      { onConflict: "query_hash" },
    );
  } catch {
    /* the cache is an optimisation, never a dependency */
  }
}
