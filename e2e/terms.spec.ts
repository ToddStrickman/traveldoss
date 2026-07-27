import { test, expect } from "@playwright/test";

/**
 * Terms of Service clickwrap + legal pages.
 *
 * Everything here runs unauthenticated: the /terms, /privacy and
 * /disclaimer pages are public, and the signup clickwrap is verified at
 * the UI-gating layer (checkbox ⇒ button enablement). Ledger writes and
 * the version gate are covered by unit tests + the authed checklist in
 * the PR description, since e2e has no Supabase credentials locally.
 */

test.describe("legal pages", () => {
  test("/terms renders the document with TOC and metadata", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).toHaveTitle(/Terms of Service \| TravelDoss/);
    await expect(
      page.getByRole("heading", { level: 1, name: /TravelDoss Terms of Service/ }),
    ).toBeVisible();
    // Sections render with anchor ids.
    await expect(page.locator("h2#limitation-of-liability")).toHaveCount(1);
    // Desktop TOC lists the sections.
    await expect(page.getByRole("navigation", { name: "Table of contents" }).first()).toBeVisible();
    await expect(page.locator("article#legal-content")).toContainText(
      "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW",
    );
  });

  test("deep link /terms#limitation-of-liability scrolls to the section", async ({ page }) => {
    await page.goto("/terms#limitation-of-liability");
    const heading = page.locator("h2#limitation-of-liability");
    await expect(heading).toBeVisible();
    // The section must be inside the viewport (allowing the scroll-margin).
    await expect
      .poll(async () => (await heading.boundingBox())?.y ?? Number.MAX_SAFE_INTEGER)
      .toBeLessThan(300);
  });

  test("/privacy and /disclaimer render", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: /Privacy Policy/ })).toBeVisible();
    await page.goto("/disclaimer");
    await expect(
      page.getByRole("heading", { level: 1, name: /TravelDoss Disclaimer/ }),
    ).toBeVisible();
  });

  test("landing footer links to all three documents", async ({ page }) => {
    await page.goto("/");
    const footerNav = page.getByRole("navigation", { name: "Legal" });
    await footerNav.scrollIntoViewIfNeeded();
    await expect(footerNav.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/terms",
    );
    await expect(footerNav.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    await expect(footerNav.getByRole("link", { name: "Disclaimer" })).toHaveAttribute(
      "href",
      "/disclaimer",
    );
    await footerNav.getByRole("link", { name: "Terms of Service" }).click();
    await expect(page).toHaveURL(/\/terms$/);
  });
});

test.describe("signup clickwrap", () => {
  test("create account stays disabled until the Terms box is ticked", async ({ page }) => {
    await page.goto("/login");
    // The login page is SSR'd: a click that lands before hydration hits a
    // handler-less button. Retry the mode switch until the signup headline
    // proves React is live.
    await expect(async () => {
      await page.getByRole("button", { name: /No account — Sign up/ }).click();
      await expect(page.getByRole("heading", { name: /Open a dossier/ })).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 15_000 });

    const submit = page.getByRole("button", { name: "Create account" });
    const checkbox = page.getByRole("checkbox");

    // Unchecked by default, submit disabled even with valid fields.
    await expect(checkbox).not.toBeChecked();
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByLabel("Password").fill("hunter22");
    await expect(submit).toBeDisabled();

    // Links open the documents in a new tab.
    const agreeLine = page.locator("label[for=agree-terms]");
    await expect(agreeLine.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "target",
      "_blank",
    );
    await expect(agreeLine.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );

    // Keyboard-accessible affirmative act enables the button.
    await checkbox.focus();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
    await expect(submit).toBeEnabled();

    // Untick ⇒ disabled again.
    await checkbox.click();
    await expect(submit).toBeDisabled();
  });

  test("sign-in mode shows no checkbox and stays usable", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
