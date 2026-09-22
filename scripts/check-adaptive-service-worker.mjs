/**
 * Check the built service worker using a disposable local server and browser.
 * Run after bun run build: node scripts/check-adaptive-service-worker.mjs
 * No production endpoint, email account, or persistent browser profile is used.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const root = resolve(".output/public");
await readFile(resolve(root, "sw.js"));
await readFile(resolve(root, "adaptive-push.js"));
const types = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const file = resolve(root, "." + decodeURIComponent(pathname));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res
      .writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" })
      .end(body);
  } catch {
    if (pathname === "/" || pathname === "/public-probe" || pathname.startsWith("/app/dossier/")) {
      res
        .writeHead(200, {
          "Content-Type": "text/html",
          ...(pathname.startsWith("/app/") ? { "Cache-Control": "private, no-store" } : {}),
        })
        .end("<!doctype html><title>Worker probe</title><p>Worker probe</p>");
    } else res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.evaluate(() => navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await page.waitForFunction(
    async () => (await navigator.serviceWorker.getRegistration("/"))?.active?.state === "activated",
    { timeout: 30_000 },
  );
  await page.goto(base + "/public-probe");
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.goto(base + "/public-probe");
  await page.waitForFunction(async () => !!(await caches.match(location.href)));
  await page.goto(base + "/app/dossier/private-test");
  assert.equal(await page.evaluate(async () => !!(await caches.match(location.href))), false);
  const workerSource = await readFile(resolve(root, "sw.js"), "utf8");
  assert.ok(workerSource.includes("adaptive-push.js"));
  assert.deepEqual(errors, []);
  console.log(
    "Built service worker: activated; public navigation cached; private dossier excluded; push handler imported; no browser errors.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
