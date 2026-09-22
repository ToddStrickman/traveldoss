# Directive 09 logistics: how the amendment maps onto what exists today

Directive 09 itself is still not on file — only Amendment 1 is (`docs/directives/09-amendment-1-view-native-logistics.md`). So this plan derives the base pieces the amendment leans on (the selector and the Manifest) from the amendment's own text, and reconciles them with the code already in the dossier.

## What already exists (verified in the code)

- `buildItinerary` (`src/lib/skins/shared/itinerary.ts`) groups blocks into days and part-of-day buckets, and **lifts both flights out of the stream** into `flights.outbound` / `flights.inbound`.
- `collectHotelStays` (`HotelsQuickRef.tsx`) already infers stay windows: a stay runs until the next different hotel, repeats of the same hotel collapse, nights come from ISO day dates or day-number difference.
- `collectFlights` + `FlightStrip` / `FlightTableRow` render flight detail (duration, gate, seat, baggage) per view.
- `CalendarQuickRef` already groups flights + hotel + stops per day.
- Stays are ordinary `place` blocks with `category` accommodation/stay/hotel, plus optional `checkIn` / `checkOut` time strings. Day dates live on `day.date` (ISO or free-form). Blocks have no stable id — everything is index-identified.

So the trip has all the raw facts; what it lacks is one shared, view-agnostic reading of them.

## The reconciliation, in short

1. **One selector, built from the two collectors that already work.** `getTripLogistics(blocks)` replaces the ad-hoc per-view logic. It reuses `collectHotelStays`' window inference and `collectFlights`, then adds what the amendment asks for: city per trip day, night index + trip total, alternating stay shade index, a 0–1 time fraction per check-in / check-out / departure / arrival (using the 15:00 / 11:00 defaults for positioning only, never displayed as known), and the home city from the first flight's origin (falling back to the first stay).
2. **One visual vocabulary.** `FlightCard` and `StayCard` in `src/lib/skins/shared/logistics/`, built from the field lists the existing flight row and hotel card already render, so Grid, Vertical chapter breaks, Horizontal panels and print all share one implementation.
3. **Existing panels stay until their view's phase lands.** The amendment's no-duplication rule bites on the three summary surfaces already shipped. Proposal: in Grid, the Manifest supersedes `FlightStrip` and `HotelsQuickRef`, and `CalendarQuickRef` stays (it is a per-day agenda, not a logistics summary). Vertical and Horizontal keep their current strip and panels untouched in Phase 1, and lose them in Phases 2 and 3 when the Stay Rail and Stay Lanes replace them.
4. **Masking lives in the selector only.** Gap-night labels, confirmation numbers and the "No stay booked" wording are resolved once, against the existing `useTrustedViewer` signal, so no view can leak a private fact.

## Data gaps worth naming up front

- **Nights are inferred, not booked.** Stay windows come from day adjacency, so a stay's real check-out date is only as good as the day dates. Undated itineraries get night indexes by day position and no time fractions — the Stay Rail still tints, the Horizontal bands fall back to full-column width.
- **Flights are lifted out of days today.** The selector reads raw blocks (like `CalendarQuickRef` does) rather than `buildItinerary`, so a flight keeps its own day and local time. Mid-trip flights, which `buildItinerary` currently drops from the strip, become first-class.
- **Ground moves between cities** have no block kind, so the dotted ground connector is drawn wherever consecutive stays change city with no flight between them.

## Scope of this plan: Phase 1 only

- `src/lib/skins/shared/logistics/selector.ts` — `getTripLogistics`, pure, unit-tested against the amendment's fixtures (7 nights / 2 cities, 14 nights / 5 cities, stays only, flights only, gap night, overnight flight, same-day handoff).
- `src/lib/skins/shared/logistics/FlightCard.tsx` and `StayCard.tsx` — skin-token only, mobile-first, reserved space so CLS stays 0, tap targets ≥44px, small text through the approved `color-mix` contrast rule.
- `TripManifest.tsx` — the Grid dashboard: flights and stays as one glanceable block, expanding into the shared cards.
- Wire the Manifest into `GridView` in place of `FlightStrip` + `HotelsQuickRef`; Vertical and Horizontal untouched.
- Selector + card tests, `bun test` green and `npx tsgo --noEmit` clean.
- Analytics (Rule 9): `manifest_item_expanded {kind}` for Phase 1; `route_stop_tapped`, `context_bar_today_tapped`, `lane_item_expanded` ship with Phases 2 and 3. `docs/analytics/tracking-plan.md` updated in the same change.
- Screenshots in three skins at 360 / 390 / 768 / 1440px.

Phases 2 (Stay Rail, Route Line, context bar), 3 (lanes) and 4 (print, PDF, offline, now-and-next) follow as separate builds on the same selector.

## One thing I need from you

Directive 09's own text would settle two things this plan currently decides for itself: the exact contents and ordering of the Trip Manifest, and which of the existing summary panels it is meant to absorb. If you paste it, I'll fold it in before building; otherwise I'll build to the reading above.
