import { describe, expect, it } from "bun:test";
import { buildMapStyle, mapPalette, OPENFREEMAP_TILES } from "../src/lib/maps/map-style";
import { contrast, isDark } from "../src/lib/maps/color";
import { SKINS } from "../src/lib/skins/registry";

describe("Live Map style generator", () => {
  it("produces a valid MapLibre style over OpenFreeMap for every skin", () => {
    for (const skin of SKINS) {
      const style = buildMapStyle(skin.tokens);
      expect(style.version).toBe(8);
      expect((style.sources.omt as { url?: string }).url).toBe(OPENFREEMAP_TILES);
      expect(style.glyphs).toContain("openfreemap.org/fonts");
      const ids = style.layers.map((l) => l.id);
      expect(ids[0]).toBe("background");
      for (const layer of style.layers) {
        if ("source" in layer && layer.source) expect(layer.source).toBe("omt");
      }
      // No duplicate ids: MapLibre rejects the style otherwise.
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("reveals detail with zoom: minor roads at 14, footpaths, buildings and points of interest at 15, POI names at 17", () => {
    const style = buildMapStyle(SKINS[0].tokens);
    const byId = Object.fromEntries(style.layers.map((l) => [l.id, l]));
    expect(byId["road-minor"].minzoom).toBe(14);
    expect(byId["road-path"].minzoom).toBe(15);
    expect(byId["building"].minzoom).toBe(15);
    expect(byId["poi-dot"].minzoom).toBe(15);
    expect(byId["poi-label"].minzoom).toBe(17);
    expect(byId["road-name"].minzoom).toBe(15);
    // Major roads and water are always there.
    expect(byId["road-major"].minzoom).toBeUndefined();
    expect(byId["water"].minzoom).toBeUndefined();
  });

  it("only surfaces traveller-relevant points of interest", () => {
    const style = buildMapStyle(SKINS[0].tokens);
    const poi = style.layers.find((l) => l.id === "poi-dot")!;
    const filter = JSON.stringify(poi.filter);
    for (const cls of ["restaurant", "bar", "cafe", "museum", "park", "viewpoint"]) expect(filter).toContain(`"${cls}"`);
    for (const cls of ["atm", "fuel", "car", "post", "laundry", "hospital", "fast_food", "lodging"]) {
      expect(filter).not.toContain(`"${cls}"`);
    }
  });

  it("derives the plate from the skin's own paper and ink, with a dark recipe for night skins", () => {
    let darkSeen = 0;
    let lightSeen = 0;
    for (const skin of SKINS) {
      const p = mapPalette(skin.tokens);
      expect(p.land.toLowerCase()).toBe(skin.tokens.bg.toLowerCase());
      expect(p.water.toLowerCase()).not.toBe(p.land.toLowerCase());
      expect(p.dark).toBe(isDark(skin.tokens.bg));
      // Water must stay a whisper against land: visible, never a shape that
      // competes with pins (ratio just above 1, well under 2).
      const ratio = contrast(p.water, p.land);
      expect(ratio).toBeGreaterThan(1.05);
      expect(ratio).toBeLessThan(2);
      if (p.dark) darkSeen++;
      else lightSeen++;
    }
    expect(darkSeen).toBeGreaterThan(0);
    expect(lightSeen).toBeGreaterThan(0);
  });
});
