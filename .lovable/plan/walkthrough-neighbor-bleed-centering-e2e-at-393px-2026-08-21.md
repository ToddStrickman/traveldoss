# Walkthrough neighbor bleed + centering e2e at 393px

Two connected pieces of work on the mobile five-step Flow walkthrough.

## 1. Purposeful neighbor bleed

Today each mobile panel is exactly one viewport wide, so the walkthrough looks like a single static screen — there is no visual promise that a step 02 exists just off the right edge. The change gives the active step a card-like slot narrower than the viewport, so a sliver of the next (and previous) step bleeds in at the edges and invites the swipe.

- Panels become ~86% of the viewport width with the track offset so the active panel lands dead-center; roughly 7% of each neighbor shows on either side.
- Neighbors are visually subordinate, not just cropped: they render dimmed and very slightly scaled down and pushed back, so the eye reads one active card with material continuing past the frame. The active panel returns to full opacity/scale as it centers, driven by the existing scroll progress motion value.
- The right-edge bleed on step 01 and the left-edge bleed on step 05 are the "there is more this way" cue that pairs with the existing "Keep scrolling" hint; the outer edges stay clean (no phantom sixth card).
- `prefers-reduced-motion` keeps the bleed and centering but drops the scale/opacity interpolation to a static treatment.
- Desktop (`lg:`) and the untouched `Panel` component are not changed.

## 2. Automated e2e: `e2e/flow-walkthrough-center.spec.ts`

New spec at 393x852 (iPhone 14/15-class), following the conventions in `templates-mobile-visual.spec.ts`.

- Drives the walkthrough one step at a time with real touch gestures (`dispatchTouchEvent`-style swipes on the sticky pane), plus a second pass using the prev/next controls.
- After each step settles, measures the active panel's bounding box and asserts its center is within a small tolerance (about 2px) of the viewport center at 393px — this is the "perfectly centered" guarantee.
- Asserts the bleed is real and bounded: on steps 02-04 both neighbors are partially visible with each visible sliver inside an expected band, on step 01 only the right neighbor bleeds, on step 05 only the left one.
- Asserts the step counter, progress bar width and active dot track the centered panel, and that the page never gains horizontal document scroll.
- Opt-in pixel snapshots behind `VISUAL=1`, matching the existing spec's approach, since baselines are machine-specific.

## Technical notes

- `src/components/landing/FlowScroller.tsx`: mobile track (lines ~509-517) and `MobilePanel` (lines ~553-589). Panel width moves off `100 / total` to a `PANEL_VW` constant; the `x` transform range and the snap-target math (`snapTops`, `goToStep`'s bucket-center formula, lines ~301-395) are recomputed from the same constant so native snapping still lands panels centered. One shared constant drives width, track offset and snap tops — they must not be allowed to drift.
- Existing swipe threshold (44px) and `useStepKeys` behavior stay as they are.
- Analytics: the new spec asserts nothing about events, but the bleed change adds no new measurable moment, so no new events. `flow_step_navigated` already fires per step with `via` set to `swipe` / `button`.
- Register the new spec in the existing Playwright project config; no new dependencies.
- Verification: `npx vitest run` and `tsc --noEmit` clean, then `npx playwright test e2e/flow-walkthrough-center.spec.ts` green. Accessibility and CLS on the walkthrough must not regress — reserved space in the header rail and control row is untouched.
