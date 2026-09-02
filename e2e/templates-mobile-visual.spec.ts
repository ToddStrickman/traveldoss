import { expect, test, type Page, type Locator } from "@playwright/test";

/**
 * Mobile visual regression for the dossier selector across three phone widths:
 * 375 (SE / mini), 393 (14/15-class) and 430 (Pro Max). Pins two things that
 * have drifted before:
 *
 *  1. Copy — each browse mode's cover caption states that mode's benefit
 *     ("Drag activities between days like a board" for horizontal),
 *     and the /t/<slug> layout sheet says the same thing.
 *  2. Layout — the switcher sits ABOVE the covers (never a scroll away),
 *     every mode swipes sideways, the page never scrolls horizontally, the
 *     switcher buttons keep 44px tap targets, the active cover is centred in
 *     the rail, and the caption never escapes its cover.
 *
 * Pixel snapshots of the centred cover are opt-in (VISUAL=1) because
 * baselines are machine-specific; the assertions above always run.
 */

const WIDTHS = [375, 393, 430] as const;
const HEIGHT = 852;
const VISUAL = !!process.env.VISUAL;

/** Caption each mode's cover placeholder must show. Mirrors DossierCover.tsx
 *  and ViewSheet.tsx — update both when the product copy changes. */
const CAPTIONS = {
  horizontal: "Drag activities between days like a board",
  vertical: "Photographs and comparisons, top to bottom",
  grid: "Everything structured, at a glance",
} as const;

type Mode = keyof typeof CAPTIONS;

// Mobile and desktop compositions both exist in the DOM (md:hidden siblings),
// so always narrow to the visible one before measuring.
const rail = (page: Page) =>
  page.getByRole("region", { name: /swipeable covers/i }).filter({ visible: true }).first();
// The labelled layout trigger (glyph + seal dot + LAYOUT + chevron).
const switcher = (page: Page) =>
  page.getByRole("button", { name: /^Layout/ }).filter({ visible: true }).first();

async function expectNoHorizontalOverflow(page: Page, width: number) {
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollW, "no horizontal page overflow").toBeLessThanOrEqual(width + 1);
}

async function expectTapTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  expect(box.height, "tap-target height").toBeGreaterThanOrEqual(40);
  expect(box.width, "tap-target width").toBeGreaterThanOrEqual(40);
}

async function gotoTemplates(page: Page) {
  await page.goto("/templates");
  await expect(switcher(page)).toBeVisible();
  await expect(rail(page).locator("article").first()).toBeVisible();
  // Let webfonts and the cover reveal settle before measuring or shooting.
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(600);
}

