/**
 * The geocoding provider ladder, server-only.
 *
 * Rendering has cost nothing per view since Phase 1 (MapLibre over OpenFreeMap,
 * no browser key). Address lookup was the last paid Google surface, so it now
 * runs free-first:
 *
 *   1. Photon (open geocoder over OpenStreetMap data) — no key, no per-lookup
 *      cost. Strong on street addresses, weaker on a bare venue name. Returns
 *      no Google place id; the map's grouping already falls back to
 *      coordinates + name.
 *   2. Google Places Text Search through the Lovable connector gateway — used
 *      only when Photon has no answer, which keeps named-venue accuracy while
 *      collapsing the bill to the tail.
 *
 * Every lookup returns one of three outcomes, and the difference matters more
 * than the provider: a hit, a genuine empty answer, or a *fault*
 * (misconfiguration, rejected request, timeout, network error). Callers must
 * never cache a fault and never count it as an attempt — that is exactly how a
 * whole dossier of resolvable Rome stops was written off as "not found".
 */
import type { GeocodeHit } from "@/lib/maps/geocode-cache.server";
import { PLACES_SEARCH_TEXT_URL, buildPlacesHeaders } from "@/lib/maps/places-request.server";

export const PHOTON_BASE_URL = "https://photon.komoot.io/api";
/** Mirrors `block.geocode.provider` in src/lib/skins/types.ts. */
export type GeocodeProvider = "photon" | "google-places";

export const PHOTON_PROVIDER: GeocodeProvider = "photon";
export const GOOGLE_PROVIDER: GeocodeProvider = "google-places";

export type GeocodeOutcome =
  | { kind: "hit"; provider: GeocodeProvider; hit: GeocodeHit }
  | { kind: "empty"; provider: GeocodeProvider }
  | { kind: "fault"; provider: GeocodeProvider; reason: string };

export function photonSearchUrl(query: string): string {
  return `${PHOTON_BASE_URL}?q=${encodeURIComponent(query)}&limit=1`;
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

/** Free lookup: Photon. No credentials, no cost. */
export async function photonSearch(
  query: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<GeocodeOutcome> {
  try {
    return await timed(timeoutMs, async (signal) => {
      const res = await fetchImpl(photonSearchUrl(query), {
        signal,
        headers: { Accept: "application/json" },
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

/** Paid fallback: Google Places Text Search, always via the connector gateway. */
export async function googlePlacesSearch(
  query: string,
  apiKey: string | undefined,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<GeocodeOutcome> {
  const lovableApiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey || !lovableApiKey) {
    return { kind: "fault", provider: GOOGLE_PROVIDER, reason: "not_configured" };
  }
  try {
    return await timed(timeoutMs, async (signal) => {
      const res = await fetchImpl(PLACES_SEARCH_TEXT_URL, {
        method: "POST",
        signal,
        headers: buildPlacesHeaders(apiKey, lovableApiKey, {
          "Content-Type": "application/json",
          // id + location: the id is the one Places datum Google allows storing.
          "X-Goog-FieldMask": "places.id,places.location",
        }),
        body: JSON.stringify({ textQuery: query, pageSize: 1 }),
      });
      if (!res.ok) {
        return { kind: "fault", provider: GOOGLE_PROVIDER, reason: `http_${res.status}` } as const;
      }
      const json = (await res.json()) as {
        places?: Array<{ id?: string; location?: { latitude?: number; longitude?: number } }>;
      };
      const first = json.places?.[0];
      const loc = first?.location;
      if (typeof loc?.latitude === "number" && typeof loc?.longitude === "number") {
        return {
          kind: "hit",
          provider: GOOGLE_PROVIDER,
          hit: { lat: loc.latitude, lng: loc.longitude, placeId: first?.id },
        } as const;
      }
      return { kind: "empty", provider: GOOGLE_PROVIDER } as const;
    });
  } catch (err) {
    return { kind: "fault", provider: GOOGLE_PROVIDER, reason: faultReason(err) };
  }
}

/**
 * Run the ladder: free provider first, paid fallback only when the free one has
 * no answer. Google's answer wins when it runs, except that a Google fault does
 * not overwrite a genuine Photon empty — that stop really is unfindable.
 */
export async function resolveWithProviders(
  query: string,
  {
    apiKey,
    fetchImpl = fetch,
    timeoutMs = 3_000,
  }: { apiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<GeocodeOutcome> {
  const free = await photonSearch(query, fetchImpl, timeoutMs);
  if (free.kind === "hit") return free;

  const paid = await googlePlacesSearch(query, apiKey, fetchImpl, timeoutMs);
  if (paid.kind === "fault" && free.kind === "empty") return free;
  return paid;
}
