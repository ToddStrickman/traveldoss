# Lovable handoff: the Live Map (v2, Phase 1)

Written 2026-09-07 for the Lovable agent that edits `main`. Read this before
touching anything under `src/components/map`, `src/lib/maps`, the geocoding
code in `src/lib/itinerary`, or the Map controls in the dossier chrome. The
full plan with every design decision is `07-live-map-v2.md` in this folder.

## The short version

TravelDoss's homepage promises "every place pinned, categorized, and routed by
day on a live map". Until September 2026 the map was a Google Maps overlay
reachable only from a small pill in each day header, with identical numbered
circles for every stop and a stock Google basemap. The owner reviewed a plan
on 2026-09-07 and approved three decisions:

1. **A persistent Map control** in the existing chrome: the mobile masthead
   (beside Days) and a fourth segment of the desktop vertical / horizontal /
   grid pills. The day-header pills stay. **Never a floating button** (owner
   correction from 2026-07-13, still in force).
2. **MapLibre GL JS over OpenFreeMap vector tiles** replaces Google Maps JS.
   The map is styled from each skin's tokens so it looks like the dossier,
   costs nothing per view, and needs no browser API key. Google Places is
   still used **server-side** for address lookups.
3. **Scope:** every dossier surface now; a cross-trip "Atlas" on My Trips is a
   later phase; nothing on the landing page, templates or guides (an option
   that doesn't exist shouldn't be present).

Plus one refinement from the owner: roads, footpaths and a *curated* set of
traveller points of interest (restaurants, bars, cafés, museums, parks) appear
as the user zooms in, drawn in the skin's ink. Fast food, hotels and services
are deliberately excluded so the traveller's own stops stay the hero.

## What is where

| Piece | File | Notes |
| --- | --- | --- |
| Overlay shell (header, day chips, Route / Plan B toggles, fit + zoom, caption, focus trap) | `src/components/map/DossierMap.tsx` | Owned once by `SkinFrame`; plots only stops visible on screen at open time, plus the opened day |
| MapLibre canvas | `src/components/map/MapCanvas.tsx` | Lazy `import("maplibre-gl")`; HTML pins via React portals; dotted route layers; reports `error` so the shell can fall back |
| No-tiles fallback | `src/components/map/MapParchment.tsx` | Own Web-Mercator projection on the skin's paper; used when WebGL2 or the tile source is unavailable |
| Pin | `src/components/map/MapPin.tsx`, `map.css` | A `<button>` with a category glyph from `src/lib/skins/shared/CategoryIcon.tsx` |
| Style generator | `src/lib/maps/map-style.ts` | Skin tokens → MapLibre style JSON; light and dark recipes; zoom-gated detail |
| Marker taxonomy and colours | `src/lib/maps/taxonomy.ts`, `color.ts` | Category → marker kind; fills pushed until AA contrast on every skin (tested) |
| Read model | `src/lib/maps/build-map-places.ts` | `Block[]` → places, visits, route segments, unlocated list, bounds. Pure, tested |
| Open/close state | `src/lib/maps/use-map-param.ts` | Tiny store synced with `?map=trip` / `?map=day-N` by the dossier route |
| Chrome controls | `src/components/mobile/DossierMastheadBar.tsx`, `src/components/ViewSwitch.tsx` | `onOpenMap` / `mapOpen` / `mapAvailable` props |
| Geocoding | `src/lib/itinerary/geo.server.ts`, `parse-ai.functions.ts`, `src/lib/maps/geocode-cache.server.ts` | Shared `geocode_cache` table, `places.id` stored as `placeId`, 3-attempt cap |
| AI round-trip protection | `src/lib/itinerary/carry-over.ts`, used by `refine.functions.ts` | Restores lat/lng, placeId, geocode status, photos, link titles that the text brief cannot carry |
| Block fields | `src/lib/skins/types.ts` (`place`) | `placeId`, `geocode`, `mapHidden` (all optional) |
| Migration | `supabase/migrations/20260907120000_geocode_cache.sql` | Server-only table, no client policies |
| Tests | `tests/map-*.test.ts`, `carry-over.test.ts`, `geocode-attempt-cap.test.ts` | Run with `bun test src tests` |
| Analytics | `docs/analytics/tracking-plan.md`, "Live Map" section | `map_opened`, `map_closed`, `map_pin_selected`, … counts and kinds only |

## Do not undo these (each one was a real bug or an owner decision)

- **Do not reintroduce Google Maps JS, `@googlemaps/*`, or a browser map key.**
  `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` is no longer read. The
  server-side `GOOGLE_MAPS_API_KEY` (Places lookups at mint and save) stays.
- **Keep the worker import in `MapCanvas.tsx`:**
  `import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"`
  followed by `setWorkerUrl(...)`. MapLibre 6 otherwise spawns its worker from
  a URL relative to its own module, which both Vite dev and the production
  build break (404, map hangs on "Plotting your dossier…").
