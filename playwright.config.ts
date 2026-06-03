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
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});