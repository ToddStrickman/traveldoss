/**
 * The provider ladder: free Photon first, Google via the connector gateway as
 * the fallback, and faults that are never cached and never counted.
 */
import { describe, expect, it } from "bun:test";
import {
  photonSearchUrl,
  resolveWithProviders,
  type GeocodeOutcome,
} from "../src/lib/maps/geocode-providers.server";
import { PLACES_SEARCH_TEXT_URL } from "../src/lib/maps/places-request.server";
import { enrichBlocksWithCoords, type GeocodeDeps } from "../src/lib/itinerary/geo.server";
import type { GeocodeCacheEntry, GeocodeHit } from "../src/lib/maps/geocode-cache.server";
import type { Block } from "../src/lib/skins/types";

type PlaceBlock = Extract<Block, { kind: "place" }>;

process.env.LOVABLE_API_KEY ??= "lovable-test-key";

const PANTHEON = "Pantheon, Piazza della Rotonda, 00186 Roma RM, Italy";

/** Routes photon and gateway calls to separate scripted answers. */
function ladder(opts: {
  photon?: () => Response | Promise<Response>;
  google?: () => Response | Promise<Response>;
}) {
  const urls: string[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    urls.push(href);
    if (href.startsWith("https://photon")) {
      if (!opts.photon) throw new Error("photon not scripted");
      return opts.photon();
    }
    expect(href).toBe(PLACES_SEARCH_TEXT_URL);
    expect(init?.method).toBe("POST");
    if (!opts.google) throw new Error("google not scripted");
    return opts.google();
  }) as unknown as typeof fetch;
  return { urls, fetchImpl };
}

const photonHit = (lng: number, lat: number) =>
  new Response(JSON.stringify({ features: [{ geometry: { coordinates: [lng, lat] } }] }));
const photonEmpty = () => new Response(JSON.stringify({ features: [] }));
const googleHit = () =>
  new Response(
    JSON.stringify({ places: [{ id: "pid-1", location: { latitude: 41.9, longitude: 12.47 } }] }),
  );

describe("geocode provider ladder", () => {
  it("asks the free provider first and never pays when it answers", async () => {
    const l = ladder({ photon: () => photonHit(12.4768729, 41.8986108) });
    const out = await resolveWithProviders(PANTHEON, { apiKey: "conn", fetchImpl: l.fetchImpl });
    expect(out).toEqual({
      kind: "hit",
      provider: "photon",
      hit: { lat: 41.8986108, lng: 12.4768729 },
    } satisfies GeocodeOutcome);
    expect(l.urls).toEqual([photonSearchUrl(PANTHEON)]);
  });

  it("falls back to Google through the gateway when the free provider is empty", async () => {
    const l = ladder({ photon: photonEmpty, google: googleHit });
    const out = await resolveWithProviders("Cantina Tirolese", {
      apiKey: "conn",
      fetchImpl: l.fetchImpl,
    });
    expect(out.kind).toBe("hit");
    expect(out.provider).toBe("google-places");
    expect(l.urls[1]).toBe(PLACES_SEARCH_TEXT_URL);
  });

  it("reports a rejected gateway call as a fault, not as 'address not found'", async () => {
    const l = ladder({
      photon: () => new Response("nope", { status: 502 }),
      google: () => new Response("denied", { status: 403 }),
    });
    const out = await resolveWithProviders(PANTHEON, { apiKey: "conn", fetchImpl: l.fetchImpl });
    expect(out).toEqual({ kind: "fault", provider: "google-places", reason: "http_403" });
  });

  it("keeps a genuine empty answer even when the paid fallback is misconfigured", async () => {
    const l = ladder({ photon: photonEmpty });
    const out = await resolveWithProviders("Somewhere unfindable", {
      apiKey: undefined,
      fetchImpl: l.fetchImpl,
    });
    expect(out).toEqual({ kind: "empty", provider: "photon" });
  });
});

describe("faults never poison the cache or the attempt ladder", () => {
  function harness(respond: () => Response) {
    const cache = new Map<string, GeocodeCacheEntry>();
    const deps: GeocodeDeps = {
      fetchImpl: (async () => respond()) as unknown as typeof fetch,
      readCache: async (q) => cache.get(q),
      writeCache: async (q, hit: GeocodeHit | null, provider) => {
        cache.set(q, { hit, provider });
      },
      now: () => Date.UTC(2026, 8, 14, 12, 0, 0),
    };
    return { cache, deps };
  }

  const stop: PlaceBlock = {
    kind: "place",
    name: "Pantheon",
    address: "Piazza della Rotonda, 00186 Roma RM, Italy",
  };

  it("leaves the stop untouched when every provider faults", async () => {
    const h = harness(() => new Response("denied", { status: 403 }));
    let blocks: Block[] = [stop];
    for (let save = 0; save < 5; save++) {
      blocks = await enrichBlocksWithCoords(blocks, { apiKey: "conn", deps: h.deps });
    }
    const b = blocks[0] as PlaceBlock;
    expect(b.geocode).toBeUndefined();
    expect(h.cache.size).toBe(0);
  });

  it("still caches and counts a genuine empty answer", async () => {
    const h = harness(() => new Response(JSON.stringify({ features: [], places: [] })));
    const out = await enrichBlocksWithCoords([stop], { apiKey: "conn", deps: h.deps });
    const b = out[0] as PlaceBlock;
    expect(b.geocode?.status).toBe("pending");
    expect(b.geocode?.attempts).toBe(1);
    expect(h.cache.size).toBe(1);
  });
});
