# One Lisbon sample, simply shown

The templates page stays as it is. No builder, no forms, no draft, nothing saved. The only thing added is a simple way to look at the one sample — Lisbon — in any template and any of the three layouts. The visitor puts nothing in until they mint.

## What gets added

**A single "See the Lisbon sample" entry.** One clear control on `/templates`. It opens the Lisbon dossier rendered in the template currently selected — the real, finished, five-day guide content that already exists in the project.

**The layout pivot, inside the sample view.** The switcher is the approved direction: a glyph that reflects the active layout (stacked rows / side-by-side columns / four squares), a wax-seal dot marking it active, the word LAYOUT in small caps, and a chevron showing it opens a chooser. Vertical is the default. Choosing horizontal or grid re-renders the same Lisbon trip in that layout.

**A way to change template without leaving.** Inside the sample view, the visitor can step to the next or previous template and the Lisbon content stays put, so the comparison is design against design.

**One exit that matters.** "Mint this dossier" from inside the sample view, going into the existing mint flow unchanged. Composing a real trip still happens only after that commitment.

That's it. The selection grid, the cover rail, the search, the filters and the abstract covers all stay exactly as they are.

## Technical notes

- New `src/lib/skins/sample-trip.ts`: the showcase `TripView` and `Block[]`, derived from `lisbon.blocks` in `src/content/guides/lisbon.ts` so the copy has one source of truth and nothing is duplicated or separately maintained.
- The sample view reuses the existing `SkinPeek` surface (`src/components/mobile/SkinPeek.tsx`) rather than adding a route, feeding it the Lisbon blocks and a layout state. No new route, no persistence, no server functions, no schema change.
- The layout control is a new `LayoutSwitcher` reusing the glyph + seal-dot + chevron composition already built in `src/components/mobile/ViewSheet.tsx`, passing `view` through to `skin.Render`.
- `DossierCoverArt` and the covers are untouched — they keep their abstract art.
- Skins are untouched; all colour comes from existing skin tokens.
- Analytics (`src/lib/analytics.ts`, documented in `docs/analytics/tracking-plan.md` in the same change): `sample_dossier_opened` (with `template_id`), `sample_layout_switched` (with `view`), `sample_template_stepped`. No content, no PII.
- Accessibility: the switcher's accessible name is "Layout: Vertical. Change layout"; 44px tap targets; reduced motion disables the transitions.
- Verify with `npx vitest run`, a typecheck, and 375 / 393 / 430px checks for zero horizontal overflow.
