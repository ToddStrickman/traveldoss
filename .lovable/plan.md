# Mobile dossier selector: one horizontal motion, three honest previews

On a phone, picking a dossier should always feel the same: swipe sideways through covers. Today only "Horizontal" does that — "Grid" drops into a long vertical column of cards and "Vertical" into a stacked column, so you must scroll to the very bottom just to reach the switcher and change your mind. And all three modes show the exact same cover art, so the switcher promises three ways of seeing and delivers one.

## What changes

1. **All three modes swipe horizontally on mobile.** Grid and Vertical reuse the same snap-scrolling cover rail as Horizontal (same card size, dots, and Preview/Mint pair). Nothing on the selection area scrolls the page vertically to browse templates. Desktop is untouched: the 3D atelier table for Horizontal, the multi-column grid for Grid, the stacked column for Vertical.

2. **Each mode gets its own placeholder art**, so the difference is visible before you commit:
   - Horizontal — day cards receding sideways with a swipe arc, the "one day at a time" read.
   - Vertical — a continuous ribbon of day rules flowing top-to-bottom, the "whole story in one scroll" read.
   - Grid — a small board of day tiles, the "everything at a glance" read.
   All drawn from the skin's own tokens (accent, rule, ink, display font) exactly like the current cover, so all ten skins stay on-brand and contrast-safe. No real Lisbon content, no shrunken screenshots.

3. **The view switcher moves above the covers on mobile** (directly under the result count), so switching never requires scrolling. Desktop keeps its current placement.

4. **Horizontal stays the default** for a first-time visitor; a saved preference still wins on return.

## Technical notes

- `src/components/flow/DossierCover.tsx`: add a `variant?: "horizontal" | "vertical" | "grid"` prop (default `horizontal`) that swaps only the day-part placeholder region; foil edge, spine, seal, sheen, and sizing scales stay shared.
- `src/components/flow/AtelierTable.tsx`: `MobileCoverRail` takes a `variant` and forwards it to `CoverCard` → `DossierCoverArt`; `CoverCard` gains the same pass-through. Rail internals (snap centre tracking, dots, `scrollToIndex`) are reused as-is — no second rail implementation.
- `src/routes/templates.tsx`: render the mobile rail (`md:hidden`) for all three browse modes with the matching `variant`; keep the desktop branches gated behind `md:`/`hidden md:block` as they are now. Move the browse-mode toggle markup so it renders above the cover area on mobile and stays where it is at `md:` and up. Grid's `md:hidden` vertical card list is removed from the mobile path only.
- Fixed cover heights keep CLS at 0; dots and arrows already meet the 24px/44px tap-target rule via `.tap`.
- Analytics: the existing `template_switched`-style browse event fires on toggle with `mode` and `surface: "templates_mobile"`; add it to `docs/analytics/tracking-plan.md` in the same change if not already documented.
- Verification: `npx vitest run` and `tsc --noEmit` clean, plus a 393px-wide check that no mode introduces horizontal page scroll.
