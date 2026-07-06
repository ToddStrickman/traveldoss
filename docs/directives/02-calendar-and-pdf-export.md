# Directive 2 — Calendar & PDF Export (finish and surface what exists)

## Objective
Any dossier — including a public one viewed by a visitor — can be exported as
(a) an `.ics` file covering flights, stays, **and timed activities**, and
(b) a clean paginated PDF via the browser print path.

## Why
Travel happens in calendars, and people want paper. Both halves are ~70%
built; this directive is mostly *finishing and surfacing*, which is why it's
the cheapest high-value item on the list.

## Current state
- `src/lib/ics.ts` builds a spec-correct ICS blob for **flights** (one VEVENT
  per leg) and **accommodation** (check-in → check-out span), with a
  documented floating-time policy (no TZID — correct for itineraries; read
  the file header before changing this).
- It's wired into `src/components/studio/ExportMenu.tsx`, rendered from
  `t.$slug.tsx` (~line 577) with an `isOwner` prop; the Google-Doc export
  entry is owner-gated (~line 159). **Verify which entries visitors see.**
- Print CSS partially exists: `@media print` blocks in
  `src/lib/skins/shared/skin.css` (~482, ~784) and `src/styles.css` (~255).

## Work

### A. Extend ICS to timed activities
1. In `ics.ts`, emit a VEVENT for each `place` block with a `time`, using the
   enclosing `day` block's `date` for the calendar date. `day.date` is
   free-form ("Oct 14", ISO, …) — resolve it with the existing date logic in
   `src/lib/itinerary/temporal.ts` rather than writing a new parser; if
   resolution fails, skip the block and count it in `breakdown`.
2. Map fields: `LOCATION` ← `address`, `DESCRIPTION` ← `note` + `reservation`,
   `URL` ← `ticketLink` || `mapsUrl` || `website`. Default duration 60 min;
   use `checkIn`/`checkOut`, `doorOpen`, or `duration` when present.
3. Exclude `tier: "shadow"` blocks (Plan-B alternatives don't belong in a
   calendar).
4. Unit-test in the existing vitest style (`normalize-ai.test.ts` is the
   pattern): date resolution across formats, text escaping (commas,
   semicolons, newlines per RFC 5545), shadow exclusion, empty-time skip.

### B. Surface export on the visitor path
ICS export is safe for public dossiers. Ensure visitors can reach it on
mobile: add an "Add to calendar" row to the existing day-jump or view sheet
(components in `src/components/mobile/`), reusing `buildItineraryIcs` +
`downloadIcs`. Keep the one-primary-action-per-screen budget from the design
brief — a sheet row, not another floating button.

### C. PDF v1 = print done properly
1. Audit the three `@media print` blocks against a real print preview of a
   long fixture (`/e2e/dossier` has `DEMO_TRIP`/`DEMO_BLOCKS`).
2. Required: hide app chrome (masthead bar, view pill, StudioBar, sheets);
   `break-inside: avoid` on `.tds-day-section` and flight cards; force
   vertical-view composition regardless of `?view=`; `print-color-adjust:
   exact` so dark skins keep their panels (test Epictetus AND Cassian).
3. Add "Download PDF" to ExportMenu → `window.print()`. If the current view
   isn't vertical, switch via the existing `setLayout` before printing and
   restore after (`beforeprint`/`afterprint` or just do it around the call).
4. **Do not** build server-side PDF rendering — Lovable hosting can't run
   headless Chromium. If pixel-perfect PDFs become a requirement later,
   that's a separate directive with an external rendering service.

## Definition of done
- [ ] Exported ICS imports cleanly into Google Calendar and Apple Calendar;
      activities land on the correct local dates/times.
- [ ] Visitor (not owner) can export ICS from a public dossier on a 375 px
      viewport.
- [ ] Print preview: every day starts intact (no mid-card page breaks), no
      app chrome, dark skins keep their look; verified on 2+ skins.
- [ ] New unit tests pass; `vitest` + `tsc` green.
- [ ] No edits to any skin `Render` file.
