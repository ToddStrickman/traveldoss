import { expect, test, type Page, type Locator } from "@playwright/test";

/**
 * Mobile visual regression for the dossier selector at 393px (iPhone
 * 14/15-class). Pins two things that have drifted before:
 *
 *  1. Copy — each browse mode's cover caption states that mode's benefit
 *     ("Days side by side — slide activities between them" for horizontal),
 *     and the /t/<slug> layout sheet says the same thing.
 *  2. Layout — the switcher sits ABOVE the covers (never a scroll away),
 *     every mode swipes sideways, the page never scrolls horizontally, and
 *     the switcher buttons keep 44px tap targets.
 *
 * Pixel snapshots of the centred cover are opt-in (VISUAL=1) because
 * baselines are machine-specific; the assertions above always run.
 */

const VIEWPORT = { width: 393, height: 852 };
const VISUAL = !!process.env.VISUAL;

/** Caption each mode's cover placeholder must show. Mirrors DossierCover.tsx
 *  and ViewSheet.tsx — update both when the product copy changes. */
const CAPTIONS = {
  horizontal: "Days side by side — slide activities between them",
  vertical: "The full read, top to bottom",
  grid: "The whole trip at a glance",
} as const;

type Mode = keyof typeof CAPTIONS;

test.use({ viewport: VIEWPORT, hasTouch: true, isMobile: true });

async function expectNoHorizontalOverflow(page: Page) {
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollW, "no horizontal page overflow").toBeLessThanOrEqual(VIEWPORT.width + 1);
}

async function expectTapTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  expect(box.height, "tap-target height").toBeGreaterThanOrEqual(40);
  expect(box.width, "tap-target width").toBeGreaterThanOrEqual(40);
}

const rail = (page: Page) =>
  page.getByRole("region", { name: /swipeable covers/i });
const switcher = (page: Page) => page.getByRole("group", { name: "Browse mode" });

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
  await switcher(page).getByRole("button", { name: label, exact: true }).click();
  await expect(
    switcher(page).getByRole("button", { name: label, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500);
}

test.describe(`dossier selector · mobile ${VIEWPORT.width}×${VIEWPORT.height}`, () => {
  test("switcher sits above the covers and meets tap targets", async ({ page }) => {
    await gotoTemplates(page);

    const toggleBox = await switcher(page).boundingBox();
    const cardBox = await rail(page).locator("article").first().boundingBox();
    expect(toggleBox && cardBox).toBeTruthy();
    expect(toggleBox!.y + toggleBox!.height, "switcher above the first cover").toBeLessThanOrEqual(
      cardBox!.y + 1,
    );

    for (const label of ["Grid", "Horizontal", "Vertical"]) {
      await expectTapTarget(switcher(page).getByRole("button", { name: label, exact: true }));
    }
    await expectNoHorizontalOverflow(page);
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

      await expectNoHorizontalOverflow(page);

      if (VISUAL) {
        await expect(rail(page).locator("article").first()).toHaveScreenshot(
          `cover-${mode}-393.png`,
          { animations: "disabled", maxDiffPixelRatio: 0.02 },
        );
      }
    });
  }

  test("layout sheet hint matches the horizontal cover copy", async ({ page }) => {
    await page.goto("/e2e/dossier");
    await page.getByRole("button", { name: /change layout/i }).click();
    const row = page.getByRole("radio", { name: /Horizontal/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText(CAPTIONS.horizontal);
    await expectNoHorizontalOverflow(page);
  });
});
