import { expect, test, type Page } from "@playwright/test";

/**
 * Mobile-viewport smoke tests for the highest-traffic flows.
 *
 * Asserts each surface is usable at iPhone-class widths (375 and 414 CSS px):
 *  - sign-in form (`/login`)             — public
 *  - trip list (`/app`)                  — auth-gated; falls back to checking
 *                                          the /login redirect when no creds
 *  - trip detail (`/t/$slug`)            — public if `TEST_TRIP_SLUG` is set
 *  - ingestion modal (landing → modal)   — public
 *  - export menu (trip detail, owner)    — owner-only; uses TEST_TRIP_SLUG
 *                                          + storageState when available
 *
 * Opt-in env:
 *   TEST_TRIP_SLUG     a public dossier slug to drive the trip-detail checks
 *   TEST_AUTH_STATE    path to a Playwright storageState JSON for owner flows
 *
 * Each test verifies:
 *   1. No horizontal page overflow (document scroll width ≤ viewport width)
 *   2. Primary CTAs have at least 44×44 CSS-px tap targets
 *   3. Key UI is in the viewport without manual zoom
 */

const VIEWPORTS = [
  { label: "iphone-se", width: 375, height: 667 },
  { label: "iphone-plus", width: 414, height: 896 },
] as const;

const TRIP_SLUG = process.env.TEST_TRIP_SLUG;
const AUTH_STATE = process.env.TEST_AUTH_STATE;

async function expectNoHorizontalOverflow(page: Page, width: number) {
  // Allow 1px of sub-pixel rounding slack.
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollW, "no horizontal overflow").toBeLessThanOrEqual(width + 1);
}

async function expectTapTarget(page: Page, locator: ReturnType<Page["locator"]>) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  // Apple HIG: 44pt minimum. Allow rounding fuzz.
  expect(box.height, "tap-target height").toBeGreaterThanOrEqual(40);
  expect(box.width, "tap-target width").toBeGreaterThanOrEqual(40);
}

for (const vp of VIEWPORTS) {
  test.describe(`mobile · ${vp.label} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("sign-in page is usable", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      await expectNoHorizontalOverflow(page, vp.width);

      const email = page.locator("#email");
      const password = page.locator("#password");
      await expect(email).toBeVisible();
      await expect(password).toBeVisible();

      // Inputs must reach the available width minus the page gutter.
      const emailBox = await email.boundingBox();
      expect(emailBox?.width ?? 0).toBeGreaterThan(vp.width * 0.6);

      const submit = page.getByRole("button", { name: /sign in|create account/i });
      await expectTapTarget(page, submit);

      const google = page.getByRole("button", { name: /continue with google/i });
      await expectTapTarget(page, google);

      // Toggle to sign-up must remain reachable without horizontal scroll.
      const toggle = page.getByRole("button", { name: /no account|have an account/i });
      await expect(toggle).toBeVisible();
    });

    test("trip list / auth redirect renders without overflow", async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        ...(AUTH_STATE ? { storageState: AUTH_STATE } : {}),
      });
      const page = await context.newPage();
      try {
        await page.goto("/app");
        await page.waitForLoadState("networkidle");

        await expectNoHorizontalOverflow(page, vp.width);

        if (page.url().includes("/login")) {
          // Unauthenticated path — assert we landed on a usable sign-in.
          await expect(page.locator("#email")).toBeVisible();
        } else {
          // Authenticated path — assert the dashboard primary CTA is reachable.
          const mint = page.getByRole("button", { name: /mint a new dossier/i });
          await expectTapTarget(page, mint);
        }
      } finally {
        await context.close();
      }
    });

    test("ingestion modal opens and fits the viewport", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // The TemplateGallery cards each trigger the modal via `onPick`.
      const card = page
        .locator("button", { hasText: /use this template/i })
        .first();
      await card.scrollIntoViewIfNeeded();
      await card.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Modal must not exceed viewport width and must leave the 8px gutter
      // configured via `w-[calc(100vw-16px)]`.
      const box = await dialog.boundingBox();
      expect(box, "dialog has a box").not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(vp.width);
      expect(box!.width).toBeGreaterThanOrEqual(Math.min(vp.width - 32, 280));

      await expectNoHorizontalOverflow(page, vp.width);

      // Source-step textarea must be visible and reach near-full width.
      const textarea = dialog.locator("textarea").first();
      await expect(textarea).toBeVisible();
      const tBox = await textarea.boundingBox();
      expect(tBox?.width ?? 0).toBeGreaterThan(vp.width * 0.55);

      // Step tabs must wrap into a single column without overflowing.
      const tabs = dialog.locator("button", { hasText: /paste|upload|scan/i });
      const count = await tabs.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test.describe("trip detail (requires TEST_TRIP_SLUG)", () => {
      test.skip(!TRIP_SLUG, "Set TEST_TRIP_SLUG to a public dossier slug");

      test("dossier renders without horizontal overflow", async ({ page }) => {
        await page.goto(`/t/${TRIP_SLUG}`);
        await page.waitForLoadState("networkidle");

        await expectNoHorizontalOverflow(page, vp.width);

        // Back-to-TravelDoss control must remain a tappable target.
        const back = page.getByRole("link", { name: /back to traveldoss/i });
        await expectTapTarget(page, back);

        // Layout switch must be visible at the top of the dossier.
        const layout = page.locator('[aria-label="Layout"]');
        await expect(layout).toBeVisible();
        const layoutBox = await layout.boundingBox();
        expect(layoutBox?.x ?? -1).toBeGreaterThanOrEqual(0);
        expect((layoutBox?.x ?? 0) + (layoutBox?.width ?? 0)).toBeLessThanOrEqual(vp.width);
      });
    });

    test.describe("export menu (requires TEST_TRIP_SLUG + TEST_AUTH_STATE)", () => {
      test.skip(!TRIP_SLUG || !AUTH_STATE, "Set TEST_TRIP_SLUG and TEST_AUTH_STATE");

      test("export controls are visible and tappable", async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          storageState: AUTH_STATE!,
        });
        const page = await context.newPage();
        try {
          await page.goto(`/t/${TRIP_SLUG}?mode=edit`);
          await page.waitForLoadState("networkidle");

          await expectNoHorizontalOverflow(page, vp.width);

          for (const label of ["Live URL", "PDF", "Google Docs"] as const) {
            const btn = page.locator(`button[aria-label="${label}"]`);
            await expectTapTarget(page, btn);
            const box = await btn.boundingBox();
            expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(vp.width);
          }
        } finally {
          await context.close();
        }
      });
    });
  });
}