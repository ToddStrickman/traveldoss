# Benefit-led placeholder copy for all three view options

Horizontal already states its benefit ("Days side by side — slide activities between them"). Vertical and Grid still describe what they look like rather than what they let you do, so the switcher reads unevenly. This change brings all three onto the same benefit-first pattern: what the layout puts in front of you, then what you can do with it.

## New copy

| View | Current | New |
| --- | --- | --- |
| Horizontal | Days side by side — slide activities between them | unchanged |
| Vertical | The full read, top to bottom | One flowing read — scroll the whole trip without losing your place |
| Grid | The whole trip at a glance | Every day on one board — spot gaps and busy days instantly |

The layout sheet on `/t/<slug>` uses shorter hints in the same voice, so the sheet rows stay one line at 375px:

| View | Current hint | New hint |
| --- | --- | --- |
| Vertical | The editorial read, day by day | One flowing read, start to finish |
| Horizontal | Days side by side — slide activities between them | unchanged |
| Grid | The whole trip on one board | Every day on one board, at a glance |

## Technical notes

- `src/components/flow/DossierCover.tsx` (~lines 95-100): the caption ternary for `grid` / `horizontal` / `vertical`.
- `src/components/mobile/ViewSheet.tsx` (`OPTIONS`, lines 21-23): the `hint` strings for vertical and grid.
- `e2e/templates-mobile-visual.spec.ts` holds the cover captions in its `CAPTIONS` map; update the vertical and grid entries in the same change so the mobile regression test stays green.
- Text-only edits — no layout, art, token, or behavior changes. Cover captions keep the existing single-line uppercase treatment and reserved space, so CLS and contrast are unaffected.
- Verification: `npx vitest run` and `bun test` (pre-existing live-AI parser failures aside), `tsc --noEmit` clean, plus a 393px check that no caption wraps past two lines in the cover or the sheet row.
