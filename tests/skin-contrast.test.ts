/**
 * Skin color-contrast guard.
 *
 * Every registered skin exposes a `tokens` block ({ bg, ink, inkSoft,
 * accent, rule }). Those five colors drive the entire dossier surface via
 * `SkinFrame` and the shared `skin.css` (see the House Rules in
 * .lovable/plan.md — small text is expected to pass contrast on all ten
 * skins). This test computes WCAG 2.1 contrast ratios for the pairings
 * actually rendered in production and fails when a skin drifts below the
 * relevant threshold, catching regressions the moment a new palette lands
 * without needing a Lighthouse run.
 *
 * Thresholds (WCAG 2.1 AA):
 *   • Body text   `ink`     vs `bg` ≥ 4.5:1  (normal-size prose)
 *   • UI / large  `accent`  vs `bg` ≥ 3.0:1  (button surfaces, large text,
 *                                             icon strokes)
 *   • Micro label `inkSoft` vs `bg` ≥ 3.0:1  (only ever used for the
 *                                             tracked-out uppercase eyebrow
 *                                             labels — a UI-component role,
 *                                             not body prose)
 */
import { describe, expect, it } from "vitest";
import { SKINS } from "@/lib/skins/registry";

type RGB = readonly [number, number, number];

/** Parse a hex (#rgb, #rrggbb) or rgb()/rgba() color to 0–1 RGB channels.
 *  Skin token values only ever use these two formats today; anything else
 *  is a mistake worth surfacing loudly. */
function parseColor(raw: string): RGB {
  const s = raw.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as unknown as RGB;
  }
  const rgb = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map((n) => n / 255) as unknown as RGB;
  }
  throw new Error(`Unsupported skin color format: ${raw}`);
}

/** sRGB → linear-light, per WCAG 2.1 relative-luminance formula. */
const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function luminance([r, g, b]: RGB): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Contrast ratio in the (1, 21] range. Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const [lo, hi] = [luminance(parseColor(a)), luminance(parseColor(b))].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
}

// Basic sanity on the ratio math so a subtle parser bug can never mask a
// real skin regression as a passing test.
describe("contrastRatio()", () => {
  it("returns 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });
  it("returns 1 for identical colors", () => {
    expect(contrastRatio("#7a2e1f", "#7a2e1f")).toBeCloseTo(1, 5);
  });
  it("is order-independent", () => {
    expect(contrastRatio("#111", "#eee")).toBeCloseTo(contrastRatio("#eee", "#111"), 5);
  });
  it("parses rgba() alongside hex (rule tokens use rgba)", () => {
    expect(contrastRatio("rgba(26,24,19,1)", "#ffffff")).toBeGreaterThan(15);
  });
});

describe("skin color tokens meet WCAG 2.1 AA", () => {
  it.each(SKINS.map((s) => [s.meta.id, s]))(
    "%s: body text (ink vs bg) ≥ 4.5:1",
    (_id, skin) => {
      const ratio = contrastRatio(skin.tokens.ink, skin.tokens.bg);
      expect(ratio, `ink ${skin.tokens.ink} on bg ${skin.tokens.bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(SKINS.map((s) => [s.meta.id, s]))(
    "%s: accent surface (accent vs bg) ≥ 3.0:1 — UI / large-text threshold",
    (_id, skin) => {
      const ratio = contrastRatio(skin.tokens.accent, skin.tokens.bg);
      expect(ratio, `accent ${skin.tokens.accent} on bg ${skin.tokens.bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3.0);
    },
  );

  it.each(SKINS.map((s) => [s.meta.id, s]))(
    "%s: micro eyebrow label (inkSoft vs bg) ≥ 3.0:1",
    (_id, skin) => {
      // inkSoft is only ever composed onto bg as tracked-out uppercase
      // labels (SkinFrame's [data-role=eyebrow]) — treat as UI/large-text
      // per WCAG, not body prose. Any non-eyebrow small text renders in
      // `ink` and is covered by the body-text assertion above.
      const ratio = contrastRatio(skin.tokens.inkSoft, skin.tokens.bg);
      expect(ratio, `inkSoft ${skin.tokens.inkSoft} on bg ${skin.tokens.bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3.0);
    },
  );
});