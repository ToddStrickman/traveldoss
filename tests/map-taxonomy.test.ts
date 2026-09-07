import { describe, expect, it } from "bun:test";
import { MARKER_LABEL, markerIconFor, markerKindFor, pinPalette } from "../src/lib/maps/taxonomy";
import { contrast } from "../src/lib/maps/color";
import { SKINS } from "../src/lib/skins/registry";

describe("Live Map marker taxonomy", () => {
  it("maps the canonical six categories", () => {
    expect(markerKindFor("accommodation")).toBe("stay");
    expect(markerKindFor("restaurant")).toBe("dine");
    expect(markerKindFor("walk")).toBe("walk");
    expect(markerKindFor("event")).toBe("event");
    expect(markerKindFor("culture")).toBe("culture");
    expect(markerKindFor("transit")).toBe("transit");
  });

  it("maps every legacy alias somewhere sensible", () => {
    expect(markerKindFor("hotel")).toBe("stay");
    expect(markerKindFor("stay")).toBe("stay");
    expect(markerKindFor("eat")).toBe("dine");
    expect(markerKindFor("food")).toBe("dine");
    expect(markerKindFor("drink")).toBe("drink");
    expect(markerKindFor("see")).toBe("culture");
    expect(markerKindFor("do")).toBe("walk");
    expect(markerKindFor("walking")).toBe("walk");
    expect(markerKindFor("airfare")).toBe("transit");
    expect(markerKindFor("currency")).toBe("other");
  });

  it("never returns a blank kind", () => {
    expect(markerKindFor(undefined)).toBe("other");
    expect(markerKindFor(null)).toBe("other");
    expect(markerKindFor("")).toBe("other");
    expect(markerKindFor("bakery")).toBe("other");
    expect(markerKindFor("  Restaurant ")).toBe("dine");
  });

  it("has a label and an icon decision for every kind", () => {
    for (const kind of ["stay", "dine", "drink", "culture", "walk", "event", "transit", "other"] as const) {
      expect(MARKER_LABEL[kind].length).toBeGreaterThan(0);
      // `other` and `drink` draw the plain pin; everything else has a glyph.
      const icon = markerIconFor(kind);
      if (kind === "other" || kind === "drink") expect(icon).toBeNull();
      else expect(icon).not.toBeNull();
    }
    expect(markerIconFor("transit", "airfare")).not.toBe(markerIconFor("transit", "transit"));
  });

  it("pin fills clear WCAG AA against every skin's paper", () => {
    expect(SKINS.length).toBeGreaterThan(0);
    for (const skin of SKINS) {
      const palette = pinPalette(skin.tokens);
      for (const [kind, fill] of Object.entries(palette)) {
        const ratio = contrast(fill, skin.tokens.bg);
        expect(ratio, `${skin.meta.id} ${kind} ${fill} on ${skin.tokens.bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
