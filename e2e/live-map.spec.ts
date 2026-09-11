import { test, expect } from "@playwright/test";

for (const width of [1280, 375]) {
  for (const skin of ["marguerite", "vesper"]) {
    test("map trip/day context and place detail " + skin + " " + width, async ({ page }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/e2e/dossier?skin=" + skin + "&map=trip", {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      const dialog = page.getByRole("dialog", { name: /Live map/ });
      await expect(dialog).toBeVisible({ timeout: 30000 });
      const pins = dialog.locator(".tds-mappin");
      await expect(pins).toHaveCount(18, { timeout: 30000 });
      const count = await pins.count();
      await dialog.getByRole("button", { name: "Day 02", exact: true }).click();
      await expect(page).toHaveURL(/map=day-2/);
      await expect(dialog.locator('.tds-mappin[data-context="true"]').first()).toBeAttached();
      expect(await pins.count()).toBe(count);
      await dialog.getByRole("button", { name: "Whole trip", exact: true }).click();
      await expect(page).toHaveURL(/map=trip/);
      await expect(dialog.locator('.tds-mappin[data-context="true"]')).toHaveCount(0);
      if (width < 768) await dialog.getByRole("button", { name: "Places", exact: true }).click();
      const panel = dialog.getByRole("complementary", { name: "Trip places" });
      await expect(panel).toBeVisible();
      await panel.locator(".tds-map-place-row").first().click();
      const detail = dialog.getByRole("complementary", { name: "Place details" });
      await expect(detail).toBeVisible();
      await expect(detail.getByRole("link", { name: "Directions", exact: true })).toHaveAttribute(
        "href",
        /maps.*(destination|daddr)=/,
      );
      const viewport = await dialog.locator(".tds-map-viewport").boundingBox();
      const box = await detail.boundingBox();
      expect(viewport).not.toBeNull();
      expect(box).not.toBeNull();
      if (width >= 768) {
        expect(box!.x).toBeGreaterThan(viewport!.x + viewport!.width - 2);
        expect(box!.width).toBe(360);
      } else {
        expect(box!.y).toBeGreaterThan(viewport!.y + viewport!.height - 2);
        expect(viewport!.height).toBeGreaterThan(150);
      }
      await page.screenshot({
        path: "test-results/map-" + skin + "-" + width + "-" + test.info().project.name + ".png",
        timeout: 15000,
      });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
}
test("coordinates arriving after open immediately populate the map", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/e2e/dossier?skin=marguerite&map=day-2&nocoords=1", {
    waitUntil: "domcontentloaded",
  });
  const dialog = page.getByRole("dialog", { name: /Live map/ });
  await expect(dialog.getByRole("button", { name: "Day 02", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect
    .poll(() => dialog.locator(".tds-mappin").count(), { timeout: 30000 })
    .toBeGreaterThan(0);
  await expect(dialog.locator(".tds-mappin-order").first()).toBeAttached();
});
test("blocked tiles preserve pins and place details in fallback", async ({ page }) => {
  test.setTimeout(90000);
  await page.route("https://tiles.openfreemap.org/**", (route) => route.abort());
  await page.goto("/e2e/dossier?skin=vesper&map=trip", { waitUntil: "domcontentloaded" });
  const dialog = page.getByRole("dialog", { name: /Live map/ });
  await expect(dialog).toBeVisible({ timeout: 30000 });
  await expect(dialog.getByText("Map tiles unavailable · positions are to scale")).toBeVisible({
    timeout: 30000,
  });
  await expect.poll(() => dialog.locator(".tds-mappin").count()).toBeGreaterThan(0);
  await dialog.locator(".tds-map-place-row").first().click();
  await expect(dialog.getByRole("link", { name: "Directions", exact: true })).toBeVisible();
});

test("browser back closes the map after changing day focus", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/e2e/dossier?skin=marguerite", { waitUntil: "domcontentloaded" });
  // Wait for hydration before clicking the server-rendered controls.
  await page.waitForFunction(() => sessionStorage.getItem("tds:slot-selection:v1") !== null);
  await page.getByRole("button", { name: "Map", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Live map/ });
  await expect(dialog).toBeVisible({ timeout: 30000 });
  await dialog.getByRole("button", { name: "Day 02", exact: true }).click();
  await expect(page).toHaveURL(/map=day-2/);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(dialog).toHaveCount(0);
});
test("a pin can reveal a collapsed day and return to its itinerary stop", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/e2e/dossier?skin=marguerite", { waitUntil: "domcontentloaded" });
  // Wait for hydration before clicking the server-rendered controls.
  await page.waitForFunction(() => sessionStorage.getItem("tds:slot-selection:v1") !== null);
  await page.getByRole("button", { name: "Collapse Day 2", exact: true }).click();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Live map/ });
  await expect(dialog).toBeVisible({ timeout: 30000 });
  await dialog
    .getByRole("button", { name: /Museu Nacional do Azulejo/ })
    .last()
    .click();
  await dialog.getByRole("button", { name: "Open in dossier", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Collapse Day 2", exact: true })).toBeVisible();
});
