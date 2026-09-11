# Roadmap

## Admin console — Amendment 1
- [x] Expiring, revocable investor snapshot links (/admin/s/:token)
- [x] Empty Paddle `purchases` ledger + "Revenue not switched on yet" panel state
- [ ] `trips.shape_id` (trip shape vs skin) + shape leaderboard
- [ ] Small-number mode (suppress % below base 20)
- [ ] Exclude internal/own traffic from panels
- [ ] `page_viewed` fan-out so the funnel has a real first step
- [ ] Insights Feed + detectors D1–D13 (later phase)

## In progress
- [x] Conversion funnel rendered as an actual tapering funnel shape (desktop),
      bar list retained for mobile

## Templates
- [x] Use the carousel for every layout choice on desktop and mobile

## Live map / Places provider
- [x] Shared `placesRequest` helper routing Places calls through the Lovable
      Google Maps gateway (`src/lib/maps/places-request.server.ts`)
- [x] parse-ai + suggest-location use the helper; parse-time enrichment prefers
      a stop's own address over the broad trip destination
- [ ] geo.server.ts / locate.functions.ts retry + error classification (owner is
      editing these on a separate branch)
- [ ] Data repair: clear 28 poisoned miss rows in `geocode_cache` and reset
      needs_review stops — BLOCKED, pending explicit user approval
