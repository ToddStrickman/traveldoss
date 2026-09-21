# Directive 09, Amendment 1: View-native logistics

> Sits directly after Directive 09. Where the two conflict, this amendment wins.
> Directive 09 itself is not yet on file in `docs/directives/` — it must be added
> before this amendment can be built, since the amendment references its
> selector (`getTripLogistics`), Trip Manifest, compact row, `DETAIL_BY_VIEW`,
> `DAY_MARKERS`, and `NOW_NEXT` decisions.

## Recommendation

Keep one logistics selector and one visual vocabulary (FlightCard, StayCard, stay tints), and give each view a placement native to its own axis. Grid keeps the Trip Manifest. Vertical Timeline gets the Stay Rail. Horizontal Board gets Stay Lanes.

## Desired Outcome

- Grid: any flight or stay fact is findable in one glance.
- Vertical Timeline: at any scroll position, the reader knows where they sleep that night and what the next move is, without added cards.
- Horizontal Board: scanning across shows which nights are covered and exactly when each move happens.
- No view shows the same logistics fact twice.

## Steps (this ordering supersedes Directive 09, Section 5)

1. Phase 1: selector, shared FlightCard and StayCard components, and the Trip Manifest in Grid only. Vertical and Horizontal keep the old summary until their own phase replaces it, so no view is ever without logistics.
2. Phase 2: Vertical Timeline. Stay Rail, Route Line, flight chapter breaks, and context bar, merged with Directive 09's Vertical Timeline cleanup (inventory first).
3. Phase 3: Horizontal Board. Transit Lane and Stay Lane.
4. Phase 4: print route, PDF export, offline reading, and Now and next (Directive 09's former Phase 2 scope), with the placements in A5.

Print comes last so it inherits the finished components instead of being restyled twice. Offline caching does not depend on the other phases; pull it forward if a live trip needs it sooner.

## Superseded in Directive 09

- The compact row, and DETAIL_BY_VIEW for Vertical and Horizontal. Those views no longer use compact rows or the ribbon.
- DAY_MARKERS now apply to Grid and print only. Vertical and Horizontal express the same facts through their native elements. Never render both.
- NOW_NEXT placement follows A5.
- The separate Vertical Timeline cleanup phase merges into the new Phase 2.

## New decisions (defaults unless Todd changes them)

| Key | Default | Notes |
|---|---|---|
| STAY_TINTS | Consecutive stays alternate two shades of the skin's stay tint | The shade index is computed in the selector, so a stay has the same shade in every view. |
| DEFAULT_STAY_TIMES | 15:00 check-in, 11:00 check-out | Used only for positioning when times are missing. Never displayed as if known. |
| CONTEXT_BAR | On, Vertical only | Appears once the Route Line leaves the viewport. One line, 40px maximum. |
| ROUTE_LINE_MAX_STOPS | 6 | Beyond 6, the line scrolls horizontally inside its own container. |
| GROUND_CONNECTOR | Dotted, unlabeled | Used between consecutive stays in different cities with no flight between them. |

## Selector additions

`getTripLogistics` also returns:

- The city for each trip day, derived from stays.
- For each night: its index and the trip total, plus the stay shade index.
- A time fraction from 0 to 1 within its local day for every check-in, check-out, departure, and arrival.
- The home city, taken from the first flight's origin. If there is no flight, the Route Line starts at the first stay.

## A1. View intent

- Grid is the reference view: random access. The Manifest acts as a dashboard.
- Vertical Timeline is the story and the in-trip companion. It is read by scrolling on a phone, so logistics live on the rail the reader already follows.
- Horizontal Board is the planning view: days as columns on a wide screen. Logistics live in lanes locked to those columns.

## A2. Vertical Timeline: Stay Rail

1. **Route Line**, at the top of the view.
   - One horizontal line of stops: home city, each stay city with its night count, then home city again.
   - Connectors: solid with a plane glyph for flights, dotted for ground or unknown travel.
   - Tapping a stop scrolls to that stay's first day.
   - Replaces the ribbon in this view.
2. **Stay Rail.** The single continuous timeline rail (required by the cleanup rules) is tinted with the stay covering each night.
   - Where a stay starts, a small label sits on the rail: "{property} · in {time}".
   - Where it ends: "Check out {time}".
   - Nights with no stay get a dashed rail in the warning token. It is labeled "No stay booked" for owners and members; public viewers see a plain neutral rail.
   - In-transit nights show a thin rail with a plane glyph.
   - The rail replaces other per-day hotel mentions. It never adds to them.
3. **Flight chapter breaks.** Each journey renders as a full-width FlightCard.
   - Inserted in the timeline at its local departure time within the departure day.
   - Multi-leg journeys stack their legs in one card, with the layover between.
   - This card is the only place the flight appears in this view.
4. **Context bar.** Pinned once the Route Line scrolls out of view.
   - Left: "{weekday date} · {property, or 'No stay booked', or 'In transit'} · night {n} of {total}", for the day currently at the top of the viewport.
   - Right: the next flight after that day.
   - During trip dates, a "Today" control jumps to today.
   - Update it with IntersectionObserver, not scroll listeners.
   - It sits below any existing sticky header and never overlaps the mobile view switcher.

**Acceptance**

- On a 390px screen, at any scroll position, the context bar or a rail label shows where that night is spent.
- Flight cards sit at the correct local-time position within their day.
- The rail tint changes exactly on the check-in day. A same-day check-out and check-in shows both labels without overlap.
- Route Line taps scroll to the correct day.
- The per-item element count does not rise above the approved Phase 2 inventory.
- These fixtures render correctly: 7 nights across two cities; 14 nights across five cities; stays only; flights only.

## A3. Horizontal Board: Stay Lanes

1. **Lanes.** Two lanes sit above the day columns: Transit, then Stays.
   - Both live inside the board's own horizontal scroll container and use the same column widths, so they cannot drift out of alignment. Do not sync separate scroll containers with script.
   - Lanes pin to the top when the columns scroll vertically.
2. **Stay bands, positioned by time.**
   - A band starts at the check-in time fraction within the check-in day's column and ends at the check-out time fraction within the check-out day's column.
   - A same-day handoff shares one column: the outgoing band ends and the incoming band begins.
   - Label: property name and night count, with check-in and check-out times at the band edges when there is room. Labels truncate with an ellipsis; tapping still works.
3. **Flight tabs, positioned by time.** Each tab runs from the local departure time in the departure date's column to the local arrival time in the arrival date's column. An overnight flight visibly crosses the column boundary.
   - If the arrival position is at or before the departure position (westbound same-day flights, or crossing the date line), render a minimum-width tab anchored at departure, labeled "arrives {date time}".
   - Always show the true duration in the expanded card.
4. **Interaction.** Tapping a band or tab expands its StayCard or FlightCard as a panel directly under the lane, pushing the columns down.
   - Not a modal, and not a floating popover.
   - Escape, or tapping again, collapses it.
5. **Gap nights.** Shown as a dashed segment in the Stay lane. Labeled for owners and members only.
6. **Column headers** show the city name whenever it changes from the previous day.
7. **No duplication.** Day markers stay off in this view.

**Acceptance**

- At 1440px and 768px, band and tab edges land within 2% of column width of their true time fraction.
- Horizontal scroll moves lanes and columns together with no misalignment or lag.
- These fixtures render correctly: an overnight flight crossing a column boundary; a same-day handoff; a westbound same-day flight; a date-line crossing; a gap night.

## A4. Shared rules

- FlightCard and StayCard are the single implementations used everywhere: Grid, Vertical chapter breaks, Horizontal expanded panels, and print.
- Masking stays inside the selector.
- All colors, fonts, and radii come from skin tokens.
- Every phase includes screenshots in the same three skins at 360, 390, 768, and 1440px.

## A5. Now and next placement

| View | Placement |
|---|---|
| Grid | Card at the top of the view (Directive 09) |
| Vertical Timeline | Context bar with the "Today" control |
| Horizontal Board | The board opens scrolled to today, with today's column header in the accent |
| Print | None |

## A6. Analytics additions (Rule 9)

- route_stop_tapped
- context_bar_today_tapped
- lane_item_expanded {kind: flight | stay}

Update the tracking-plan doc in the same commit as each event.