- **Keep the URL tokens `map=trip` and `map=day-N`.** A bare `1` gets
  JSON-quoted by TanStack Router (`?map=%221%22`).
- **Keep `carryOverBlockFields` in `refineItineraryAiCore`.** Refine and
  harden re-parse a text brief; without the carry-over every AI pass erased
  coordinates, Places ids, photos and link titles from every stop.
- **Keep the geocode attempt cap and the cache.** A stop Google cannot find
  used to be looked up again on every save, forever, on a paid tier. Manual
  fixes (`geocode.status === "manual"`) must never be overwritten.
- **Skins are content.** The map reads `SkinTokens`; never edit a skin's
  file to make the map look right. Add rules to `map-style.ts` instead.
- **The style is generated, not fetched.** Do not point the map at a hosted
  style URL (`/styles/liberty` etc.); the plate must derive from the skin.
- **Basemap POIs stay quiet and curated.** Dots from zoom 15, names from 17,
  classes limited to what a traveller would glance at. Do not add lodging,
  fast food, shops or services back into `POI_*` in `map-style.ts`.
- **Contrast is tested.** `tests/map-taxonomy.test.ts` asserts every pin fill
  clears 4.5:1 against every skin's paper; `tests/map-style.test.ts` asserts
  the zoom gates. Keep both green.

## How to check your work

- `bun test src tests`, `tsc --noEmit`, `bun run build` must all pass. The
  build must emit `maplibre-gl-*.js` **and** `maplibre-gl-worker-*.js` as
  separate chunks under `.output/public/assets`; nothing map-related belongs
  in the entry chunk beyond the small overlay shell.
- Dev harness, no database needed: `/e2e/dossier?skin=marguerite&map=trip`
  (light), `/e2e/dossier?skin=vesper&map=day-2` (dark, day focus). Check
  1280 px and 375 px. The browser back button must close the map.
- Console must show no application errors. Tile requests go to
  `tiles.openfreemap.org`; fonts to `tiles.openfreemap.org/fonts`.

## Deploy notes

- The `geocode_cache` table was created on the live database by the Lovable
  agent on 2026-09-07 (migration `20260907210812_…`, with `created_at` /
  `updated_at` and a trigger). The app's writes use only the columns both
  definitions share, and the duplicate migration from PR #52 was removed so
  a fresh environment runs one `CREATE TABLE`. Keep the table server-only:
  no RLS policy for clients on purpose.
- **"Locate stops"** (`src/lib/maps/locate.functions.ts`) is the owner's
  on-demand geocode pass: up to 24 stops per call, cache first, attempt cap
  honoured, result persisted through the user's RLS-scoped client. The map
  runs it automatically once when an owner opens it on unlocated stops, and
  offers a button after that. Viewers never see it. It needs
  `GOOGLE_MAPS_API_KEY` on the server; without it the map says so plainly
  instead of promising a fix.
- Observed 2026-09-07: regenerated types on `main` still listed `google_tokens`
  and `places`, which suggests the drop migrations from earlier PRs have not
  been applied to the live database. Worth checking in the Supabase
  dashboard after a Publish.

## What comes next (owner-approved roadmap, not yet built)

- **Phase 2:** desktop docked place-detail panel and the extended mobile
  place sheet (photo, editorial note, reservation, hours, directions with
  Apple/Google choice, "open in dossier", next/previous stop), owner tools
  ("fix this pin" by drag or search, "hide from map"; "locate stops" already
  shipped), hop arcs for long jumps, overlap nudging, photo medallion pins,
  route draw-on animation.
- **Phase 3:** stable `block.id`, a derived `trip_places` index, the
  cross-trip Atlas on `/app` with clustering, category and city chips,
  taxonomy expansion (coffee, bar, shopping, wellness) through one module and
  the three AI schemas, a per-day "show walking route" toggle, self-hosted
  Protomaps tiles on Cloudflare R2 as the resilience hedge.

## Paste-ready brief for the Lovable agent

> The Live Map was rebuilt in September 2026 (PR #52, directive
> `docs/directives/07-live-map-v2.md`, handoff
> `docs/directives/LOVABLE_HANDOFF_LIVE_MAP.md`). It now uses MapLibre GL JS
> over OpenFreeMap vector tiles, styled from each skin's tokens, opened from a
> persistent Map control in the masthead and the desktop view pills as well as
> the day-header pills, with `?map=trip` / `?map=day-N` in the URL. Google
> Maps JS and the browser map key are gone on purpose; Google Places remains
> server-side for address lookups with a shared `geocode_cache` table and a
> three-attempt cap. Before changing anything map-related, read the handoff's
> "Do not undo these" list, keep `bun test src tests`, `tsc --noEmit` and
> `bun run build` green, and verify on `/e2e/dossier?skin=marguerite&map=trip`
> at 1280 px and 375 px.
