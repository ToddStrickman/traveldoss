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
  // browserName/defaultBrowserType can't be set inside a describe group
  // (Playwright forces a new worker), so we strip them and run this spec
  // under the `webkit` project instead: `--project=webkit`.
  const { defaultBrowserType: _d, ...rest } = preset;
  return { label: name, preset: rest } as const;
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
    // Browser engine comes from the `webkit` project (iOS Safari).
    test.use({ ...preset });

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

    test("horizontal swipes land exactly on each step", async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("main", { timeout: 15000 });

      const section = page.locator(SECTION);
      await scrollUntilMounted(page, section);

      const { sectionTop, sectionHeight, vh } = await flowGeometry(page);
      const pin = sectionHeight - vh;

      // Start parked on step 01.
      await page.evaluate(
        (y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }),
        sectionTop + pin * 0.05,
      );
      await page.waitForTimeout(200);

      /**
       * iOS Safari swipe. Real Touch objects aren't constructible in WebKit,
       * so we dispatch native-named touch events with the two fields the
       * handler reads (clientX/clientY) — exercising the same code path a
       * finger flick takes.
       */
      const swipe = async (dx: number) => {
        await page.evaluate(
          ({ sel, dx }) => {
            const sticky = document.querySelector(`${sel} div.sticky`) as HTMLElement;
            const r = sticky.getBoundingClientRect();
            const y = r.top + r.height / 2;
            const x = r.left + r.width / 2;
            const fire = (type: string, key: "touches" | "changedTouches", cx: number) => {
              const ev = new Event(type, { bubbles: true, cancelable: true });
              Object.defineProperty(ev, key, { value: [{ clientX: cx, clientY: y }] });
              sticky.dispatchEvent(ev);
            };
            fire("touchstart", "touches", x);
            fire("touchend", "changedTouches", x + dx);
          },
          { sel: SECTION, dx },
        );
        // smooth scrollTo + spring settle
        await page.waitForTimeout(900);
      };

      // Forward through every step: each swipe must land the NEXT kicker in
      // view and park the ribbon on an exact panel boundary.
      for (let i = 1; i < KICKERS.length; i++) {
        await swipe(-120);
        await expect(
          section.getByText(KICKERS[i], { exact: true }),
          `swipe → step ${i + 1}`,
        ).toBeVisible();

        const off = await page.evaluate((sel) => {
          const track = document.querySelector(
            `${sel} div.sticky [style*="translateX"], ${sel} div.sticky .flex.h-full`,
          ) as HTMLElement;
          const m = new DOMMatrixReadOnly(getComputedStyle(track).transform);
          return { x: m.m41, w: track.getBoundingClientRect().width };
        }, SECTION);

        // Panel pitch = track width / 5. The rest position must be an exact
        // multiple of it (±6px of spring residue), never between two steps.
        const pitch = off.w / KICKERS.length;
        const stepsMoved = Math.abs(off.x) / pitch;
        expect(
          Math.abs(stepsMoved - Math.round(stepsMoved)) * pitch,
          `step ${i + 1} rests on a panel boundary`,
        ).toBeLessThan(6);
        expect(Math.round(stepsMoved), `step ${i + 1} panel index`).toBe(i);
      }

      // And back: a rightward flick rewinds one step, also landing clean.
      await swipe(120);
      await expect(
        section.getByText(KICKERS[KICKERS.length - 2], { exact: true }),
      ).toBeVisible();
    });
  });
}
