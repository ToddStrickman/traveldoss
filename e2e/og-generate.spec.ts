import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLISHED_GUIDES } from "../src/content/guides";

/**
 * Not a test: an env-gated generator that renders the static 1200×630 OG card
 * for every published Insider Guide into public/og/guides/<slug>.png (impl
 * spec §4 — accent + title, no external services). It lives in e2e/ because
 * Playwright is the repo's only browser runtime that works under node on
 * Windows (bun cannot drive Playwright's launch pipe). Run after adding or
 * renaming a guide:
 *
 *   OG_GEN=1 npx playwright test e2e/og-generate.spec.ts --project=chromium
 *
 * Design mirrors the /guides tokens (guides.css): near-black editorial ground,
 * accent beacon, serif display title, quiet wordmark. System serif only — OG
 * scrapers see no webfonts, so the card never depends on one.
 */

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "og", "guides");

function cardHtml(g: (typeof PUBLISHED_GUIDES)[number]): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #05070c; color: #eaf2f6;
    font-family: Georgia, "Times New Roman", serif;
    display: flex; flex-direction: column;
  }
  .bar { height: 8px; background: ${g.accent}; }
  .inner { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 64px 72px 56px; }
  .eyebrow {
    display: inline-flex; align-items: center; gap: 14px; align-self: flex-start;
    border: 1px solid rgba(234,242,246,0.16); border-radius: 999px; padding: 12px 26px;
    font-family: Arial, Helvetica, sans-serif; font-size: 20px; letter-spacing: 0.24em;
    text-transform: uppercase; color: #aebccb; background: #0b1220;
  }
  .eyebrow i { width: 12px; height: 12px; border-radius: 999px; background: ${g.accent}; }
  h1 { font-size: ${g.title.length > 34 ? 68 : 78}px; font-weight: 400; letter-spacing: -0.015em; line-height: 1.04; max-width: 1020px; }
  .dek { margin-top: 26px; font-style: italic; font-size: 30px; line-height: 1.35; color: #aebccb; max-width: 940px; }
  .foot { display: flex; align-items: baseline; justify-content: space-between; font-family: Arial, Helvetica, sans-serif; }
  .brand { font-size: 20px; letter-spacing: 0.28em; text-transform: uppercase; color: ${g.accent}; }
  .meta { font-size: 20px; letter-spacing: 0.14em; text-transform: uppercase; color: #aebccb; }
  </style></head><body>
    <div class="bar"></div>
    <div class="inner">
      <span class="eyebrow"><i></i>Insider Guide ${g.no}</span>
      <div><h1>${g.title}</h1><p class="dek">${g.dek}</p></div>
      <div class="foot"><span class="brand">TravelDoss · Insider Guides</span><span class="meta">${g.days} · ${g.season}</span></div>
    </div>
  </body></html>`;
}

test("generate OG cards for published guides", async ({ page }) => {
  test.skip(!process.env.OG_GEN, "generator, not a test — run with OG_GEN=1");
  mkdirSync(OUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1200, height: 630 });
  for (const g of PUBLISHED_GUIDES) {
    await page.setContent(cardHtml(g));
    await page.screenshot({ path: join(OUT_DIR, `${g.slug}.png`) });
  }
});
