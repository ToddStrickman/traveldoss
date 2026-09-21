/**
 * Keyless place facts, server-only.
 *
 * Where the geocoder ladder only needs coordinates, the parser and the
 * quick-add form want the hard facts a dossier prints: a formatted address,
 * a phone number, a website, opening hours. Those used to come from Google
 * Places (billable, key-bound). They now come from OpenStreetMap:
 *
 *   1. Nominatim search with `addressdetails` + `extratags` — one call returns
 *      the display name, the address, and OSM's contact tags when the venue
 *      has them.
 *   2. Photon as the coordinate-only fallback, so a stop that Nominatim
 *      cannot name can still land on the map.
 *
 * No key, no quota to buy, no per-lookup bill. Missing facts stay missing;
 * this module never invents a value.
 */
import {
  NOMINATIM_PROVIDER,
  PHOTON_PROVIDER,
  nominatimSearchUrl,
  photonSearch,
  type GeocodeProvider,
} from "@/lib/maps/geocode-providers.server";
import { OSM_USER_AGENT } from "@/lib/maps/geocode-providers.server";

export type PlaceFacts = {
  provider: GeocodeProvider;
  /** OSM's own display name for the match, when it has one. */
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  /** Raw OSM `opening_hours` string, e.g. "Tu-Su 10:00-19:00". */
  hours?: string;
  lat?: number;
  lng?: number;
};

type NominatimRow = {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  extratags?: Record<string, string | undefined> | null;
};

/** Drop the leading venue name from Nominatim's comma-joined display name. */
function addressFrom(row: NominatimRow): string | undefined {
  const display = row.display_name?.trim();
  if (!display) return undefined;
  const name = row.name?.trim();
  if (name && display.toLowerCase().startsWith(`${name.toLowerCase()},`)) {
    return display.slice(name.length + 1).trim() || undefined;
  }
  return display;
}

/**
 * One bounded lookup. Returns `null` when nothing usable came back; never
 * throws, so a parse or a form suggestion is never broken by a lookup.
 */
export async function lookupPlaceFacts(
  query: string,
  {
    fetchImpl = fetch,
    timeoutMs = 4_000,
  }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<PlaceFacts | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(nominatimSearchUrl(query), {
        signal: ctrl.signal,
        headers: { Accept: "application/json", "User-Agent": OSM_USER_AGENT },
      });
      if (res.ok) {
        const json = (await res.json()) as NominatimRow[];
        const row = Array.isArray(json) ? json[0] : undefined;
        if (row) {
          const tags = row.extratags ?? {};
          const lat = row.lat != null ? Number(row.lat) : NaN;
          const lng = row.lon != null ? Number(row.lon) : NaN;
          return {
            provider: NOMINATIM_PROVIDER,
            name: row.name?.trim() || undefined,
            address: addressFrom(row),
            phone: (tags["phone"] ?? tags["contact:phone"])?.trim() || undefined,
            website: (tags["website"] ?? tags["contact:website"])?.trim() || undefined,
            hours: tags["opening_hours"]?.trim() || undefined,
            ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
          };
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    /* fall through to the coordinate-only provider */
  }

  const photon = await photonSearch(query, fetchImpl, timeoutMs);
  if (photon.kind === "hit") {
    return { provider: PHOTON_PROVIDER, lat: photon.hit.lat, lng: photon.hit.lng };
  }
  return null;
}
