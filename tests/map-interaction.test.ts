import { describe, expect, it } from "bun:test";
import { spreadMapPins } from "../src/lib/maps/spread-map-pins";
import { mergeLocatedBlocks } from "../src/lib/maps/merge-located-blocks";
import type { Block } from "../src/lib/skins/types";
describe("map interaction safety", () => {
  it("separates co-located pins with deterministic offsets", () => {
    const pts = ["a", "b", "c", "d"].map((key) => ({ key, x: 20, y: 30 }));
    const offsets = spreadMapPins(pts);
    const coords = [...offsets.values()];
    for (let i = 0; i < coords.length; i++)
      for (let j = i + 1; j < coords.length; j++)
        expect(
          Math.hypot(coords[i][0] - coords[j][0], coords[i][1] - coords[j][1]),
        ).toBeGreaterThan(34);
    expect(spreadMapPins([...pts].reverse())).toEqual(offsets);
    expect(spreadMapPins([{ key: "a", x: 20, y: 30 }]).get("a")).toEqual([0, 0]);
  });
  it("applies location fields without overwriting an edit or manual fix", () => {
    const current: Block[] = [
      { kind: "place", name: "Museum", address: "1 Main", note: "Edited during lookup" },
      {
        kind: "place",
        name: "Hotel",
        address: "2 Main",
        lat: 1,
        lng: 2,
        geocode: { status: "manual", attempts: 0 },
      },
      { kind: "place", name: "Moved", address: "New address" },
    ];
    const saved: Block[] = [
      { kind: "place", name: "Museum", address: "1 Main", note: "Old note", lat: 3, lng: 4 },
      { kind: "place", name: "Hotel", address: "2 Main", lat: 5, lng: 6 },
      { kind: "place", name: "Moved", address: "Old address", lat: 7, lng: 8 },
    ];
    expect(mergeLocatedBlocks(current, saved)).toEqual([
      { ...current[0], lat: 3, lng: 4 },
      current[1],
      current[2],
    ]);
  });
});
