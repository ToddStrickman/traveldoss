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

interface CanvasBox {
  containerLeft: number;
  containerWidth: number;
  canvasLeft: number;
  canvasTop: number;
  canvasWidth: number;
  canvasHeight: number;
  /** DPR-scaled backing dimensions of the on-page canvas. */
  backingWidth: number;
  backingHeight: number;
}

interface GrainStats {
  /** Total opaque grain samples inside the container's horizontal band. */
  total: number;
  /** Mass-weighted centroid X, in *page* CSS pixels. */
  centroidX: number;
  /** Grain mass in the left / right halves of the container. */
  leftHalfMass: number;
  rightHalfMass: number;
}

/**
 * Locates the SandHero container + canvas and returns their geometry.
 * We can't `drawImage` a WebGL canvas back into a 2D context (the WebGL
 * backbuffer is cleared after compositing), so alignment sampling uses an
 * element screenshot decoded via `createImageBitmap` in `readGrainStats`.
 */
async function readGeometry(page: Page): Promise<CanvasBox> {
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
      backingWidth: canvas.width,
      backingHeight: canvas.height,
    };
  });
}

/**
 * Screenshots the SandHero canvas element and decodes it back inside the
 * page (via `createImageBitmap`) so we can read grain alpha out. This works
 * regardless of WebGL `preserveDrawingBuffer` — the screenshot is the
 * composited output, and the decode happens on a plain 2D canvas.
 */
async function readGrainStats(page: Page, box: CanvasBox): Promise<GrainStats> {
  const canvasHandle = await page.locator(
    '[role="img"][aria-label="Pick your dossier template."] canvas',
  );
  const png = await canvasHandle.screenshot({ omitBackground: true });
  const b64 = png.toString("base64");

  return page.evaluate(
    async ({ b64, box }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bin], { type: "image/png" }));
      const off = document.createElement("canvas");
      off.width = bmp.width;
      off.height = bmp.height;
      const ctx = off.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, off.width, off.height);

      // Screenshot pixels → page CSS pixels.
      const sx = box.canvasWidth / width;
      const sy = box.canvasHeight / height;

      const STEP = 4;
      const ALPHA_THRESHOLD = 24;
      let total = 0;
      let sumX = 0;
      let leftHalfMass = 0;
      let rightHalfMass = 0;
      const cMid = box.containerLeft + box.containerWidth / 2;

      for (let py = 0; py < height; py += STEP) {
        const pageY = box.canvasTop + py * sy;
        for (let px = 0; px < width; px += STEP) {
          const a = data[(py * width + px) * 4 + 3];
          if (a < ALPHA_THRESHOLD) continue;
          const pageX = box.canvasLeft + px * sx;
          // Restrict to the container's horizontal band; the canvas
          // bleeds past both sides on purpose and we want the inscription,
          // not the drift.
          if (pageX < box.containerLeft || pageX > box.containerLeft + box.containerWidth) continue;
          void pageY;
          const w = a / 255;
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
    { b64, box },
  );
}
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

      const box = await readGeometry(page);
      const stats = await readGrainStats(page, box);

      // Sanity: the inscription is drawn at all.
      expect(stats.total, "sand grains rendered").toBeGreaterThan(500);

      // 1) Centroid sits left of container center.
      //    Left-aligned inscriptions land near ~35–40% of container width;
      //    center-aligned would sit near 50%. Threshold at 44% catches a
      //    regression while tolerating font-metric variance across skins.
      const centroidFrac = (stats.centroidX - box.containerLeft) / box.containerWidth;
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
