import { expect, test, type Page } from "@playwright/test";

/**
 * Mobile five-step walkthrough ("The Flow") at 393x852 (iPhone 14/15-class).
 *
 * Pins two things:
 *
 *  1. Centering — after each step settles (swipe OR prev/next control), the
 *     active panel's centre sits on the viewport centre within a few px.
 *  2. Neighbour bleed — panels are narrower than the viewport, so a sliver of
 *     the adjoining step is visible: both sides on steps 02-04, right only on
 *     step 01, left only on step 05. That bleed is the cue that entices the
 *     user through the walkthrough, so it is asserted, not assumed.
 *
 * Pixel snapshots are opt-in (VISUAL=1) because baselines are machine-specific.
 */

const VIEWPORT = { width: 393, height: 852 };
const VISUAL = !!process.env.VISUAL;
const TOTAL = 5;
/** Mirrors PANEL_PCT in FlowScroller.tsx. */
const PANEL_PCT = 82;
const CENTER_TOLERANCE = 3;
/** Expected visible sliver of each neighbour, in px, with slack for the
 *  scale-back transform on inactive panels. */
const BLEED_MIN = 6;
const BLEED_MAX = ((100 - PANEL_PCT) / 2 / 100) * VIEWPORT.width + 4;

type Box = { x: number; width: number };

async function boxes(page: Page): Promise<Box[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-flow-panel]")).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, width: r.width };
    }),
  );
}

async function activeIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("[data-flow-panel]"));
    return els.findIndex(
      (el) => el.getAttribute("data-flow-panel-active") === "true",
    );
  });
}

/** Enter the flow section and settle on step 01. The landing page mounts
 *  sections lazily on scroll, so walk down the page until the flow attaches. */
async function enterFlow(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => !!document.querySelector("section.tds-flow-mobile")))
      break;
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.6));
    await page.waitForTimeout(300);
  }
  await expect(page.locator("section.tds-flow-mobile")).toHaveCount(1);
  // The pinned section rests each step at its progress-bucket centre; the
  // first bucket centre is half a step-height into the pin distance.
  await goToBucket(page, 0);
  await settle(page);
  await expect(page.locator("[data-flow-panel]")).toHaveCount(TOTAL);
}

/** Scroll straight to a step's rest position (bucket centre). */
async function goToBucket(page: Page, i: number) {
  await page.evaluate((step) => {
    const el = document.querySelector("section.tds-flow-mobile") as HTMLElement;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const pin = Math.max(1, el.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + (pin * (step + 0.5)) / 5, behavior: "auto" });
  }, i);
}


async function settle(page: Page) {
  await page.waitForTimeout(1200);
}

/** A real horizontal touch flick across the sticky pane. */
async function swipe(page: Page, direction: "next" | "prev") {
  const pane = page.locator("section.tds-flow-mobile > div.sticky");
  const box = await pane.boundingBox();
  if (!box) throw new Error("sticky pane not found");
  const y = box.y + box.height * 0.5;
  const from = direction === "next" ? box.x + box.width * 0.8 : box.x + box.width * 0.2;
  const to = direction === "next" ? box.x + box.width * 0.2 : box.x + box.width * 0.8;
  const client = await page.context().newCDPSession(page).catch(() => null);
  if (client) {
    const touch = (type: string, x: number) =>
      client.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y }],
      });
    await touch("touchStart", from);
    await touch("touchMove", (from + to) / 2);
    await touch("touchMove", to);
    await touch("touchEnd", to);
  } else {
    // WebKit: no CDP — synthesize the same TouchEvents the component listens to.
    await page.evaluate(
      ({ from, to, y }) => {
        const pane = document.querySelector(
          "section.tds-flow-mobile > div.sticky",
        ) as HTMLElement;
        const point = (x: number) =>
          ({ clientX: x, clientY: y, identifier: 0, target: pane }) as never;
        const fire = (type: string, x: number) =>
          pane.dispatchEvent(
            new TouchEvent(type, {
              bubbles: true,
              touches: type === "touchend" ? [] : [point(x)],
              changedTouches: [point(x)],
            }),
          );
        fire("touchstart", from);
        fire("touchend", to);
      },
      { from, to, y },
    );
  }
  await settle(page);
}

