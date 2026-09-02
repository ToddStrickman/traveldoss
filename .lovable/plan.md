# The Lisbon showcase on the templates page

Agreed — no builder here. The templates page should hand the visitor a finished, beautiful dossier to admire, not a form to fill in. One curated sample trip (Lisbon), rendered flawlessly in every template and every layout. Composing a real trip stays where it already lives: after they commit dates and a destination.

## The sample trip

Lisbon, five days, drawn from the existing Insider Guide content — real days, real places, real notes, hotel and flight detail, photos. It is already written and edited; nothing new gets invented, and there's no content to maintain separately.

Every preview on `/templates` renders this one trip, so switching template or layout only ever changes the design, never the subject. Nothing is editable and nothing is saved: the page reads as a finished object.

## 1. Real content in the covers

The covers stop drawing placeholder rule-work labelled Morning / Evening / Night and instead show the sample trip's actual day labels and first activities, set in each skin's own tokens so they stay legible at cover size. Long titles truncate with a visible indicator, and the reserved space per line is unchanged so nothing shifts.

The layout benefit captions stay exactly as they are.

## 2. Labelled layout switcher

The layout control becomes the approved direction: a glyph that reflects the active layout (stacked rows / side-by-side columns / four squares), a wax-seal dot marking it active, the word LAYOUT in small caps, and a chevron showing it opens a chooser. Vertical is the default. 44px tap targets; the row keeps its current height.

## 3. Side-by-side layout comparison

A "See it three ways" section under the template selection, showing the Lisbon dossier in the currently selected template.

- Desktop: three panels next to each other — vertical, horizontal, grid — each a scaled, non-interactive render of the real trip, with the layout name and its one-line benefit beneath. Clicking a panel makes that layout the active one.
- Mobile: the same three panels as a sideways snap rail, one at a time with a neighbour bleed, matching the rail already used for the covers.
- Fixed panel heights so mounting causes no layout shift.
- A closing line and the existing mint call to action directly under the comparison: this is the moment the visitor decides.

## 4. Reading the whole thing

"Read the full Lisbon sample" links to the existing Lisbon guide page, where the same trip renders full size and interactive. That is the deep look, already built, with nothing new to own.

## Technical notes

- New `src/lib/skins/sample-trip.ts`: exports the showcase `TripView` and `Block[]` derived from `lisbon.blocks` in `src/content/guides/lisbon.ts` — the single source of truth. Trimmed to the day/place/note blocks that read well at preview scale, plus a hero. No duplicated prose.
- New `src/components/flow/LayoutComparison.tsx`: three scaled `InertRender` panels calling `skin.Render` with `view="vertical" | "horizontal" | "grid"`, reusing the measured-`ResizeObserver` scaling already in `SkinPreview` in `src/routes/templates.tsx`.
- `DossierCoverArt` in `src/components/flow/DossierCover.tsx` gains an optional sample prop; `VerticalArt` / `HorizontalArt` / `GridArt` draw real day labels and activity titles when it is present and keep today's placeholder lines when it is not, so `/t/<slug>` and the homepage rail are unaffected.
- New `LayoutSwitcher` in the templates page reusing the glyph + seal-dot + chevron composition from `src/components/mobile/ViewSheet.tsx`; `BrowseToggle` is replaced. Default browse mode changes from `horizontal` to `vertical`; the stored preference still wins after mount.
- No new routes, no persistence, no server functions, no schema changes — this is presentation only.
- Skins are untouched. All colour comes from existing skin tokens and semantic classes.
- Analytics (`src/lib/analytics.ts`, documented in `docs/analytics/tracking-plan.md` in the same change): `layout_comparison_viewed`, `layout_compared_selected` (with `view`), `sample_dossier_opened` (the full-read link), reusing `template_browse_mode_changed` for switcher changes. No content or PII.
- Accessibility: comparison panels are buttons whose accessible name contains the visible layout name; the switcher's name is "Layout: Vertical. Change layout"; small text uses the existing `color-mix` contrast rule; reduced motion disables panel transitions.
- Verify with `npx vitest run` and a typecheck, plus 375 / 393 / 430px checks for zero horizontal overflow, and extend `e2e/templates-mobile-visual.spec.ts` to assert the comparison rail scrolls sideways and shows real Lisbon content.
