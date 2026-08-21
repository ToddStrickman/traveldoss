# Mobile visual regression test for the horizontal-view copy (393px)

A new Playwright spec pins the phone rendering of the horizontal layout so the copy and the cover art can't silently drift again.

## What the test covers (iPhone 14/15-class, 393x852)

On `/templates`:
- The browse switcher sits above the covers (its bottom edge is above the first cover card's top edge).
- With Horizontal selected, the visible cover caption reads exactly "Days side by side — slide activities between them".
- Switching to Vertical and Grid swaps the caption to "The full read, top to bottom" and "The whole trip at a glance" — so the copy is proven to be per-mode, not a constant.
- All three modes still swipe sideways: the rail's scroll width exceeds its client width, and the page itself has no horizontal overflow.
- Each switcher button meets the 44px tap-target rule.

On `/t/<slug>` (via the existing public `/e2e/dossier` fixture route):
- Opening the layout sheet shows the Horizontal row with the same hint text, so cover and sheet copy stay in sync.

## Visual snapshots

Three `toHaveScreenshot` snapshots — the centred cover card in each mode — clipped to the card element (never full-page) so text rendering and font-loading jitter elsewhere don't cause false failures. Snapshots are taken with animations disabled and a small pixel-diff tolerance, after fonts settle.

Because snapshot baselines are machine-dependent, the screenshot assertions live behind an opt-in env flag (`VISUAL=1`); the copy, layout-order, overflow, and tap-target assertions always run. This keeps the suite green on a fresh checkout while giving a real visual baseline locally/CI once committed.

## Technical notes

- New file `e2e/templates-mobile-visual.spec.ts`, `test.use({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true })`, chromium project.
- Reuses the helper style already in `e2e/mobile-viewports.spec.ts` (`expectNoHorizontalOverflow`, tap-target box check) — copied locally rather than exported, to avoid touching that spec.
- Selectors: `getByRole("group", { name: "Browse mode" })` for the switcher, `getByRole("button", { name: "Horizontal" })` etc. for modes, and the caption matched by exact text within the rail. Cover captions are `aria-hidden`, so the spec reads them with `locator(...).filter({ hasText })` / `textContent`, not by role.
- Layout sheet: `getByRole("button", { name: /change layout/i })` then the `radio` named Horizontal, matching the pattern in `scripts/design-review-shots.mjs`.
- Snapshot config: `{ animations: "disabled", maxDiffPixelRatio: 0.02 }`.
- No product code changes. Verification: `bunx playwright test e2e/templates-mobile-visual.spec.ts` plus `npx vitest run` and `tsc --noEmit` clean.
