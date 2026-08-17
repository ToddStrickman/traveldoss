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
  /**
   * Number of leading characters drawn at `leadScale` — a brush-script
   * swash capital. The face's cap "T" is barely taller than its lowercase,
   * so the wordmark needs the initial enlarged to read as a capital.
   */
  leadChars?: number;
  /** Font-size multiple for the leading characters. Default 1 (no swash). */
  leadScale?: number;
  /**
   * Letter-spacing in em, applied between every glyph of the line (and before
   * the accent glyph). Negative tightens — the stencil face sets loose by
   * default, so the wordmark wants a small negative value to read as one word.
   */
  tracking?: number;
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
  /**
   * Per-line horizontal alignment inside the raster's max-width box.
   * "center" (default) preserves the old symmetric layout; "left" flush-lefts
   * every line so a two-line headline reads as a left-aligned inscription.
   */
  align?: "center" | "left";
  /**
   * Line-height multiple. Default 0.98. Brush/script faces carry a lot of
   * empty em above and below the ink, so they want a tighter value to keep
   * the two words of the wordmark visually joined.
   */
  lineGap?: number;
}

const RASTER_FONT_PX = 220;   // large enough that grid sampling stays crisp
const GRID_STEP = 2;          // raster px between samples ≈ grain spacing
const LINE_GAP = 0.88;        // line-height multiple — stencil face carries
                              // dead em space, so the two words sit tighter
/**
 * Alpha floor for "this pixel is ink". Low enough that the tapered, dry ends
 * of brush strokes still become grains — that feathering IS the brush.
 */
const INK_ALPHA = 62;

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
  const {
    lines, fontFamily, fontWeight = 400, worldWidth, worldHeight, maxPoints, rand,
    align = "center", lineGap = LINE_GAP,
  } = opts;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { points: [], width: 0, height: 0 };

  const fontFor = (italic: boolean, px = RASTER_FONT_PX) =>
    `${italic ? "italic " : ""}${fontWeight} ${px}px "${fontFamily}", Georgia, serif`;

  /** Width of `text` under the current font, including per-glyph tracking. */
  const widthOf = (text: string, trackPx: number) =>
    text ? ctx.measureText(text).width + trackPx * text.length : 0;

  /** Draw `text` glyph by glyph so tracking applies; returns advance used. */
  const drawTracked = (text: string, x: number, baseline: number, trackPx: number) => {
    let cursor = x;
    for (const ch of text) {
      ctx.fillText(ch, cursor, baseline);
      cursor += ctx.measureText(ch).width + trackPx;
    }
    return cursor - x;
  };

  /** Split a line into its swash-capital head and its normal-size tail. */
  const split = (line: HeadlineLine) => {
    const n = line.leadChars ?? 0;
    const scale = line.leadScale ?? 1;
    if (n <= 0 || scale === 1) return { lead: "", leadPx: RASTER_FONT_PX, rest: line.text };
    return {
      lead: line.text.slice(0, n),
      leadPx: RASTER_FONT_PX * scale,
      rest: line.text.slice(n),
    };
  };

  // Measure each line (body + optional accent glyph) to size the canvas.
  const lineMetrics = lines.map((line) => {
    const { lead, leadPx, rest } = split(line);
    const track = line.tracking ?? 0;
    ctx.font = fontFor(!!line.italic, leadPx);
    const leadW = widthOf(lead, track * leadPx);
    ctx.font = fontFor(!!line.italic);
    const bodyW = leadW + widthOf(rest, track * RASTER_FONT_PX);
    const accentW = widthOf(line.accent ?? "", track * RASTER_FONT_PX);
    return { lead, leadPx, leadW, rest, bodyW, accentW, totalW: bodyW + accentW };
  });

  const lineHeight = RASTER_FONT_PX * lineGap;
  const rasterW = Math.ceil(Math.max(...lineMetrics.map((m) => m.totalW)) + 40);
  // The swash capital overshoots the em box, so reserve headroom for it.
  const overshoot = Math.max(0, ...lineMetrics.map((m) => m.leadPx - RASTER_FONT_PX));
  const rasterH = Math.ceil(lineHeight * lines.length + RASTER_FONT_PX * 0.4 + overshoot);
  canvas.width = rasterW;
  canvas.height = rasterH;

  // Pass 1: body glyphs in red channel, accent glyphs in green channel, so a
  // single readback distinguishes the two palettes.
  ctx.clearRect(0, 0, rasterW, rasterH);
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, i) => {
    const m = lineMetrics[i];
    const track = line.tracking ?? 0;
    const x = align === "left" ? 0 : (rasterW - m.totalW) / 2;
    const baseline = RASTER_FONT_PX * 0.9 + overshoot + i * lineHeight;
    ctx.fillStyle = "rgb(255,0,0)";
    if (m.lead) {
      ctx.font = fontFor(!!line.italic, m.leadPx);
      drawTracked(m.lead, x, baseline, track * m.leadPx);
    }
    ctx.font = fontFor(!!line.italic);
    drawTracked(m.rest, x + m.leadW, baseline, track * RASTER_FONT_PX);
    if (line.accent) {
      ctx.fillStyle = "rgb(0,255,0)";
      drawTracked(line.accent, x + m.bodyW, baseline, track * RASTER_FONT_PX);
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
