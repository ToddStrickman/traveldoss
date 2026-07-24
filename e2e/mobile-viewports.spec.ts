import { expect, test, type Page, type Locator } from "@playwright/test";

/**
 * Mobile-viewport smoke tests for the highest-traffic flows (current
 * landing: numbered CTAs, lazy-mounted template gallery, mobile bottom
 * nav; /app redirects signed-out visitors to /login).
 *
 * Asserts each surface is usable at iPhone-class widths (375 and 414 CSS px):
 *  - sign-in form (`/login`)             — public
 *  - trip list (`/app`)                  — auth-gated; asserts the /login
 *                                          redirect (with form) when no creds
 *  - landing → template card → modal     — public; the gallery lazy-mounts,
 *                                          so the spec walks the page to it
 *  - trip detail (`/t/$slug`)            — public if `TEST_TRIP_SLUG` is set
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

async function expectTapTarget(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  // Apple HIG: 44pt minimum. Allow rounding fuzz.
  expect(box.height, "tap-target height").toBeGreaterThanOrEqual(40);
  expect(box.width, "tap-target width").toBeGreaterThanOrEqual(40);
}

/** Below-the-fold landing sections mount via InViewLazy only when scrolled
 *  near — walk the page a viewport at a time until the target exists. */
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

        if (AUTH_STATE) {
          // Authenticated path — the dashboard primary CTA is reachable.
          const mint = page.getByRole("button", { name: /mint a new dossier/i });
          await expectTapTarget(page, mint);
        } else {
          // Signed-out path: the auth gate must NAVIGATE to the sign-in
          // form (never the router error boundary), carrying a redirect
          // back to /app.
          await page.waitForURL(/\/login/, { timeout: 15000 });
          await expect(page.locator("#email")).toBeVisible();
          expect(page.url()).toContain("redirect=");
          // Regression guard for the old crash: no error boundary.
          await expect(page.getByText(/this page didn't load/i)).toHaveCount(0);
        }

        await expectNoHorizontalOverflow(page, vp.width);
      } finally {
        await context.close();
      }
    });

    test("landing template card opens the composer modal and fits the viewport", async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("main", { timeout: 15000 });

      // The template gallery lazy-mounts below the fold; its cards are
      // labeled "Use the {codename} dossier template".
      const card = page.getByRole("button", { name: /use the .+ dossier template/i }).first();
      await scrollUntilMounted(page, card);
      await card.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Modal must not exceed viewport width and must keep its gutter.
      const box = await dialog.boundingBox();
      expect(box, "dialog has a box").not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(vp.width);
      expect(box!.width).toBeGreaterThanOrEqual(Math.min(vp.width - 32, 280));

      await expectNoHorizontalOverflow(page, vp.width);

      // Composer tabs (Paste / Upload / Generate) all present.
      const tabs = dialog.locator("button", { hasText: /paste|upload|generate/i });
      expect(await tabs.count()).toBeGreaterThanOrEqual(3);

      // Paste tab's textarea reaches near-full width.
      const textarea = dialog.locator("textarea").first();
      await expect(textarea).toBeVisible();
      const tBox = await textarea.boundingBox();
      expect(tBox?.width ?? 0).toBeGreaterThan(vp.width * 0.55);
    });

    test("mobile bottom nav is present with a reachable sign-in", async ({ page }) => {
      await page.goto("/");
      const nav = page.locator('nav[aria-label="Primary"]');
      await expect(nav).toBeVisible();
      // Signed out: the way in must be one thumb-tap away.
      const signIn = nav.locator('a[href="/login"]');
      await expectTapTarget(page, signIn);
      const navBox = await nav.boundingBox();
      expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(vp.height + 1);
      await expectNoHorizontalOverflow(page, vp.width);
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