function assertCentered(all: Box[], index: number) {
  const panel = all[index];
  const center = panel.x + panel.width / 2;
  expect(
    Math.abs(center - VIEWPORT.width / 2),
    `step ${index + 1} centre off by ${(center - VIEWPORT.width / 2).toFixed(2)}px`,
  ).toBeLessThanOrEqual(CENTER_TOLERANCE);
  // Panel is genuinely narrower than the viewport — that's what creates bleed.
  expect(panel.width).toBeLessThan(VIEWPORT.width - 8);
  expect(panel.width).toBeGreaterThan(VIEWPORT.width * 0.7);
}

function assertBleed(all: Box[], index: number) {
  const left = index > 0 ? all[index - 1] : null;
  const right = index < TOTAL - 1 ? all[index + 1] : null;
  if (left) {
    const visible = left.x + left.width; // right edge of the previous panel
    expect(visible, `step ${index + 1}: left neighbour should bleed`).toBeGreaterThan(
      BLEED_MIN,
    );
    expect(visible).toBeLessThanOrEqual(BLEED_MAX);
  }
  if (right) {
    const visible = VIEWPORT.width - right.x;
    expect(visible, `step ${index + 1}: right neighbour should bleed`).toBeGreaterThan(
      BLEED_MIN,
    );
    expect(visible).toBeLessThanOrEqual(BLEED_MAX);
  }
  if (index === 0) expect(all[0].x).toBeGreaterThan(0);
  if (index === TOTAL - 1)
    expect(all[TOTAL - 1].x + all[TOTAL - 1].width).toBeLessThan(VIEWPORT.width);
}

test.use({ viewport: VIEWPORT, hasTouch: true, isMobile: true });

test.describe("mobile flow walkthrough @393px", () => {
  test("swiping forward keeps every active step centred with neighbour bleed", async ({
    page,
  }) => {
    await enterFlow(page);

    for (let i = 0; i < TOTAL; i++) {
      const idx = await activeIndex(page);
      expect(idx, `expected to be on step ${i + 1}`).toBe(i);
      const all = await boxes(page);
      assertCentered(all, i);
      assertBleed(all, i);

      // Counter and progress rail track the centred panel.
      await expect(page.getByText(`/ 0${TOTAL}`, { exact: false })).toBeVisible();

      if (VISUAL) {
        await expect(page.locator("section.tds-flow-mobile")).toHaveScreenshot(
          `flow-step-0${i + 1}-393.png`,
          { maxDiffPixelRatio: 0.02 },
        );
      }

      if (i < TOTAL - 1) await swipe(page, "next");
    }
  });

  test("prev/next controls land each step dead centre", async ({ page }) => {
    await enterFlow(page);
    const next = page.getByRole("button", { name: "Next step" });
    const prev = page.getByRole("button", { name: "Previous step" });

    for (let i = 1; i < TOTAL; i++) {
      await next.click();
      await settle(page);
      expect(await activeIndex(page)).toBe(i);
      assertCentered(await boxes(page), i);
      assertBleed(await boxes(page), i);
    }
    for (let i = TOTAL - 2; i >= 0; i--) {
      await prev.click();
      await settle(page);
      expect(await activeIndex(page)).toBe(i);
      assertCentered(await boxes(page), i);
      assertBleed(await boxes(page), i);
    }
  });

  test("walkthrough never introduces horizontal page scroll", async ({ page }) => {
    await enterFlow(page);
    for (let i = 0; i < TOTAL - 1; i++) {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      await swipe(page, "next");
    }
  });
});
