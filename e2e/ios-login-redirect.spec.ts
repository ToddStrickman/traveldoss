/**
 * iOS sign-in regression guard.
 *
 * `_authenticated.tsx` used to navigate to `/login?redirect={currentHref}` from
 * an effect whose dependency list included `currentHref`. Its own navigation
 * changed the location, re-fired the effect, and folded the new href into the
 * next `?redirect=` — unbounded. Production showed 54 levels of nesting and a
 * ~9.5KB URL.
 *
 * On desktop Chrome that is merely ugly. On iOS Safari it is fatal: WebKit
 * rate-limits history.replaceState (SecurityError after ~100 calls in 30s), so
 * the rapid replace-loop throws and the sign-in page never settles — which is
 * why the reported symptom was "can't log in on iOS" specifically.
 *
 * Pinned to webkit + an iPhone viewport because that is the engine that turns
 * this from cosmetic into a hard failure.
 */
import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["iPhone 13"], browserName: "webkit" });

test("signed-out /app lands on a usable sign-in form without nesting redirects", async ({
  page,
}) => {
  const securityErrors: string[] = [];
  page.on("pageerror", (err) => {
    if (/SecurityError|replaceState|pushState/i.test(String(err))) {
      securityErrors.push(String(err));
    }
  });

  await page.goto("/app");
  // Let the auth effect settle; a looping redirect would keep growing here.
  await page.waitForTimeout(2500);

  const url = page.url();

  // Exactly one /login segment — the redirect target is /app, not another login URL.
  expect(url.match(/login/g)?.length ?? 0).toBe(1);
  expect(url.length).toBeLessThan(200);
  expect(url).toContain("redirect=%2Fapp");

  // The form is actually reachable and interactive, not stuck mid-redirect.
  await expect(page.locator("input[type=email]")).toBeVisible();
  await expect(page.locator("input[type=password]")).toBeVisible();

  // WebKit never tripped its history rate limit.
  expect(securityErrors).toEqual([]);
});
