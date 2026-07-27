import { devices, expect, test, type Page, type Locator } from "@playwright/test";

/**
 * FlowScroller mobile scroll-pin behavior (current landing).
 *
 * The mobile flow is a scroll-pinned section: `STEPS.length ×
 * var(--tds-flow-step)` tall (100svh portrait, 80svh landscape — see
 * styles.css), holding a sticky viewport that swaps step content by
 * scroll progress. Two things older specs got wrong, kept right here:
 *
 *  1. The section is LAZY-MOUNTED (InViewLazy): it does not exist in the
 *     DOM until the user scrolls near it, so the spec walks the page a
 *     viewport at a time until the section appears.
 *  2. Motion's useScroll(["start start","end end"]) maps progress over
 *     the PIN DISTANCE — section height minus one viewport — not the full
 *     height. Step targets are computed against that distance.
 */

const KICKERS = [
  "Pick a vessel",
  "Bring the mess",
  "Quiet machinery",
  "Find your way",
  "Arrive well",
] as const;

/**
 * iPhone-shaped WebKit emulations. We use Playwright's device presets so
 * every run inherits the real iOS Safari UA, DPR, touch flags, and mobile
 * viewport meta handling — not just a resized Chromium window. Landscape
 * is covered via the `.landscape` presets Playwright ships alongside each
 * portrait device.
 */
const DEVICE_PRESETS = [
  "iPhone SE",
  "iPhone 13",
  "iPhone 14 Pro Max",
  "iPhone SE landscape",
  "iPhone 13 landscape",
] as const;

const EMULATIONS = DEVICE_PRESETS.map((name) => {
  const preset = devices[name];
  if (!preset) throw new Error(`Playwright device preset missing: ${name}`);
  return { label: name, preset } as const;
});

const SECTION = 'section.tds-flow-mobile[aria-label="How TravelDoss works"]';

/** Scroll the document a viewport at a time until a lazily-mounted
 *  element exists, then bring it into view. */
async function scrollUntilMounted(page: Page, locator: Locator, maxScreens = 40) {
  for (let i = 0; i < maxScreens; i++) {
    if ((await locator.count()) > 0) {
      await locator.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      return;
    }
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9));
    await page.waitForTimeout(250);
  }
  throw new Error("lazy section never mounted while walking the page");
}

async function flowGeometry(page: Page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    const rect = el.getBoundingClientRect();
    return {
      sectionTop: window.scrollY + rect.top,
      sectionHeight: el.offsetHeight,
      vh: window.innerHeight,
    };
  }, SECTION);
}

for (const { label, preset } of EMULATIONS) {
  test.describe(`FlowScroller mobile · ${label}`, () => {
    // Full device emulation: UA, DPR, touch/hasTouch, isMobile, viewport.
    // Forces the WebKit browser so we exercise iOS Safari, not Chromium.
    test.use({ ...preset, browserName: "webkit" });

    test("each of the 5 steps snaps into view as the user scrolls", async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("main", { timeout: 15000 });

      const section = page.locator(SECTION);
      await scrollUntilMounted(page, section);

      const { sectionTop, sectionHeight, vh } = await flowGeometry(page);
      // 100svh steps portrait, 80svh landscape — either way the section
      // spans several viewports so the pin is real.
      expect(sectionHeight).toBeGreaterThanOrEqual(vh * 3);

      const pin = sectionHeight - vh;
      expect(pin).toBeGreaterThan(0);

      for (let i = 0; i < KICKERS.length; i++) {
        // Land mid-bucket: progress = (i + 0.5) / 5 of the PIN distance.
        const target = sectionTop + (pin * (i + 0.5)) / KICKERS.length;
        await page.evaluate(
          (y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }),
          target,
        );
        // Motion's useScroll fires on rAF; give it a few frames to settle.
        await page.waitForTimeout(180);

        const kicker = section.getByText(KICKERS[i], { exact: true });
        await expect(kicker, `step ${i + 1} kicker visible`).toBeVisible();

        // Progress pill reads the padded step number.
        const counter = section
          .locator("span")
          .filter({ hasText: new RegExp(`^${String(i + 1).padStart(2, "0")}$`) })
          .first();
        await expect(counter, `step ${i + 1} counter`).toBeVisible();

        // The kicker sits inside the visible viewport — the "snapped in"
        // invariant.
        const box = await kicker.boundingBox();
        expect(box, `step ${i + 1} kicker has box`).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(-4);
        expect(box!.y + box!.height).toBeLessThanOrEqual(vh + 4);
      }

      // Viewport-overflow guard — the flow must never push the page wider.
      const { scrollW, innerW } = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
      }));
      expect(scrollW, "no horizontal overflow").toBeLessThanOrEqual(innerW + 1);
    });

    test("user cannot pass the flow until all steps have been scrolled", async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("main", { timeout: 15000 });

      const section = page.locator(SECTION);
      await scrollUntilMounted(page, section);

      const { sectionTop, sectionHeight, vh } = await flowGeometry(page);
      const pin = sectionHeight - vh;

      // Halfway through the pin: progress 0.5 → bucket 3 ("Quiet machinery").
      await page.evaluate(
        (y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }),
        sectionTop + pin * 0.5,
      );
      await page.waitForTimeout(180);
      await expect(section.getByText("Quiet machinery", { exact: true })).toBeVisible();

      // The section bottom is still below the fold — the user has not
      // escaped the flow.
      const bottomOffscreen = await page.evaluate((sel) => {
        const r = (document.querySelector(sel) as HTMLElement).getBoundingClientRect();
        return r.bottom - window.innerHeight;
      }, SECTION);
      expect(bottomOffscreen, "section bottom still below viewport").toBeGreaterThan(0);

      // Only at the end of the pin distance does step 05 lock in.
      await page.evaluate(
        (y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }),
        sectionTop + pin - 1,
      );
      await page.waitForTimeout(180);
      await expect(section.getByText("Arrive well", { exact: true })).toBeVisible();
    });
  });
}
