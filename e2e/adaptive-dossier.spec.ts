import { test, expect } from "@playwright/test";

for (const width of [1440, 390]) {
  test(
    "Planning, Review, cancellation, Live Trip and settings at " + width + "px",
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto("/e2e/adaptive");
      await page.locator('.ad-root[data-ready="true"]').waitFor();
      await expect(page.getByRole("heading", { name: "Paris." })).toBeVisible();
      await expect(page.locator('[data-testid="reservation-card"]')).toHaveCount(4);
      await page.getByRole("button", { name: "Simulate schedule update", exact: true }).click();
      await page.getByRole("button", { name: "Simulate schedule update", exact: true }).click();
      await expect(page.locator('[data-testid="reservation-card"]')).toHaveCount(4);
      await page.getByRole("button", { name: "Cancel transfer", exact: true }).click();
      await expect(page.locator('[data-testid="reservation-card"]')).toHaveCount(3);
      await page.getByRole("button", { name: "Cancelled / Changes", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Airport pickup", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Unmatched cancellation", exact: true }).click();
      await page.getByRole("button", { name: "Review · 1", exact: true }).click();
      await expect(
        page.getByText("Cancellation has no confident match.", { exact: false }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Dismiss evidence", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Nothing waiting on you." })).toBeVisible();
      await page.getByRole("button", { name: "Reset demo", exact: true }).click();
      await page.getByRole("button", { name: "Activate Live Trip", exact: true }).click();
      await page.getByRole("button", { name: "Simulate flight delay", exact: true }).click();
      await page.getByRole("button", { name: "Simulate rain forecast", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Disrupted", exact: true })).toBeVisible();
      await expect(
        page.getByText("Airport pickup may be affected.", { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Worth bringing", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Consider bringing a compact rain layer or an umbrella.", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: "test-results/adaptive-live-" + width + ".png",
        fullPage: true,
      });
      await page.getByRole("button", { name: "Pause assistance", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Assistance paused", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByLabel("Scan range", { exact: true }).selectOption("new");
      await page.getByLabel("Hours before the first active reservation").fill("48");
      await page.getByLabel("Activate automatically", { exact: true }).check();
      await page.getByRole("button", { name: "Save preferences", exact: true }).click();
      await expect(page.getByText("Preferences saved", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Dossier", exact: true }).click();
      await expect(page.locator('[data-testid="reservation-card"]')).toHaveCount(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await page.screenshot({
        path: "test-results/adaptive-planning-" + width + ".png",
        fullPage: true,
      });
      expect(errors).toEqual([]);
    },
  );
}
test("review correction, manual reservation edit, history restore and map cancellation filter", async ({
  page,
}) => {
  await page.goto("/e2e/adaptive");
  await page.locator('.ad-root[data-ready="true"]').waitFor();
  await page.getByRole("button", { name: "Add reservation", exact: true }).click();
  await page.getByLabel("Reservation name", { exact: true }).fill("Dinner at the gallery");
  await page.getByLabel("Provider", { exact: true }).fill("Gallery dining");
  await page.getByLabel("Confirmation / booking ID", { exact: true }).fill("DINNER1");
  await page
    .getByLabel("Start (with UTC offset)", { exact: true })
    .fill("2030-06-19T19:30:00+02:00");
  await page.getByLabel("IANA timezone", { exact: true }).fill("Europe/Paris");
  await page.getByLabel("City / location", { exact: true }).fill("Paris");
  await page.getByRole("button", { name: "Save reservation", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dinner at the gallery", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simulate schedule update", exact: true }).click();
  const flight = page
    .locator('[data-testid="reservation-card"]')
    .filter({ has: page.getByRole("heading", { name: "Air France AF007", exact: true }) });
  await flight.getByText("Details, sources & history", { exact: true }).click();
  await expect(
    flight.getByRole("heading", { name: "Original reservation", exact: true }),
  ).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await flight.getByRole("button", { name: "Restore", exact: true }).first().click();
  await expect(flight.getByText("User Edited", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Places in your active plan", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2 mapped", { exact: false })).toBeVisible();
});
test("unauthenticated background job requests fail closed", async ({ request }) => {
  const response = await request.post("/api/adaptive/jobs");
  expect(response.status()).toBe(401);
});
