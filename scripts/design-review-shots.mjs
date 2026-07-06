/**
 * Design-review screenshot harness (.design/traveldoss-mobile).
 * Captures the visitor path at the review breakpoints plus key interactive
 * states, straight into .design/traveldoss-mobile/screenshots/.
 *
 * Usage: node scripts/design-review-shots.mjs [baseUrl]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:8080";
const OUT = ".design/traveldoss-mobile/screenshots";
mkdirSync(OUT, { recursive: true });

const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 800 };

const browser = await chromium.launch();

async function page(viewport, opts = {}) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    hasTouch: viewport === MOBILE,
    isMobile: viewport === MOBILE,
    ...opts,
  });
  return ctx.newPage();
}

async function shot(p, name, { fullPage = true, settle = 900 } = {}) {
  await p.waitForTimeout(settle);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log("✓", name);
}

// ── Landing ────────────────────────────────────────────────────────────
for (const [vp, tag] of [[MOBILE, "mobile-375"], [TABLET, "tablet-768"], [DESKTOP, "desktop-1280"]]) {
  const p = await page(vp);
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  // Sand hero canvas needs a beat to reveal.
  await shot(p, `review-landing-${tag}`, { fullPage: false, settle: 3500 });
  await p.context().close();
}

// ── Templates gallery ──────────────────────────────────────────────────
for (const [vp, tag] of [[MOBILE, "mobile-375"], [TABLET, "tablet-768"], [DESKTOP, "desktop-1280"]]) {
  const p = await page(vp);
  await p.goto(`${BASE}/templates`, { waitUntil: "networkidle" });
  await shot(p, `review-templates-${tag}`, { fullPage: vp !== MOBILE, settle: 1500 });
  await p.context().close();
}

// ── Skin peek (mobile interactive state) ───────────────────────────────
{
  const p = await page(MOBILE);
  await p.goto(`${BASE}/templates`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.locator('article[role="button"]').first().click();
  await shot(p, "review-skin-peek-mobile-375", { fullPage: false });
  await p.context().close();
}

// ── Dossier: three views at mobile, vertical at tablet/desktop ─────────
for (const [q, tag] of [["", "vertical"], ["?view=horizontal", "horizontal"], ["?view=grid", "grid"]]) {
  const p = await page(MOBILE);
  await p.goto(`${BASE}/e2e/dossier${q}`, { waitUntil: "networkidle" });
  await shot(p, `review-dossier-${tag}-mobile-375`, { fullPage: tag === "vertical" });
  await p.context().close();
}
for (const [vp, tag] of [[TABLET, "tablet-768"], [DESKTOP, "desktop-1280"]]) {
  const p = await page(vp);
  await p.goto(`${BASE}/e2e/dossier`, { waitUntil: "networkidle" });
  await shot(p, `review-dossier-vertical-${tag}`, { fullPage: false });
  await p.context().close();
}

// ── Dossier interactive states (mobile) ────────────────────────────────
{
  const p = await page(MOBILE);
  await p.goto(`${BASE}/e2e/dossier`, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: /days/i }).click();
  await shot(p, "review-day-jump-sheet-mobile-375", { fullPage: false });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /change layout/i }).click();
  await shot(p, "review-view-sheet-mobile-375", { fullPage: false });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  // Place sheet: tap the first tappable row.
  await p.locator('.tds-act-row[data-tappable]').first().click();
  await shot(p, "review-place-sheet-mobile-375", { fullPage: false });
  await p.context().close();
}

// ── Mint bar + mint takeover (mobile) ──────────────────────────────────
{
  const p = await page(MOBILE);
  await p.goto(`${BASE}/e2e/dossier?bar=mint`, { waitUntil: "networkidle" });
  await shot(p, "review-mint-bar-mobile-375", { fullPage: false });
  await p.getByRole("button", { name: /mint this dossier/i }).click();
  await shot(p, "review-mint-sheet-mobile-375", { fullPage: false });
  await p.context().close();
}

// ── Reduced motion sanity (mobile dossier) ─────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: MOBILE,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/e2e/dossier`, { waitUntil: "networkidle" });
  await shot(p, "review-dossier-reduced-motion-mobile-375", { fullPage: false });
  await ctx.close();
}

await browser.close();
console.log("done");
