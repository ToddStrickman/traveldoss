import { expect, test, type Page } from "@playwright/test";

/**
 * Visual-regression guard for the SandHero inscription alignment.
 *
 * The sand simulation is stochastic (per-frame noise, tens of thousands of
 * grains), so a pixel-diff snapshot would be permanently flaky. Instead we
 * measure the *distribution* of revealed grains inside the SandHero canvas
 * and assert two structural properties that only hold when the inscription
 * is flush-left inside its container (see textSampler `align: "left"`):
 *
 *   1. The horizontal centroid of the grain mass sits comfortably left of
 *      the container center. A regression to `align: "center"` would push
 *      it back to the middle and fail this assertion.
 *   2. The left half of the container carries substantially more grain
 *      mass than the right half. This catches subtler drifts (e.g. an
 *      accidental padding change) that leave the centroid nominally left
 *      but re-widen the layout.
 *
 * Runs across mobile, tablet, and desktop breakpoints so a regression at
 * any responsive tier is caught.
 */

const VIEWPORTS = [
  { label: "mobile-375", width: 375, height: 812 },
  { label: "mobile-390", width: 390, height: 844 },
  { label: "tablet-768", width: 768, height: 1024 },
  { label: "desktop-1280", width: 1280, height: 900 },
  { label: "wide-1680", width: 1680, height: 1050 },
] as const;

interface GrainStats {
  containerLeft: number;
  containerWidth: number;
  canvasLeft: number;
  canvasWidth: number;
  /** Total opaque grain samples inside the container's horizontal band. */
  total: number;
  /** Mass-weighted centroid X, in *page* CSS pixels. */
  centroidX: number;
  /** Grain mass in the left / right halves of the container. */
  leftHalfMass: number;
  rightHalfMass: number;
}

/**
 * Reads the SandHero canvas backing store, restricts to the container's
 * horizontal band, and returns aggregate grain statistics in page CSS
 * pixels. Runs in the page so we don't have to shuttle imagedata over CDP.
 */
async function readGrainStats(page: Page): Promise<GrainStats> {
  return page.evaluate(() => {
    const container = document.querySelector<HTMLElement>(
      '[role="img"][aria-label="Pick your dossier template."]',
    );
    const canvas = container?.querySelector<HTMLCanvasElement>("canvas");
    if (!container || !canvas) throw new Error("SandHero canvas not found");

    const crect = container.getBoundingClientRect();
    const krect = canvas.getBoundingClientRect();

    // The engine uses WebGL, so `getImageData` on the live canvas fails
    // (no 2D context). Blit into an offscreen 2D canvas at the same pixel
    // resolution to read grain alpha out.
    const off = document.createElement("canvas");
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = off.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(canvas, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, off.width, off.height);

    // Canvas backing pixels → CSS pixels.
    const sx = krect.width / width;
    const sy = krect.height / height;

    // Sample every 4th backing pixel — plenty of resolution, ~16× faster.
    const STEP = 4;
    const ALPHA_THRESHOLD = 24; // ignore near-empty background pixels
    let total = 0;
    let sumX = 0;
    let leftHalfMass = 0;
    let rightHalfMass = 0;
    const cMid = crect.left + crect.width / 2;

    for (let py = 0; py < height; py += STEP) {
      const pageY = krect.top + py * sy;
      // Only count grains vertically overlapping the container's band.
      if (pageY < crect.top || pageY > crect.bottom) continue;
      for (let px = 0; px < width; px += STEP) {
        const a = data[(py * width + px) * 4 + 3];
        if (a < ALPHA_THRESHOLD) continue;
        const pageX = krect.left + px * sx;
        // Only count grains inside the container's horizontal box;
        // engine bleed past the sides is intentional but irrelevant here.
        if (pageX < crect.left || pageX > crect.right) continue;
        const w = a / 255;
        total += w;
        sumX += w * pageX;
        if (pageX < cMid) leftHalfMass += w;
        else rightHalfMass += w;
      }
    }

    return {
      containerLeft: crect.left,
      containerWidth: crect.width,
      canvasLeft: krect.left,
      canvasWidth: krect.width,
      total,
      centroidX: total > 0 ? sumX / total : cMid,
      leftHalfMass,
      rightHalfMass,
    };
  });
}

test.describe("SandHero inscription alignment", () => {
  for (const vp of VIEWPORTS) {
    test(`is flush-left at ${vp.label}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        isMobile: vp.width < 500,
        hasTouch: vp.width < 500,
      });
      const page = await context.newPage();
      await page.goto("/templates", { waitUntil: "networkidle" });
      // Reveal animation is ~2.5s; give the engine time to settle so the
      // inscription is present in the frame we sample.
      await page.waitForTimeout(3200);

      const stats = await readGrainStats(page);

      // Sanity: the inscription is drawn at all.
      expect(stats.total, "sand grains rendered").toBeGreaterThan(500);

      // 1) Centroid sits left of container center.
      //    Left-aligned inscriptions land near ~35–40% of container width;
      //    center-aligned would sit near 50%. Threshold at 44% catches a
      //    regression while tolerating font-metric variance across skins.
      const centroidFrac = (stats.centroidX - stats.containerLeft) / stats.containerWidth;
      expect(
        centroidFrac,
        `centroid should be left of center (got ${centroidFrac.toFixed(3)})`,
      ).toBeLessThan(0.44);

      // 2) Left half of the container carries the bulk of the grain mass.
      //    A center-aligned inscription splits ~50/50; flush-left is ~65/35+.
      const leftFrac = stats.leftHalfMass / (stats.leftHalfMass + stats.rightHalfMass);
      expect(
        leftFrac,
        `left half should dominate grain mass (got ${leftFrac.toFixed(3)})`,
      ).toBeGreaterThan(0.58);

      await context.close();
    });
  }
});
