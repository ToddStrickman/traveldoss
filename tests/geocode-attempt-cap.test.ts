import { describe, expect, it } from "bun:test";
import {
  enrichBlocksWithCoords,
  geocodeQueryFor,
  MAX_GEOCODE_ATTEMPTS,
  shouldAttemptGeocode,
  type GeocodeDeps,
} from "../src/lib/itinerary/geo.server";
import type { GeocodeCacheEntry, GeocodeHit } from "../src/lib/maps/geocode-cache.server";
import type { Block } from "../src/lib/skins/types";

type PlaceBlock = Extract<Block, { kind: "place" }>;

/** In-memory stand-ins for Google and the geocode_cache table. */
function harness(answers: Array<GeocodeHit | null>) {
  const calls: string[] = [];
  const cache = new Map<string, GeocodeCacheEntry>();
  const deps: GeocodeDeps = {
    fetchImpl: (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { textQuery: string };
      calls.push(body.textQuery);
      const next = answers.shift() ?? null;
      const places = next
        ? [{ id: next.placeId, location: { latitude: next.lat, longitude: next.lng } }]
        : [];
      return new Response(JSON.stringify({ places }), { status: 200 });
    }) as unknown as typeof fetch,
    readCache: async (q) => cache.get(q),
    writeCache: async (q, hit, provider) => {
      cache.set(q, { hit, provider });
    },
    now: () => Date.UTC(2026, 8, 7, 12, 0, 0),
  };
  return { calls, cache, deps };
}

const place = (extra: Partial<PlaceBlock> = {}): PlaceBlock => ({
  kind: "place",
  name: "Nowhere Café",
  address: "1 Rua Inexistente, Lisboa",
  ...extra,
});

describe("geocode backfill: attempt cap and shared cache", () => {
  it("does not spend attempts on repeated cached misses", async () => {
    const h = harness([null]);
    let blocks: Block[] = [{ kind: "day", n: 1, label: "Day" }, place()];
    for (let save = 1; save <= MAX_GEOCODE_ATTEMPTS + 2; save++) {
      blocks = await enrichBlocksWithCoords(blocks, { apiKey: "k", deps: h.deps, budgetMs: 1_000 });
    }
    const b = blocks[1] as PlaceBlock;
    expect(b.lat).toBeUndefined();
    expect(b.geocode?.status).toBe("pending");
    expect(b.geocode?.attempts).toBe(1);
    expect(b.geocode?.query).toBe("Nowhere Café, 1 Rua Inexistente, Lisboa");
    // The first save asked Google; later saves hit the cached miss; after
    // the cap nothing is attempted at all.
    expect(h.calls).toHaveLength(1);
  });

  it("stores coordinates, the Places id and a resolved status on a hit", async () => {
    const h = harness([{ lat: 38.71, lng: -9.14, placeId: "pid-1" }]);
    const out = await enrichBlocksWithCoords([place()], { apiKey: "k", deps: h.deps });
    const b = out[0] as PlaceBlock;
    expect(b.lat).toBe(38.71);
    expect(b.lng).toBe(-9.14);
    expect(b.placeId).toBe("pid-1");
    expect(b.geocode).toEqual({
      status: "resolved",
      provider: "google-places",
      attempts: 1,
      query: "Nowhere Café, 1 Rua Inexistente, Lisboa",
      at: "2026-09-07T12:00:00.000Z",
    });
  });

  it("serves the second dossier with the same query from the cache", async () => {
    const h = harness([{ lat: 38.71, lng: -9.14, placeId: "pid-1" }]);
    await enrichBlocksWithCoords([place()], { apiKey: "k", deps: h.deps });
    const again = await enrichBlocksWithCoords([place()], { apiKey: "k", deps: h.deps });
    expect((again[0] as PlaceBlock).placeId).toBe("pid-1");
    expect(h.calls).toHaveLength(1);
  });

  it("never touches manual fixes, hidden stops, or already-located stops", () => {
    expect(shouldAttemptGeocode(place({ lat: 1, lng: 1 }))).toBe(false);
    expect(shouldAttemptGeocode(place({ mapHidden: true }))).toBe(false);
    expect(shouldAttemptGeocode(place({ geocode: { status: "manual", attempts: 0 } }))).toBe(false);
    expect(shouldAttemptGeocode(place({ geocode: { status: "needs_review", attempts: 3 } }))).toBe(false);
    expect(shouldAttemptGeocode(place({ geocode: { status: "pending", attempts: 1 } }))).toBe(true);
    expect(shouldAttemptGeocode(place())).toBe(true);
  });

  it("builds the query from the address first, then name plus destination", () => {
    expect(geocodeQueryFor(place(), "Lisbon")).toBe("Nowhere Café, 1 Rua Inexistente, Lisboa");
    expect(geocodeQueryFor(place({ address: undefined }), "Lisbon")).toBe("Nowhere Café, Lisbon");
    expect(geocodeQueryFor(place({ address: undefined }), null)).toBeNull();
  });

  it("does nothing without an API key", async () => {
    const h = harness([{ lat: 1, lng: 1 }]);
    const input: Block[] = [place()];
    const out = await enrichBlocksWithCoords(input, { apiKey: "", deps: h.deps });
    expect(out).toBe(input);
    expect(h.calls).toHaveLength(0);
  });
});

