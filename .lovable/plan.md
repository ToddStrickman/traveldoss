# Phase 3: Horizontal Board logistics lanes

Build the Horizontal Board’s shared Transit and Stays lanes, backed by one logistics model and the same expanded flight and stay cards used throughout the dossier.

## Scope

- Add a shared logistics selector that derives trip days, changing cities, stay spans, gap nights, and local time fractions from existing blocks.
- Cover overnight, same-day handoff, westbound same-day, date-line crossing, and gap-night cases without inventing displayed times.
- Add reusable `FlightCard` and `StayCard` components, preserving private booking-reference masking.
- Use those shared cards in Horizontal expansion panels and replace the equivalent flight/stay detail cards in Vertical, Grid, and print-compatible surfaces.
- Recompose Horizontal into one shared scroll surface:
  - Transit lane above Stays lane above day columns.
  - Flight tabs and stay bands align to the same day-column geometry.
  - Lanes remain pinned while the board scrolls vertically.
  - City labels appear only when the city changes.
  - Today opens in view and receives an accent treatment.
- Expand a flight or stay inline below the lanes; re-tap or Escape closes it.
- Show dashed gap-night labels only to authenticated trip collaborators.
- Preserve activity drag-and-drop, mobile day paging, editing, reduced motion, accessibility, and existing skin behavior.
- Track `lane_item_expanded` without capturing itinerary content and document the event.

## Technical details

- Reconstruct only the selector fields required by the amendment because the referenced base Directive 09 is absent.
- Keep lane items and day columns in one CSS grid inside the existing horizontal scroller; do not synchronize separate scrollers.
- Calculate positions in day units plus local time fractions, with a minimum-width departure-anchored fallback when arrival does not sort after departure.
- Default missing stay times to 15:00/11:00 for geometry only; do not render them as known values.
- Alternate two token-derived stay shades and use existing skin tokens for all visuals.
- Treat owners and co-planners as trusted viewers for collaborator-only gap labels and booking details.

## Verification

- Add focused selector and interaction tests for all required fixtures and shared-card reuse.
- Keep the existing horizontal move tests green.
- Verify 360, 390, 768, and 1440 widths across Epictetus, Cassian, and Vesper, including one-scroll alignment and inline expansion.
- Run the full Vitest suite and TypeScript check required by the project; report any pre-existing failures separately.
