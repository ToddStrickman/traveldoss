# Phase 4: A5 print, PDF export, and offline reading

Build a dedicated, print-native dossier that inherits the finished logistics model and shared cards, then make previously opened public dossiers dependable without a connection.

## Scope

- Add an A5 portrait print composition for every dossier, independent of the selected screen layout.
  - Print the trip cover and a compact day-by-day vertical itinerary.
  - Place shared `FlightCard` and `StayCard` details at the relevant day boundaries.
  - Include print-only day markers for flights, stays, check-ins, check-outs, and uncovered nights where appropriate.
  - Omit Now and next, editing controls, sheets, map controls, collaboration controls, and all other app chrome.
  - Preserve each skin’s colors and typography while preventing day sections and logistics cards from splitting across pages.
- Make “PDF” use the browser’s print-to-PDF flow with A5 paper defaults.
  - Temporarily enter print mode, wait for fonts and images, print, then restore the exact prior view and state after printing or cancellation.
  - Keep PDF export available to public viewers and record the existing privacy-safe export audit event.
- Finish offline dossier reading.
  - Generate proper 192px, 512px, and maskable app icons and update the install manifest.
  - Cache only public dossier navigations and the safe read-only data requests needed by in-app view changes; never cache authenticated workspace, owner-only, API, auth, invite, or OAuth responses.
  - Add a quiet dossier-only offline status strip under the mobile masthead.
  - Add “Keep offline” to the existing mobile dossier sheet; warm the current dossier and all three view variants, then show success or failure feedback.
  - Preserve the existing service-worker safety guards and `?sw=off` kill switch.
- Complete view-native Now and next behavior only where Phase 4 requires it:
  - Grid: a top summary card.
  - Vertical: retain/use the context bar and Today control.
  - Horizontal: retain opening at today with the accented current column.
  - Print: no Now and next element.
- Add privacy-safe analytics for offline saving and its failure state, and document the events.

## Technical details

- Build the print document from the shared logistics selector rather than printing Horizontal Board geometry or duplicating logistics parsing.
- Reuse the exported `FlightCard` and `StayCard`; adapt their layout through print CSS instead of creating print-only card implementations.
- Use CSS `@page { size: A5 portrait; }`, physical margins, print color adjustment, and page-break rules; do not add server-side PDF rendering.
- Keep offline warming client-side with same-origin `GET` requests so Workbox stores public route HTML naturally.
- Confirm the real TanStack read request pattern before adding any runtime cache matcher; default to navigation-only caching if no safe public-only data pattern can be proven.

## Verification

- Add focused tests for print composition, shared-card reuse, offline URL warming, cache allow/deny rules, and online/offline state changes.
- Generate actual A5 PDFs from the long dossier fixture in Epictetus and Cassian, render every page to images, and inspect for clipping, overlap, broken typography, missing logistics, and bad page breaks.
- Verify public visitor export and mobile offline controls at 375px, plus screen regressions at 768px and 1440px.
- Run the full project test suite and TypeScript check; report pre-existing failures separately.
