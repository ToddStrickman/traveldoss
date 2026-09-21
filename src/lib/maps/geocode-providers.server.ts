/**
 * The geocoding provider ladder, server-only — and entirely keyless.
 *
 * Rendering has cost nothing per view since Phase 1 (MapLibre over OpenFreeMap,
 * no browser key). Address lookup was the last paid Google surface; it is now
 * OpenStreetMap all the way down:
 *
 *   1. Photon (komoot's open geocoder over OSM data) — no key, no per-lookup
 *      cost, strong on street addresses.
 *   2. Nominatim (OSM's own search) — the second free opinion, used only when
 *      Photon has no answer. Better on bare venue names. Rate-limited to one
 *      request at a time with a courtesy gap, per the OSM usage policy.
 *
 * Neither provider returns a Google place id; the map's grouping already falls
 * back to coordinates + name.
 *
 * Every lookup returns one of three outcomes, and the difference matters more
 * than the provider: a hit, a genuine empty answer, or a *fault*
 * (rejected request, timeout, network error). Callers must never cache a fault
 * and never count it as an attempt — that is exactly how a whole dossier of
 * resolvable Rome stops was written off as "not found".
 */
import type { GeocodeHit } from "@/lib/maps/geocode-cache.server";

export const PHOTON_BASE_URL = "https://photon.komoot.io/api";
export const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
/** Identifies us to Nominatim, as its usage policy requires. */
export const OSM_USER_AGENT = "TravelDoss/1.0 (+https://traveldoss.com)";

/** Mirrors `block.geocode.provider` in src/lib/skins/types.ts. */
export type GeocodeProvider = "photon" | "nominatim";

export const PHOTON_PROVIDER: GeocodeProvider = "photon";
export const NOMINATIM_PROVIDER: GeocodeProvider = "nominatim";

export type GeocodeOutcome =
  | { kind: "hit"; provider: GeocodeProvider; hit: GeocodeHit }
  | { kind: "empty"; provider: GeocodeProvider }
  | { kind: "fault"; provider: GeocodeProvider; reason: string };

export function photonSearchUrl(query: string): string {
  return `${PHOTON_BASE_URL}?q=${encodeURIComponent(query)}&limit=1`;
}

export function nominatimSearchUrl(query: string): string {
  return `${NOMINATIM_BASE_URL}?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&addressdetails=1&extratags=1`;
}

function faultReason(err: unknown): string {
  if (err instanceof Error) return err.name === "AbortError" ? "timeout" : err.message;
  return "network";
}

async function timed<T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await run(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Nominatim asks for at most one request per second from a single client, so
 * every call queues behind the last one with a courtesy gap. Photon carries
 * the parallel load; this is only the tail.
 */
const NOMINATIM_MIN_GAP_MS = 1_100;
let nominatimChain: Promise<unknown> = Promise.resolve();

function queueNominatim<T>(run: () => Promise<T>): Promise<T> {
  const next = nominatimChain.then(run, run);
  nominatimChain = next.then(
    () => new Promise((r) => setTimeout(r, NOMINATIM_MIN_GAP_MS)),
    () => new Promise((r) => setTimeout(r, NOMINATIM_MIN_GAP_MS)),
  );
  return next;
}

/** Free lookup #1: Photon. No credentials, no cost. */
export async function photonSearch(
  query: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<GeocodeOutcome> {
  try {
    return await timed(timeoutMs, async (signal) => {
      const res = await fetchImpl(photonSearchUrl(query), {
        signal,
        headers: { Accept: "application/json", "User-Agent": OSM_USER_AGENT },
      });
      if (!res.ok) {
        return { kind: "fault", provider: PHOTON_PROVIDER, reason: `http_${res.status}` } as const;
      }
      const json = (await res.json()) as {
        features?: Array<{ geometry?: { coordinates?: unknown } }>;
      };
      const coords = json.features?.[0]?.geometry?.coordinates;
      if (Array.isArray(coords) && typeof coords[0] === "number" && typeof coords[1] === "number") {
        // GeoJSON order is [lng, lat].
        return {
          kind: "hit",
          provider: PHOTON_PROVIDER,
          hit: { lat: coords[1], lng: coords[0] },
        } as const;
      }
      return { kind: "empty", provider: PHOTON_PROVIDER } as const;
    });
  } catch (err) {
    return { kind: "fault", provider: PHOTON_PROVIDER, reason: faultReason(err) };
  }
}

/** Free lookup #2: Nominatim, OSM's own search. Serialized, keyless. */
export async function nominatimSearch(
  query: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<GeocodeOutcome> {
  try {
    return await queueNominatim(() =>
      timed(timeoutMs, async (signal) => {
        const res = await fetchImpl(nominatimSearchUrl(query), {
          signal,
          headers: { Accept: "application/json", "User-Agent": OSM_USER_AGENT },
        });
        if (!res.ok) {
          return {
            kind: "fault",
            provider: NOMINATIM_PROVIDER,
            reason: `http_${res.status}`,
          } as const;
        }
        const json = (await res.json()) as Array<{ lat?: string; lon?: string }>;
        const first = Array.isArray(json) ? json[0] : undefined;
        const lat = first?.lat != null ? Number(first.lat) : NaN;
        const lng = first?.lon != null ? Number(first.lon) : NaN;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { kind: "hit", provider: NOMINATIM_PROVIDER, hit: { lat, lng } } as const;
        }
        return { kind: "empty", provider: NOMINATIM_PROVIDER } as const;
      }),
    );
  } catch (err) {
    return { kind: "fault", provider: NOMINATIM_PROVIDER, reason: faultReason(err) };
  }
}

/**
 * Run the ladder: Photon first, Nominatim only when Photon has no answer.
 * A Nominatim fault does not overwrite a genuine Photon empty — that stop
 * really is unfindable.
 */
export async function resolveWithProviders(
  query: string,
  {
    fetchImpl = fetch,
    timeoutMs = 3_000,
  }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<GeocodeOutcome> {
  const first = await photonSearch(query, fetchImpl, timeoutMs);
  if (first.kind === "hit") return first;

  const second = await nominatimSearch(query, fetchImpl, timeoutMs);
  if (second.kind === "fault" && first.kind === "empty") return first;
  return second;
}
