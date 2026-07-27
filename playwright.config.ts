import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for kanban DnD smoke tests.
 *
 * Run with:
 *   bunx playwright install chromium   # one-time browser binary install
 *   bun run test:e2e
 *
 * The tests boot the Vite dev server, log in is NOT required because the
 * /t/$slug dossier route is publicly viewable. Edit mode in the smoke tests
 * is exercised on a seeded local trip; see e2e/kanban-dnd.spec.ts.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    // The Lovable vite wrapper (@lovable.dev/vite-tanstack-config) serves the
    // dev server on 8080, not vite's stock 5173.
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:8080",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // iOS Safari emulation for the FlowScroller mobile spec, which
    // pins itself to webkit via test.use({ browserName: "webkit" }).
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});