# Make the view switcher read as "Layout"

The bare four-squares button in the dossier top bar gets an explicit label, a glyph that reflects the layout you're currently in, and a small chevron so it's obvious it opens a chooser.

## What changes

- The trigger becomes: layout glyph + the word **LAYOUT** (small caps, tracked) + a chevron.
- The glyph changes with the active layout: stacked rows for Vertical, side-by-side columns for Horizontal, four squares for Grid — so the button also tells you where you are.
- A tiny wax-seal dot sits on the glyph corner as the "active view" mark, ringed in the bar's paper color so it stays crisp on all ten skins.
- Press feedback is a subtle scale/tint; the chevron nudges down. Both disabled under reduced-motion.
- Accessible name becomes "Layout: Grid. Change layout" so the visible word "Layout" is contained in it.
- The bar keeps its exact height and the button keeps a 44px tap target, so nothing shifts.

Scope is only this one trigger. The layout sheet itself, the mail button, and Edit are untouched.

## Technical notes

- Edit `src/components/mobile/ViewSheet.tsx` only — the `ViewPill` `inline` variant (used by `DossierMastheadBar`) becomes a labelled button; the `floating` variant keeps its current pill shape but picks up the same per-layout glyph and chevron.
- Colors come from existing tokens (`text-ink`, `bg-paper`, `text-seal`) — no hardcoded hex, so all skins theme correctly.
- Label uses the same `text-[10px] font-medium uppercase tracking-[0.3em]` register already used by the floating pill and the Edit button, not a new font.
- Analytics: keep the existing layout-change event; add nothing new since the moment is already captured.
- Verify with `npx vitest run` and a typecheck, and re-check the bar at 393px for zero horizontal overflow.
