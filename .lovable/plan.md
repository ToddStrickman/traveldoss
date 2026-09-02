# Real trips on the templates page

Right now `/templates` shows abstract covers with placeholder rule-work labelled Morning / Evening / Night. A visitor never sees a real itinerary and can't try their own before minting. This adds a small builder, real content in every preview, the labelled layout switcher, and a side-by-side comparison of the three layouts.

## 1. The trip builder

A compact panel on `/templates`, headed "Try it with your trip", sitting above the layout comparison.

- Destination, start date, end date. Day count derives from the dates.
- Per day: add activities with an optional time and a slot (morning / afternoon / evening). Add, edit inline, remove, reorder within a day.
- A seeded sample trip (three days in Lisbon) is loaded on first visit so the page is never empty and never asks the visitor to type before seeing anything.
- The first edit replaces the sample everywhere on the page: covers, the comparison, and the layout previews all redraw from the typed trip.
- The draft is saved locally, so it survives a reload and a trip to the studio and back.
- "Open the full studio" links to `/plan`, which reads the same draft, and "Mint this dossier" carries the draft into the existing mint flow instead of an empty dossier.

Empty and partial states are honest: no destination yet reads "Your trip", a day with no activities shows an "add something" affordance rather than fake lines.

## 2. Real content in the previews

`DossierCoverArt` stops drawing Morning / Evening / Night placeholder lines and instead draws the actual day labels and the first activities of the draft trip, still in the skin's own tokens so covers stay legible at cover size. Long titles truncate with a visible indicator; the reserved space per line is unchanged so nothing shifts.

The benefit captions stay as they are (vertical "The full read, top to bottom", horizontal "Days side by side — slide activities between them", grid "The whole trip at a glance").

## 3. Labelled layout switcher

The browse switcher on `/templates` becomes the direction already approved for mobile: a glyph that reflects the active layout (stacked rows / side-by-side columns / four squares), a wax-seal dot marking it active, the word LAYOUT in small caps, and a chevron showing it opens a chooser. Vertical is the default. Tap targets stay 44px; the row keeps its current height.

## 4. Side-by-side comparison

A "Compare the layouts" section below the builder.

- Desktop: three panels next to each other — vertical, horizontal, grid — each a scaled, non-interactive render of the draft trip in the selected skin, with the layout name and its one-line benefit under it. Clicking a panel makes that layout the active one.
- Mobile: the same three panels as a sideways snap rail, one at a time with a neighbour bleed, matching the rail pattern already used for covers.
- The panels have fixed heights so mounting them causes no layout shift.

## Technical notes

- New `src/lib/trip-draft.ts`: the draft type (destination, startDate, endDate, days with slotted activities), a Lisbon seed, localStorage load/save under `td_trip_draft_v1`, and a `toBlocks()` adapter producing the existing `Block[]` union from `src/lib/skins/types.ts` (day + place blocks) so every existing renderer works unchanged.
- New `src/components/flow/TripDraftBuilder.tsx` (form) and `src/components/flow/LayoutComparison.tsx` (three scaled `InertRender` panels using `skin.Render` with `view="vertical" | "horizontal" | "grid"`). Scaling reuses the measured-`ResizeObserver` approach already in `SkinPreview` in `src/routes/templates.tsx`.
- `DossierCoverArt` in `src/components/flow/DossierCover.tsx` gains an optional draft prop; `VerticalArt` / `HorizontalArt` / `GridArt` render real day labels and activity titles when it is present and keep today's placeholder lines when it is not, so `/t/<slug>` and the homepage rail are unaffected.
- The switcher is a new `LayoutSwitcher` in the templates page reusing the glyph + seal-dot + chevron composition from `src/components/mobile/ViewSheet.tsx`; `BrowseToggle` is replaced. Default browse mode changes from `horizontal` to `vertical`, and the stored preference still wins after mount.
- Skins are untouched. All colour comes from existing skin tokens and semantic classes — no hardcoded hex, so all ten skins theme correctly.
- Analytics (`src/lib/analytics.ts`, documented in `docs/analytics/tracking-plan.md` in the same change): `trip_draft_started` (first edit), `trip_draft_activity_added` (with day index and counts only, never activity text), `layout_comparison_viewed`, `layout_compared_selected` (with `view`), reusing the existing `template_browse_mode_changed` for switcher changes.
- Accessibility: the builder is real labelled inputs, the comparison panels are buttons whose accessible name contains the visible layout name, and the switcher's name is "Layout: Vertical. Change layout". Reduced motion disables the panel transitions.
- Verify with `npx vitest run` and a typecheck, plus a 375 / 393 / 430px check for zero horizontal overflow, and extend `e2e/templates-mobile-visual.spec.ts` to assert the comparison rail scrolls sideways without page overflow.
