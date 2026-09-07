/**
 * Tiny colour math for the Live Map. Skin tokens arrive as hex or rgb()
 * strings; MapLibre paint properties want plain strings back. No
 * dependency, no colour-space heroics: sRGB mixing is enough for tints
 * derived from a skin's own paper and ink, and the WCAG contrast check is
 * the same formula `tests/skin-contrast.test.ts` uses.
 */

export type RGB = [number, number, number]; // 0–255

export function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
  }
  const rgb = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] as RGB;
  return null;
}

export function toHex([r, g, b]: RGB): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear blend `t` of the way from `a` to `b` (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return a;
  const k = Math.max(0, Math.min(1, t));
  return toHex([ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k]);
}

/** rgba() string with the given alpha. Falls back to the input when unparseable. */
export function alpha(color: string, a: number): string {
  const c = parseColor(color);
  if (!c) return color;
  return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;
}

const linearize = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

export function luminance(color: string): number {
  const c = parseColor(color);
  if (!c) return 0;
  return 0.2126 * linearize(c[0]) + 0.7152 * linearize(c[1]) + 0.0722 * linearize(c[2]);
}

/** WCAG 2.1 contrast ratio between two colours. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** True for dark grounds (the five night skins). */
export function isDark(color: string): boolean {
  return luminance(color) < 0.35;
}

/**
 * Push `fg` toward `toward` in 5% steps until it clears `min` contrast
 * against `bg`, capped at 70% so a colour never loses its identity. Used
 * for pin fills: the glyph is drawn in the skin's paper, so the fill must
 * clear AA against the paper on every skin.
 */
export function ensureContrast(fg: string, bg: string, toward: string, min: number): string {
  let out = fg;
  for (let t = 0; t <= 0.7 && contrast(out, bg) < min; t += 0.05) out = mix(fg, toward, t);
  return out;
}