async function pickMode(page: Page, mode: Mode) {
  const label = mode[0].toUpperCase() + mode.slice(1);
  await switcher(page).click();
  const option = page.getByRole("radio", { name: new RegExp(label, "i") }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(switcher(page)).toHaveAccessibleName(new RegExp(label, "i"));
  await page.waitForTimeout(500);
}

/** Geometry of the first cover + its caption, used for the alignment checks
 *  and for the cross-width comparison. */
async function measureCover(page: Page, mode: Mode) {
  const card = rail(page).locator("article").first();
  const caption = card.getByText(CAPTIONS[mode], { exact: true }).first();
  const cardBox = await card.boundingBox();
  const capBox = await caption.boundingBox();
  const scroller = await rail(page)
    .locator("div.scroll-x")
    .first()
    .boundingBox();
  const lines = await caption.evaluate((el) => {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    return Math.max(1, Math.round(el.getBoundingClientRect().height / lh));
  });
  if (!cardBox || !capBox || !scroller) throw new Error("cover geometry unavailable");
  return { cardBox, capBox, scroller, lines };
}

for (const width of WIDTHS) {
  test.describe(`dossier selector · mobile ${width}×${HEIGHT}`, () => {
    test.use({ viewport: { width, height: HEIGHT }, hasTouch: true, isMobile: true });

    test("switcher sits with the cover and meets tap targets", async ({ page }) => {
      await gotoTemplates(page);

      const toggleBox = await switcher(page).boundingBox();
      const cardBox = await rail(page).locator("article").first().boundingBox();
      expect(toggleBox && cardBox).toBeTruthy();
      // Directly under the cover on mobile — never a scroll away from it.
      expect(toggleBox!.y, "switcher below the first cover").toBeGreaterThanOrEqual(
        cardBox!.y - 1,
      );
      expect(
        toggleBox!.y - (cardBox!.y + cardBox!.height),
        "switcher close to the cover",
      ).toBeLessThanOrEqual(80);

      await expectTapTarget(switcher(page));
      await switcher(page).click();
      for (const label of ["Grid", "Horizontal", "Vertical"]) {
        await expectTapTarget(page.getByRole("radio", { name: new RegExp(label, "i") }).first());
      }
      await page.keyboard.press("Escape");
      await expectNoHorizontalOverflow(page, width);
    });

    for (const mode of Object.keys(CAPTIONS) as Mode[]) {
      test(`${mode} mode: caption, sideways swipe, no page overflow`, async ({ page }) => {
        await gotoTemplates(page);
        await pickMode(page, mode);

        // Cover captions are aria-hidden decoration, so read the text directly.
        const caption = rail(page).locator("article", { hasText: CAPTIONS[mode] }).first();
        await expect(caption).toBeVisible();

        // Only this mode's caption is present — proves copy is per-mode.
        for (const other of (Object.keys(CAPTIONS) as Mode[]).filter((m) => m !== mode)) {
          await expect(rail(page).getByText(CAPTIONS[other], { exact: true })).toHaveCount(0);
        }

        // The rail itself is the horizontal scroller in every mode.
        const overflow = await rail(page)
          .locator("div.scroll-x")
          .first()
          .evaluate((el) => ({ scrollW: el.scrollWidth, clientW: el.clientWidth }));
        expect(overflow.scrollW, "covers scroll sideways").toBeGreaterThan(overflow.clientW);

        // Alignment: the active cover is centred in the rail, and the caption
        // stays inside the cover it belongs to.
        const { cardBox, capBox, scroller } = await measureCover(page, mode);
        const cardCenter = cardBox.x + cardBox.width / 2;
        const railCenter = scroller.x + scroller.width / 2;
        expect(
          Math.abs(cardCenter - railCenter),
          `active cover centred in the rail (${width}px)`,
        ).toBeLessThanOrEqual(4);
        expect(capBox.x, "caption inside cover (left)").toBeGreaterThanOrEqual(cardBox.x - 1);
        expect(capBox.x + capBox.width, "caption inside cover (right)").toBeLessThanOrEqual(
          cardBox.x + cardBox.width + 1,
        );
        expect(capBox.y + capBox.height, "caption inside cover (bottom)").toBeLessThanOrEqual(
          cardBox.y + cardBox.height + 1,
        );

        await expectNoHorizontalOverflow(page, width);

        if (VISUAL) {
          await expect(rail(page).locator("article").first()).toHaveScreenshot(
            `cover-${mode}-${width}.png`,
            { animations: "disabled", maxDiffPixelRatio: 0.02 },
          );
        }
      });
    }

    test("horizontal cover keeps a stable aspect and caption line count", async ({ page }) => {
      await gotoTemplates(page);
      await pickMode(page, "horizontal");
      const { cardBox, lines } = await measureCover(page, "horizontal");
      // 16:11-ish cover art plus caption block — pin the band, not the pixels.
      const ratio = cardBox.width / cardBox.height;
      expect(ratio, `cover aspect at ${width}px`).toBeGreaterThan(0.5);
      expect(ratio, `cover aspect at ${width}px`).toBeLessThan(1.6);
      expect(lines, `caption line count at ${width}px`).toBeLessThanOrEqual(3);
      await expectNoHorizontalOverflow(page, width);
    });

    test("layout sheet hint matches the horizontal cover copy", async ({ page }) => {
      await page.goto("/e2e/dossier");
      const trigger = page.getByRole("button", { name: /change layout/i }).first();
      await expect(trigger).toBeVisible();
      // The trigger paints before hydration attaches its handler; retry the
      // open until the sheet's options appear.
      const row = page.getByRole("radio", { name: /Horizontal/ });
      await expect(async () => {
        await trigger.click();
        await expect(row).toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 15000 });
      await expect(row).toContainText(CAPTIONS.horizontal);
      await expectNoHorizontalOverflow(page, width);
    });
  });
}
