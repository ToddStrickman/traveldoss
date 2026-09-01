# Mobile visual regression at 375px and 430px

Extend the existing dossier-selector mobile test so the horizontal view's placeholder copy and layout are pinned on small (iPhone SE / mini, 375px) and large (iPhone Pro Max, 430px) phones, not just the 393px case it covers today.

## What changes

`e2e/templates-mobile-visual.spec.ts` becomes width-parameterised. The same suite runs three times — 375, 393, 430 — with each width in its own describe block so a failure names the width.

At every width the checks stay the ones that have caught drift before:

- The browse-mode switcher sits above the first cover (never a scroll away) and every switcher button keeps a 44px tap target.
- Each mode's cover caption shows that mode's benefit copy, and only that mode's copy is on screen. Horizontal remains "Days side by side — slide activities between them".
- The covers rail scrolls sideways in all three modes while the page itself never scrolls horizontally.
- The `/t/<slug>` layout sheet hint for Horizontal matches the cover caption.

Additional alignment assertions, so "stays aligned" is measured rather than eyeballed:

- The active cover is horizontally centred in the rail within a small tolerance, matching the neighbour-bleed pattern already asserted in `e2e/flow-walkthrough-center.spec.ts`.
- The caption block sits fully inside its cover's bounds (no clipped or overflowing text at either width).
- Cover aspect and caption line count are compared across the three widths so 375 does not silently gain an extra wrapped line that 430 lacks.

Pixel snapshots remain opt-in behind `VISUAL=1`, with per-width baseline names (`cover-horizontal-375.png`, `-393`, `-430`).

## Technical notes

- `test.use({ viewport, hasTouch: true, isMobile: true })` moves inside a `forEachWidth` describe factory; helper functions take the width as an argument instead of closing over a module constant.
- No product code changes. Copy constants in the spec continue to mirror `src/components/flow/DossierCover.tsx` and `src/components/mobile/ViewSheet.tsx`.
- Verification: `npx vitest run` and `tsc --noEmit` per house rules, plus the Playwright spec run at all three widths.

## Noted, not changed

The layout trigger carries `aria-label="Layout: <mode>. Change layout"` while showing the visible text "Layout" — the visible text is contained in the accessible name, so it passes, but it is an aria-label on a text button. Out of scope here; say the word and I will fold it into a follow-up.