describe("geocode failure recovery", () => {
  for (const status of [400, 401, 403, 429, 500, 503]) {
    it("does not cache or consume attempts for HTTP " + status, async () => {
      const writes: unknown[] = [];
      let serviceErrors = 0;
      const input = [place()];
      const out = await enrichBlocksWithCoords(input, { apiKey: "test", deps: {
        readCache: async () => undefined,
        writeCache: async (...args) => { writes.push(args); },
        fetchImpl: (async () => new Response("{}", { status })) as typeof fetch,
        onServiceError: () => { serviceErrors++; },
      } });
      expect(out).toBe(input);
      expect(writes).toHaveLength(0);
      expect(serviceErrors).toBe(1);
    });
  }
  it("explicit retry bypasses a poisoned negative cache and resolves a capped stop", async () => {
    const h = harness([{ lat: 41.8986, lng: 12.4769, placeId: "pantheon" }]);
    const b = place({ geocode: { status: "needs_review", attempts: 3 } });
    h.cache.set(geocodeQueryFor(b)!, { hit: null, provider: "google-places" });
    const out = await enrichBlocksWithCoords([b], { apiKey: "test", deps: h.deps, retryNeedsReview: true });
    expect((out[0] as PlaceBlock).lat).toBe(41.8986);
    expect((out[0] as PlaceBlock).geocode?.status).toBe("resolved");
    expect(h.calls).toHaveLength(1);
  });
  it("caps three real zero-result responses, even across cache expiry", async () => {
    const h = harness([null,null,null,null]);
    let blocks: Block[] = [place()];
    for (let i=0; i<4; i++) {
      h.cache.clear();
      blocks = await enrichBlocksWithCoords(blocks, { apiKey: "test", deps:h.deps });
    }
    expect(h.calls).toHaveLength(3);
    expect((blocks[0] as PlaceBlock).geocode?.status).toBe("needs_review");
  });
  it("preserves good cached coordinates on an explicit retry", async () => {
    const h=harness([]);
    const b=place({geocode:{status:"needs_review",attempts:3}});
    h.cache.set(geocodeQueryFor(b)!,{hit:{lat:0,lng:0,placeId:"origin"},provider:"google-places"});
    const out=await enrichBlocksWithCoords([b],{apiKey:"test",deps:h.deps,retryNeedsReview:true});
    expect((out[0] as PlaceBlock).lat).toBe(0);
    expect(h.calls).toHaveLength(0);
  });
  it("preserves stops on a network timeout without caching it", async () => {
    const h=harness([]);
    h.deps.fetchImpl=(async () => { throw new Error("timeout"); }) as unknown as typeof fetch;
    const input=[place()];
    expect(await enrichBlocksWithCoords(input,{apiKey:"test",deps:h.deps})).toBe(input);
    expect(h.cache.size).toBe(0);
  });
});
