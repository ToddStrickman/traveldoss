import { expect, test } from "@playwright/test";

/**
 * FlowScroller mobile scroll-pin behavior.
 *
 * The mobile flow is a scroll-pinned section: the section itself is
 * `STEPS.length × 100svh` tall, and a sticky 100dvh viewport inside swaps
 * step content based on scroll progress. This test verifies that:
 *   1. Each of the five steps snaps into the sticky viewport when the user
 *      scrolls one step-height further down the document.
 *   2. The user cannot scroll past the flow until all five steps are seen —
 *      scrolling by less than the total pin distance keeps step 05 visible
 *      (i.e. the next section has not yet taken over the viewport).
 *   3. The progress rail counter matches the visible step at every stop.
 *
 * Runs at iPhone-class widths in both portrait and landscape.
 */

const KICKERS = [
  "Pick a vessel",
  "Bring the mess",
  "Quiet machinery",
  "Find your way",
  "Arrive well",
] as const;

const VIEWPORTS = [
  { label: "iphone-se portrait", width: 375, height: 667 },
  { label: "iphone-plus portrait", width: 414, height: 896 },
  { label: "iphone-se landscape", width: 667, height: 375 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`FlowScroller mobile · ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("each of the 5 steps snaps into view as the user scrolls", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Reveal the mobile flow section and grab its geometry.
      const section = page.locator('section[aria-label="How TravelDoss works"].md\\:hidden');
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);

      const { sectionTop, sectionHeight, stepPx } = await section.evaluate(
        (el) => {
          const rect = (el as HTMLElement).getBoundingClientRect();
          const top = window.scrollY + rect.top;
          const h = (el as HTMLElement).offsetHeight;
          // Section is STEPS.length step-units tall; one step-unit is h/5.
          return { sectionTop: top, sectionHeight: h, stepPx: h / 5 };
        },
      );

      expect(sectionHeight).toBeGreaterThan(vp.height * 4); // 5 × step-unit

      // Walk each step: land the document scroll ~mid-way through that
      // step's slice of the pin distance, and confirm the correct kicker
      // and counter are showing inside the sticky viewport.
      for (let i = 0; i < KICKERS.length; i++) {
        const target = sectionTop + stepPx * (i + 0.5);
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }), target);
        // Framer's `useScroll` fires on rAF; give it two frames to settle.
        await page.waitForTimeout(120);

        // Kicker for the active step must be visible in the sticky viewport.
        const kicker = section.getByText(KICKERS[i], { exact: true });
        await expect(kicker, `step ${i + 1} kicker visible`).toBeVisible();

        // The progress counter should read `${i+1} / 05`.
        const counter = section
          .locator("span")
          .filter({ hasText: new RegExp(`^${String(i + 1).padStart(2, "0")}$`) })
          .first();
        await expect(counter).toBeVisible();

        // The kicker element must actually sit inside the visible viewport,
        // not above/below it — this is the "snap into view" invariant.
        const box = await kicker.boundingBox();
        expect(box, `step ${i + 1} kicker has box`).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(-4);
        expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 4);
      }
    });

    test("user cannot pass the flow until all steps have been scrolled", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const section = page.locator('section[aria-label="How TravelDoss works"].md\\:hidden');
      await section.scrollIntoViewIfNeeded();

      const { sectionTop, sectionHeight } = await section.evaluate((el) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        return {
          sectionTop: window.scrollY + rect.top,
          sectionHeight: (el as HTMLElement).offsetHeight,
        };
      });

      // Halfway through the pin distance: we should still be seeing a middle
      // step (03), not something below the section.
      await page.evaluate(
        (y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }),
        sectionTop + sectionHeight * 0.5,
      );
      await page.waitForTimeout(150);
      await expect(section.getByText("Quiet machinery", { exact: true })).toBeVisible();

      // The bottom of the section must still be well below the fold — proving
      // the user has not "escaped" the flow yet.
      const bottomOffscreen = await section.evaluate((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return r.bottom - window.innerHeight;
      });
      expect(bottomOffscreen, "section bottom is still below viewport").toBeGreaterThan(0);

      // Only after fully scrolling the pin distance should step 05 lock in.
      await page.evaluate(
        (y) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }),
        sectionTop + sectionHeight - 1,
      );
      await page.waitForTimeout(150);
      await expect(section.getByText("Arrive well", { exact: true })).toBeVisible();
    });
  });
}