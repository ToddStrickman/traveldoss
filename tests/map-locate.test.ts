import { describe, expect, it } from "bun:test";
import { summarizeLocate } from "../src/lib/maps/locate-summary";
import { enrichBlocksWithCoords, type GeocodeDeps } from "../src/lib/itinerary/geo.server";
import type { GeocodeCacheEntry, GeocodeHit } from "../src/lib/maps/geocode-cache.server";
import type { Block } from "../src/lib/skins/types";

type PlaceBlock = Extract<Block, { kind: "place" }>;

function harness(answers: Array<GeocodeHit | null>) {
  const calls: string[] = [];
  const cache = new Map<string, GeocodeCacheEntry>();
  const deps: GeocodeDeps = {
    fetchImpl: (async (url: string) => {
      const q = new URL(String(url)).searchParams.get("q") ?? "";
      calls.push(q);
      const next = answers.shift() ?? null;
      const features = next ? [{ geometry: { coordinates: [next.lng, next.lat] } }] : [];
      return new Response(JSON.stringify({ features }), { status: 200 });
    }) as unknown as typeof fetch,
    readCache: async (q) => cache.get(q),
    writeCache: async (q, hit, provider) => {
      cache.set(q, { hit, provider });
    },
  };
  return { calls, deps };
}

const stop = (name: string, extra: Partial<PlaceBlock> = {}): PlaceBlock => ({
  kind: "place",
  name,
  address: `${name} street 1, Lisboa`,
  ...extra,
});

describe("Locate stops", () => {
  it("summarises what a pass achieved", () => {
    const before: Block[] = [stop("A"), stop("B"), stop("C", { geocode: { status: "needs_review", attempts: 3 } })];
    const after: Block[] = [
      stop("A", { lat: 1, lng: 1, geocode: { status: "resolved", attempts: 1 } }),
      stop("B", { geocode: { status: "pending", attempts: 1 } }),
      stop("C", { geocode: { status: "needs_review", attempts: 3 } }),
    ];
    expect(summarizeLocate(before, after, true)).toEqual({ configured: true, located: 1, unresolved: 1, remaining: 1 });
    expect(summarizeLocate(before, before, false)).toEqual({ configured: false, located: 0, unresolved: 1, remaining: 2 });
  });

  it("looks up more stops per call than an autosave does", async () => {
    const answers = Array.from({ length: 12 }, (_, i) => ({ lat: 38 + i / 100, lng: -9, placeId: `p${i}` }));
    const h = harness(answers);
    const blocks: Block[] = Array.from({ length: 12 }, (_, i) => stop(`Stop ${i}`));
    const auto = await enrichBlocksWithCoords(blocks, { deps: h.deps });
    expect(auto.filter((b) => b.kind === "place" && b.lat != null)).toHaveLength(8);
    const h2 = harness(Array.from({ length: 12 }, (_, i) => ({ lat: 38 + i / 100, lng: -9, placeId: `p${i}` })));
    const owner = await enrichBlocksWithCoords(blocks, { deps: h2.deps, maxPerRun: 24 });
    expect(owner.filter((b) => b.kind === "place" && b.lat != null)).toHaveLength(12);
  });

  it("gives a capped stop one more try only when the owner asks", async () => {
    const capped = stop("Lost", { geocode: { status: "needs_review", attempts: 3, query: "Lost street 1, Lisboa" } });
    const auto = harness([{ lat: 1, lng: 1 }]);
    const untouched = await enrichBlocksWithCoords([capped], { deps: auto.deps });
    expect(auto.calls).toHaveLength(0);
    expect((untouched[0] as PlaceBlock).lat).toBeUndefined();

    const owner = harness([{ lat: 1, lng: 1 }]);
    const retried = await enrichBlocksWithCoords([capped], { deps: owner.deps, retryNeedsReview: true });
    expect(owner.calls).toHaveLength(1);
    const b = retried[0] as PlaceBlock;
    expect(b.lat).toBe(1);
    expect(b.geocode?.status).toBe("resolved");
    expect(b.geocode?.attempts).toBe(4);
  });

  it("keeps a capped stop capped when the retry also misses", async () => {
    const capped = stop("Lost", { geocode: { status: "needs_review", attempts: 3 } });
    const owner = harness([null]);
    const retried = await enrichBlocksWithCoords([capped], { deps: owner.deps, retryNeedsReview: true });
    expect((retried[0] as PlaceBlock).geocode?.status).toBe("needs_review");
    expect((retried[0] as PlaceBlock).geocode?.attempts).toBe(4);
  });
});
