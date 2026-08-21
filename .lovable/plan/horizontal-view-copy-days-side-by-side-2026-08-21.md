# Horizontal view copy: days side by side

The horizontal layout's real benefit is that days sit next to each other, so activities can be slid from one day to another. The current copy ("One day at a time", "Swipe through days side by side") describes scrolling, not that benefit.

## Copy change

- Dossier cover placeholder caption for the horizontal variant: "Days side by side — slide activities between them"
- Mobile layout sheet hint for Horizontal: "Days side by side — slide activities between them"

Grid and vertical copy stay as they are.

## Technical notes

- `src/components/flow/DossierCover.tsx` line ~98: replace the `"One day at a time"` string.
- `src/components/mobile/ViewSheet.tsx` line 22: replace the `hint` for the `horizontal` option.

Text-only edits; no layout, art, or behavior changes. Both strings stay short enough to fit the existing single-line caption and sheet row without wrapping issues at 375px.
