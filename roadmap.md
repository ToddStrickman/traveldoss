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
- [x] Phase 3 Horizontal Board: shared logistics selector/cards, Transit and Stay lanes,
      inline expansion, fixtures, and responsive verification
- [x] Phase 4: A5 print layout, browser PDF export, offline dossier reading,
      and view-native Now and next placements

## Templates
- [x] Use the carousel for every layout choice on desktop and mobile

## Live map / place lookups — fully keyless
- [x] Google Places removed entirely: `places-request.server.ts` and its tests
      deleted; no mapping code reads `GOOGLE_MAPS_API_KEY`
- [x] Provider ladder is Photon then Nominatim, both keyless
      (`src/lib/maps/geocode-providers.server.ts`); provider stored per stop
- [x] `place-lookup.server.ts` supplies address/phone/website/hours from OSM for
      parse-time enrichment (`enrichmentSource: "openstreetmap"`) and the
      suggest-location tool
- [x] "Open in maps" links point at OpenStreetMap (`osmPlaceUrl`)
- [x] Basemap style URL overridable via `VITE_MAP_STYLE_URL` (empty = the
      skin-tinted plate; `default` = OpenFreeMap Liberty)
- [x] parse-time enrichment prefers a stop's own address over the broad trip
      destination
- [x] Fault vs genuine-empty classification in `geo.server.ts`: faults are never
      cached and never count against the three-attempt cap
- [x] `apiKey` resolved at the call sites, so an explicit `undefined` disables
      enrichment
- [x] Server analytics: `geocode_resolved` (with `provider`, `cache_hit`),
      `geocode_faulted`, `geocode_needs_review`
- [ ] Data repair: clear 28 poisoned miss rows in `geocode_cache` and reset
      needs_review stops — BLOCKED, pending explicit user approval
