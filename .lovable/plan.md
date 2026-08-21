# Outcome-led placeholder copy for all three view options

The three captions in the dossier selector currently describe shapes and mechanics ("The full read, top to bottom", "The whole trip at a glance", "Days side by side"). This change rewrites all three to lead with what the traveler actually gets out of the view, then names the mechanic that delivers it — so the switcher answers "why would I pick this?" instead of "what does this look like?".

## New copy — dossier selector covers

| View | Current | New |
| --- | --- | --- |
| Horizontal | Days side by side — slide activities between them | Fix an overpacked day in seconds — days sit side by side, so activities slide between them |
| Vertical | The full read, top to bottom | Never lose your place — read the whole trip in one unbroken scroll |
| Grid | The whole trip at a glance | Catch the empty afternoon before you land — every day on one board |

## New copy — layout sheet on /t/&lt;slug&gt;

Same voice, trimmed so each row stays one line at 375px.

| View | Current hint | New hint |
| --- | --- | --- |
| Horizontal | Days side by side — slide activities between them | Move activities between days |
| Vertical | The editorial read, day by day | Read straight through, no jumping |
| Grid | The whole trip on one board | See where a day is empty |

## Technical notes

- `src/components/flow/DossierCover.tsx` (~lines 95-100): the caption ternary for `grid` / `horizontal` / `vertical`.
- `src/components/mobile/ViewSheet.tsx` (`OPTIONS`, lines 21-23): the `hint` strings for all three modes.
- `e2e/templates-mobile-visual.spec.ts` pins the cover captions in its `CAPTIONS` map — update all three entries in the same change so the 393px mobile regression test stays green.
- Text-only edits: no layout, art, token, or behavior changes. Cover captions keep the existing single-line uppercase treatment with reserved space, so CLS and contrast are untouched.
- The longer cover captions are checked at 375px and 393px; if a line runs past two lines in the cover, the mechanic clause is shortened rather than the outcome clause.
- Verification: `npx vitest run` (all pass), `tsc --noEmit` clean.
