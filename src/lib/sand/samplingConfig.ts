/**
 * Single source of truth for the wordmark's per-line sand sampling knobs.
 *
 * The upright and (synthetic) oblique faces rasterize differently: the oblique
 * smears its antialiasing, so it needs a harder ink floor (stencil breaks stay
 * open), denser sampling (thin shapes survive at small render sizes) and an
 * edge boost so its contours resolve early in the excavation.
 *
 * Tune the values HERE — call sites spread these objects and never repeat the
 * numbers.
 */
import type { HeadlineLine } from "./textSampler";

/** The sampling-only subset of a headline line (no text/style fields). */
export type SandLineSampling = Pick<
  HeadlineLine,
  "inkAlpha" | "density" | "edgeBoost" | "tracking"
>;

/** Upright line (e.g. "Travel"). */
export const UPRIGHT_SAMPLING: SandLineSampling = {
  tracking: -0.022,
  inkAlpha: 80,
};

/** Oblique line (e.g. italic "Doss."). */
export const ITALIC_SAMPLING: SandLineSampling = {
  // Less negative tracking than upright so oblique glyphs don't collide.
  tracking: -0.014,
  inkAlpha: 132,
  density: 0.72,
  edgeBoost: 0.18,
};
