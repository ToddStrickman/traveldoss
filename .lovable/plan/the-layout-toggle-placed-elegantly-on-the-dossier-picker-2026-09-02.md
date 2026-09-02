# The layout toggle, placed elegantly on the dossier picker

Understood. Nothing about sample trips, builders, or real itinerary content. While the visitor is picking a dossier, the layout toggle sits elegantly next to the cover, and the cover's abstract art shows what each view actually gives you. No inputs, no data, no commitment.

## The toggle

One control, placed with the cover rather than at the foot of the page: the glyph that reflects the active view (stacked rows / side-by-side columns / four squares), a wax-seal dot marking it active, the word LAYOUT in small caps, and a chevron showing it opens a chooser. Vertical is the default. It sits directly under the cover on mobile and beside it on desktop, so switching views is a glance away from the thing it changes and never a scroll.

Switching redraws the cover art in place — same cover, same size, same position. Nothing else on the page moves.

## The abstract art, per view

Still abstract, still drawn from each skin's own tokens — but each variant now expresses that view's real benefit instead of generic rule-work.

**Vertical — the photographic read.** Full-bleed image plates alternating with text columns down the page, two plates set beside each other where a comparison would sit. It reads as pictures and side-by-side comparisons flowing top to bottom.
Caption: "Photographs and comparisons, top to bottom"

**Horizontal — the kanban board.** Day columns standing side by side with small activity cards stacked in each, one card lifted and tilted mid-move with a dashed drop slot in the neighbouring column. It reads as drag-and-drop between days.
Caption: "Drag activities between days like a board"

**Grid — the structured table.** An even board of day tiles with aligned label/value rows, a shared column rule, and a header band, so it reads as everything structured and easy to scan.
Caption: "Everything structured, at a glance"

Each cover carries its caption under the art, in the existing small-caps register, so the benefit is stated as well as drawn.

## Nothing else changes

The selection grid, the cover rail, search, filters, and the mint flow all stay exactly as they are.

## Technical notes

- `src/components/flow/DossierCover.tsx`: `VerticalArt`, `HorizontalArt` and `GridArt` are redrawn to the three descriptions above, and the three captions are updated. Same props, same sizes (`sm` / `md` / `lg`), same reserved height per variant, so no caller changes and no layout shift. Image plates are token-filled blocks, not real images — the cover stays abstract and loads nothing.
- New `LayoutSwitcher`, reusing the glyph + seal-dot + chevron composition already built in `src/components/mobile/ViewSheet.tsx`, with the three-option chooser sheet. It replaces `BrowseToggle` in `src/routes/templates.tsx` and moves to sit with the cover (under it on mobile, beside it from `md`) instead of at the foot of the selection area.
- Default browse mode becomes `vertical`; the saved `templates:browse` preference still wins after mount.
- Skins are untouched; every colour comes from existing skin tokens, so all ten templates theme correctly.
- Analytics: keep the existing `template_browse_mode_changed` event — the moment is already captured. Nothing new to add.
- Accessibility: the switcher's accessible name is "Layout: Vertical. Change layout"; the art is `aria-hidden` with the caption carrying the meaning; captions keep the `color-mix` contrast rule; 44px tap targets; reduced motion disables the redraw transitions.
- Verify with `npx vitest run` and a typecheck, plus 375 / 393 / 430px checks for zero horizontal overflow, and update `e2e/templates-mobile-visual.spec.ts` for the new captions and the toggle's new position.
