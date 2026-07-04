/**
 * Rasterizes the headline to an offscreen canvas and samples it into
 * particle home positions. Also computes per-point "edgeness" (how close a
 * grain sits to a letter contour) so fine edges only resolve after deeper
 * excavation — the multi-pass discovery effect.
 */

export interface HeadlineLine {
  text: string;
  italic?: boolean;
  /** Trailing glyph rendered in the accent (champagne gold) palette. */
  accent?: string;
}

export interface SampledPoint {
  x: number;         // world units, centered on (0,0), +y up
  y: number;
  edgeness: number;  // 0 = deep interior, 1 = contour
  accent: boolean;   // true → gold palette (the "Doss." period)
}

export interface SampledText {
  points: SampledPoint[];
  /** World-space bounds of the sampled glyphs. */
  width: number;
  height: number;
}

interface SampleOptions {
  lines: HeadlineLine[];
  fontFamily: string;
  fontWeight?: number;
  /** Max world width the headline may occupy. */
  worldWidth: number;
  /** Max world height — the fitted scale honors both bounds. */
  worldHeight: number;
  /** Max particles to return; sampler decimates uniformly beyond this. */
  maxPoints: number;
  rand: () => number;
}

const RASTER_FONT_PX = 220;   // large enough that grid sampling stays crisp
const GRID_STEP = 2;          // raster px between samples ≈ grain spacing
const LINE_GAP = 0.98;        // line-height multiple, matches leading-[0.95]

/** Wait for the display font so we never sample the fallback serif. */
export async function ensureFontLoaded(family: string, weight = 400): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const probe = `${weight} ${RASTER_FONT_PX}px "${family}"`;
  const probeItalic = `italic ${weight} ${RASTER_FONT_PX}px "${family}"`;
  try {
    await Promise.all([document.fonts.load(probe), document.fonts.load(probeItalic)]);
  } catch {
    // Fallback font sampling still produces a sand headline — just less pretty.
  }
}

export function sampleHeadline(opts: SampleOptions): SampledText {
  const { lines, fontFamily, fontWeight = 400, worldWidth, worldHeight, maxPoints, rand } = opts;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { points: [], width: 0, height: 0 };

  const fontFor = (italic: boolean) =>
    `${italic ? "italic " : ""}${fontWeight} ${RASTER_FONT_PX}px "${fontFamily}", Georgia, serif`;

  // Measure each line (body + optional accent glyph) to size the canvas.
  const lineMetrics = lines.map((line) => {
    ctx.font = fontFor(!!line.italic);
    const bodyW = ctx.measureText(line.text).width;
    const accentW = line.accent ? ctx.measureText(line.accent).width : 0;
    return { bodyW, accentW, totalW: bodyW + accentW };
  });

  const lineHeight = RASTER_FONT_PX * LINE_GAP;
  const rasterW = Math.ceil(Math.max(...lineMetrics.map((m) => m.totalW)) + 40);
  const rasterH = Math.ceil(lineHeight * lines.length + RASTER_FONT_PX * 0.4);
  canvas.width = rasterW;
  canvas.height = rasterH;

  // Pass 1: body glyphs in red channel, accent glyphs in green channel, so a
  // single readback distinguishes the two palettes.
  ctx.clearRect(0, 0, rasterW, rasterH);
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, i) => {
    const m = lineMetrics[i];
    const x = (rasterW - m.totalW) / 2;
    const baseline = RASTER_FONT_PX * 0.9 + i * lineHeight;
    ctx.font = fontFor(!!line.italic);
    ctx.fillStyle = "rgb(255,0,0)";
    ctx.fillText(line.text, x, baseline);
    if (line.accent) {
      ctx.fillStyle = "rgb(0,255,0)";
      ctx.fillText(line.accent, x + m.bodyW, baseline);
    }
  });

  const img = ctx.getImageData(0, 0, rasterW, rasterH);
  const data = img.data;
  const alphaAt = (px: number, py: number): number => {
    if (px < 0 || py < 0 || px >= rasterW || py >= rasterH) return 0;
    return data[(py * rasterW + px) * 4 + 3];
  };

  // Fit the raster inside BOTH world bounds — a two-line headline in a
  // short hero band is height-constrained, not width-constrained.
  const scale = Math.min(worldWidth / rasterW, worldHeight / rasterH);
  const candidates: SampledPoint[] = [];

  for (let py = 0; py < rasterH; py += GRID_STEP) {
    for (let px = 0; px < rasterW; px += GRID_STEP) {
      const idx = (py * rasterW + px) * 4;
      const a = data[idx + 3];
      if (a < 90) continue;

      // Edgeness: how many of the 4 neighbors (one step out) are empty.
      const step = GRID_STEP * 2;
      let empty = 0;
      if (alphaAt(px - step, py) < 90) empty++;
      if (alphaAt(px + step, py) < 90) empty++;
      if (alphaAt(px, py - step) < 90) empty++;
      if (alphaAt(px, py + step) < 90) empty++;

      // Sub-grid jitter so grains never sit on a visible lattice.
      const jx = (rand() - 0.5) * GRID_STEP;
      const jy = (rand() - 0.5) * GRID_STEP;

      candidates.push({
        x: (px + jx - rasterW / 2) * scale,
        y: -(py + jy - rasterH / 2) * scale, // canvas y-down → world y-up
        edgeness: empty / 4,
        accent: data[idx + 1] > data[idx], // green channel wins → accent glyph
      });
    }
  }

  // Uniform decimation to the particle budget (Fisher–Yates prefix).
  if (candidates.length > maxPoints) {
    for (let i = 0; i < maxPoints; i++) {
      const j = i + ((rand() * (candidates.length - i)) | 0);
      const t = candidates[i]; candidates[i] = candidates[j]; candidates[j] = t;
    }
    candidates.length = maxPoints;
  }

  return {
    points: candidates,
    width: rasterW * scale,
    height: rasterH * scale,
  };
}

/**
 * Procedural "hidden ancient details": faint chisel strokes and border
 * glyphs that only materialize after deep excavation. Drawn as abstract
 * marks (not real characters) so they read as weathered carving.
 */
export function sampleGlyphs(
  worldWidth: number,
  worldHeight: number,
  count: number,
  rand: () => number,
): SampledPoint[] {
  const points: SampledPoint[] = [];
  // Few marks, placed sparsely — these should be a discovery, not clutter.
  const marks = 4 + ((rand() * 3) | 0);
  for (let m = 0; m < marks; m++) {
    // Each mark: a short stroke of grains somewhere along the top/bottom
    // margins, angled like a chisel cut.
    const cx = (rand() - 0.5) * worldWidth * 0.9;
    const cy = (rand() < 0.5 ? 1 : -1) * (worldHeight * (0.44 + rand() * 0.1));
    const angle = rand() * Math.PI;
    const len = worldWidth * (0.015 + rand() * 0.02);
    const per = Math.max(6, (count / marks) | 0);
    for (let i = 0; i < per; i++) {
      const t = (i / per - 0.5) * 2;
      points.push({
        x: cx + Math.cos(angle) * len * t + (rand() - 0.5) * 2,
        y: cy + Math.sin(angle) * len * t + (rand() - 0.5) * 2,
        edgeness: 0.9,
        accent: rand() < 0.25,
      });
    }
  }
  return points;
}
