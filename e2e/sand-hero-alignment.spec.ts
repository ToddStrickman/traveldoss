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
 *      the centroid back toward the middle and fail this assertion.
 *   2. The left half of the container carries substantially more grain
 *      mass than the right half. This catches subtler drifts (e.g. an
 *      accidental padding change) that leave the centroid nominally left
 *      but re-widen the layout.
 *
 * We can't read the WebGL canvas directly (backbuffer is cleared after
 * compositing) and `elementHandle.screenshot()` returns a transparent PNG
 * for the same reason. Instead we take a *page* screenshot clipped to the
 * canvas rect — that captures the composited output — then decode it
 * inside the page via `createImageBitmap` and score pixels by warmth
 * (grains are gold/beige, background is dark navy).
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

interface Geometry {
  containerLeft: number;
  containerWidth: number;
  canvasLeft: number;
  canvasTop: number;
  canvasWidth: number;
  canvasHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

interface GrainStats {
  /** Total warm-pixel mass counted inside the container's horizontal band. */
  total: number;
  /** Mass-weighted centroid X, in *page* CSS pixels. */
  centroidX: number;
  leftHalfMass: number;
  rightHalfMass: number;
}

async function readGeometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const container = document.querySelector<HTMLElement>(
      '[role="img"][aria-label="Pick your dossier template."]',
    );
    const canvas = container?.querySelector<HTMLCanvasElement>("canvas");
    if (!container || !canvas) throw new Error("SandHero canvas not found");
    const crect = container.getBoundingClientRect();
    const krect = canvas.getBoundingClientRect();
    return {
      containerLeft: crect.left,
      containerWidth: crect.width,
      canvasLeft: krect.left,
      canvasTop: krect.top,
      canvasWidth: krect.width,
      canvasHeight: krect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
}

async function readGrainStats(page: Page, g: Geometry): Promise<GrainStats> {
  // Clip to the intersection of the canvas rect and the viewport — the
  // canvas bleeds past both sides on purpose, and page.screenshot rejects
  // out-of-viewport clips.
  const clipX = Math.max(0, g.canvasLeft);
  const clipY = Math.max(0, g.canvasTop);
  const clipW = Math.min(g.viewportWidth - clipX, g.canvasLeft + g.canvasWidth - clipX);
  const clipH = Math.min(g.viewportHeight - clipY, g.canvasTop + g.canvasHeight - clipY);
  if (clipW <= 0 || clipH <= 0) throw new Error("canvas not intersecting viewport");

  const png = await page.screenshot({
    clip: { x: clipX, y: clipY, width: clipW, height: clipH },
  });
  const b64 = png.toString("base64");

  return page.evaluate(
    async ({ b64, clip, containerLeft, containerWidth }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bin], { type: "image/png" }));
      const off = document.createElement("canvas");
      off.width = bmp.width;
      off.height = bmp.height;
      const ctx = off.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(bmp, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, off.width, off.height);

      // Screenshot pixels → page CSS pixels (the screenshot is DPR-scaled).
      const sx = clip.width / width;

      const STEP = 3;
      let total = 0;
      let sumX = 0;
      let leftHalfMass = 0;
      let rightHalfMass = 0;
      const cMid = containerLeft + containerWidth / 2;
      const cRight = containerLeft + containerWidth;

      // Sand palette is warm (r,g high, b low). Background is cool navy
      // (b highest). Warmth = (r+g)/2 - b picks out grains cleanly across
      // the reveal — grain interior peaks ~90+, background hovers < 0.
      for (let py = 0; py < height; py += STEP) {
        for (let px = 0; px < width; px += STEP) {
          const i = (py * width + px) * 4;
          const r = data[i];
          const gCh = data[i + 1];
          const b = data[i + 2];
          const warm = (r + gCh) / 2 - b;
          if (warm < 25 || r < 90) continue;
          const pageX = clip.x + px * sx;
          if (pageX < containerLeft || pageX > cRight) continue;
          const w = Math.min(1, warm / 100);
          total += w;
          sumX += w * pageX;
          if (pageX < cMid) leftHalfMass += w;
          else rightHalfMass += w;
        }
      }

      return {
        total,
        centroidX: total > 0 ? sumX / total : cMid,
        leftHalfMass,
        rightHalfMass,
      };
    },
    { b64, clip: { x: clipX, y: clipY, width: clipW, height: clipH }, containerLeft: g.containerLeft, containerWidth: g.containerWidth },
  );
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
      // Reveal animation is ~2.5s but larger viewports take longer to fully
      // stipple the inscription. Poll for enough grain mass instead of
      // hard-sleeping, so slow CI machines and big canvases don't flake.
      const geom = await readGeometry(page);
      let stats: Awaited<ReturnType<typeof readGrainStats>> = {
        total: 0, centroidX: 0, leftHalfMass: 0, rightHalfMass: 0,
      };
      const deadline = Date.now() + 12_000;
      while (Date.now() < deadline) {
        await page.waitForTimeout(600);
        stats = await readGrainStats(page, geom);
        if (stats.total > 300) break;
      }

      // Sanity: the inscription is drawn at all.
      expect(stats.total, "sand grains rendered").toBeGreaterThan(300);

      // 1) Centroid sits left of container center. Flush-left inscriptions
      //    land near ~30–40% of container width; center-aligned regresses
      //    to ~50%. Threshold tolerates skin-to-skin font-metric variance.
      const centroidFrac = (stats.centroidX - geom.containerLeft) / geom.containerWidth;
      expect(
        centroidFrac,
        `centroid should be left of center (got ${centroidFrac.toFixed(3)})`,
      ).toBeLessThan(0.44);

      // 2) Left half of the container carries the bulk of the grain mass.
      //    Center-aligned splits ~50/50; flush-left is typically ≥65/35.
      const leftFrac = stats.leftHalfMass / (stats.leftHalfMass + stats.rightHalfMass);
      expect(
        leftFrac,
        `left half should dominate grain mass (got ${leftFrac.toFixed(3)})`,
      ).toBeGreaterThan(0.58);

      await context.close();
    });
  }
});
