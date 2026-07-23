import { test, expect } from "@playwright/test";

/**
 * Route-line top scrollbar (doc item 6): when the horizontal board
 * overflows, a dotted-route scrollbar with a paper-plane thumb renders
 * ABOVE the board; it tracks native scroll and drives it (track click,
 * thumb drag, arrow keys). Uses the /e2e/dossier harness (DEV only).
 */

test.describe("top scrollbar · horizontal board", () => {
  test.use({ viewport: { width: 620, height: 800 } });

  test("appears on overflow, syncs both ways", async ({ page }) => {
    await page.goto("/e2e/dossier?view=horizontal");
    const board = page.locator(".tds-board");
    await expect(board).toBeVisible();

    const overflow = await board.evaluate((el) => el.scrollWidth - el.clientWidth);
    test.skip(overflow <= 4, "board does not overflow at this width");

    const bar = page.locator(".tds-topscroll");
    await expect(bar).toBeVisible();
    await bar.scrollIntoViewIfNeeded();
    const thumb = page.locator(".tds-topscroll-thumb");
    await expect(thumb).toBeVisible();

    // Thumb proportional to visible fraction (not the 10% floor artifact).
    const widthPct = await thumb.evaluate((el) => parseFloat((el as HTMLElement).style.width));
    const expectedPct = await board.evaluate((el) => (el.clientWidth / el.scrollWidth) * 100);
    expect(Math.abs(widthPct - expectedPct)).toBeLessThan(2);

    // Native scroll moves the thumb. The board scroll-snaps to column
    // starts, so don't assert an absolute position — assert the thumb's
    // ratio mirrors wherever the board actually settled.
    await board.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await page.waitForTimeout(400);
    const leftPct = await thumb.evaluate((el) => parseFloat((el as HTMLElement).style.left));
    const settledRatio = await board.evaluate(
      (el) => el.scrollLeft / (el.scrollWidth - el.clientWidth),
    );
    expect(settledRatio).toBeGreaterThan(0.2);
    expect(Math.abs(leftPct / (100 - widthPct) - settledRatio)).toBeLessThan(0.05);

    // Track click near the start jumps the board back.
    const box = (await bar.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + box.height / 2);
    // The board scroll-snaps; give the snap animation time to settle.
    await page.waitForTimeout(800);
    expect(await board.evaluate((el) => el.scrollLeft)).toBeLessThan(60);

    // Dragging the plane thumb scrolls the board (snap is suspended during
    // the drag and restored on release — wait for the settle).
    const tb = (await thumb.boundingBox())!;
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + tb.width / 2 + 300, tb.y + tb.height / 2, { steps: 6 });
    const duringDrag = await board.evaluate((el) => el.scrollLeft);
    await page.mouse.up();
    await page.waitForTimeout(700);
    expect(duringDrag).toBeGreaterThan(80);
    expect(await board.evaluate((el) => el.scrollLeft)).toBeGreaterThan(80);
  });

  test("absent when nothing overflows", async ({ page }) => {
    await page.setViewportSize({ width: 2400, height: 900 });
    await page.goto("/e2e/dossier?view=horizontal");
    await expect(page.locator(".tds-board")).toBeVisible();
    const overflow = await page
      .locator(".tds-board")
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    test.skip(overflow > 4, "board still overflows at 2400px");
    await expect(page.locator(".tds-topscroll")).toHaveCount(0);
  });
});
