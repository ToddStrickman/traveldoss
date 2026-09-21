/**
 * The keyless provider ladder: Photon first, Nominatim second, and faults
 * that are never cached and never counted.
 */
import { describe, expect, it } from "bun:test";
import {
  nominatimSearchUrl,
  photonSearchUrl,
  resolveWithProviders,
  type GeocodeOutcome,
} from "../src/lib/maps/geocode-providers.server";
import { enrichBlocksWithCoords, type GeocodeDeps } from "../src/lib/itinerary/geo.server";
import type { GeocodeCacheEntry, GeocodeHit } from "../src/lib/maps/geocode-cache.server";
import type { Block } from "../src/lib/skins/types";

type PlaceBlock = Extract<Block, { kind: "place" }>;

const PANTHEON = "Pantheon, Piazza della Rotonda, 00186 Roma RM, Italy";

/** Routes photon and nominatim calls to separate scripted answers. */
function ladder(opts: {
  photon?: () => Response | Promise<Response>;
  nominatim?: () => Response | Promise<Response>;
}) {
  const urls: string[] = [];
  const fetchImpl = (async (url: string | URL) => {
    const href = String(url);
    urls.push(href);
    if (href.startsWith("https://photon")) {
      if (!opts.photon) throw new Error("photon not scripted");
      return opts.photon();
    }
    expect(href.startsWith("https://nominatim.openstreetmap.org/search")).toBe(true);
    if (!opts.nominatim) throw new Error("nominatim not scripted");
    return opts.nominatim();
  }) as unknown as typeof fetch;
  return { urls, fetchImpl };
}

const photonHit = (lng: number, lat: number) =>
  new Response(JSON.stringify({ features: [{ geometry: { coordinates: [lng, lat] } }] }));
const photonEmpty = () => new Response(JSON.stringify({ features: [] }));
const nominatimHit = () => new Response(JSON.stringify([{ lat: "41.9", lon: "12.47" }]));
const nominatimEmpty = () => new Response(JSON.stringify([]));

describe("geocode provider ladder", () => {
  it("asks Photon first and stops there when it answers", async () => {
    const l = ladder({ photon: () => photonHit(12.4768729, 41.8986108) });
    const out = await resolveWithProviders(PANTHEON, { fetchImpl: l.fetchImpl });
    expect(out).toEqual({
      kind: "hit",
      provider: "photon",
      hit: { lat: 41.8986108, lng: 12.4768729 },
    } satisfies GeocodeOutcome);
    expect(l.urls).toEqual([photonSearchUrl(PANTHEON)]);
  });

  it("falls back to Nominatim when Photon has no answer", async () => {
    const l = ladder({ photon: photonEmpty, nominatim: nominatimHit });
    const out = await resolveWithProviders("Cantina Tirolese", { fetchImpl: l.fetchImpl });
    expect(out).toEqual({
      kind: "hit",
      provider: "nominatim",
      hit: { lat: 41.9, lng: 12.47 },
    } satisfies GeocodeOutcome);
    expect(l.urls[1]).toBe(nominatimSearchUrl("Cantina Tirolese"));
  });

  it("uses no credentials at all", async () => {
    const l = ladder({ photon: () => photonHit(12.4, 41.8) });
    await resolveWithProviders(PANTHEON, { fetchImpl: l.fetchImpl });
    for (const url of l.urls) {
      expect(url).not.toContain("key=");
      expect(url).not.toContain("googleapis");
    }
  });

  it("reports a rejected lookup as a fault, not as 'address not found'", async () => {
    const l = ladder({
      photon: () => new Response("nope", { status: 502 }),
      nominatim: () => new Response("slow down", { status: 429 }),
    });
    const out = await resolveWithProviders(PANTHEON, { fetchImpl: l.fetchImpl });
    expect(out).toEqual({ kind: "fault", provider: "nominatim", reason: "http_429" });
  });

  it("keeps a genuine empty answer when the second provider faults", async () => {
    const l = ladder({ photon: photonEmpty, nominatim: () => new Response("x", { status: 503 }) });
    const out = await resolveWithProviders("Somewhere unfindable", { fetchImpl: l.fetchImpl });
    expect(out).toEqual({ kind: "empty", provider: "photon" });
  });

  it("reports empty when both providers genuinely find nothing", async () => {
    const l = ladder({ photon: photonEmpty, nominatim: nominatimEmpty });
    const out = await resolveWithProviders("Somewhere unfindable", { fetchImpl: l.fetchImpl });
    expect(out.kind).toBe("empty");
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
    const h = harness(() => new Response("denied", { status: 503 }));
    let blocks: Block[] = [stop];
    for (let save = 0; save < 3; save++) {
      blocks = await enrichBlocksWithCoords(blocks, { deps: h.deps });
    }
    const b = blocks[0] as PlaceBlock;
    expect(b.geocode).toBeUndefined();
    expect(h.cache.size).toBe(0);
  });

  it("still caches and counts a genuine empty answer", async () => {
    const h = harness(() => new Response(JSON.stringify({ features: [] })));
    const out = await enrichBlocksWithCoords([stop], { deps: h.deps });
    const b = out[0] as PlaceBlock;
    expect(b.geocode?.status).toBe("pending");
    expect(b.geocode?.attempts).toBe(1);
    expect(h.cache.size).toBe(1);
  });
});
