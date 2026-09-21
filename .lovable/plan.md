# Live Map: remaining work after the account reset

## What changed just now

Your trips and every stale location record were deleted. That removes the whole
first phase of the previous plan:

- All of your dossiers (including the Sicily/Rome one) are gone; "My Trips" is empty.
- The location lookup cache is empty, so nothing carries the old failures forward.
- Nothing needs "un-poisoning" any more. The next trip you create starts clean.

7 trips remain in the system and they belong to other people.

## Where things stand

| Item | Status |
| --- | --- |
| Map rendering without Google (MapLibre + OpenFreeMap) | Done in code |
| Place lookups without any key (Photon, then Nominatim) | Done in code |
| Clearing the old Rome failures | Done — data deleted |
| Manual location editor per stop | Not built |
| Draggable / searchable map | Not built |

## Revised order of operations

### Phase 1 — Walk the flow yourself and publish

You wanted to go through the whole experience. Create one real trip, let the
automatic lookup run, open the map, and note any stop that lands wrong or not at
all. Then publish so the live site runs the keyless setup too.

No code changes in this phase. The output is a short list of real misses, which
tells us whether the editor in Phase 2 needs anything beyond coordinates.

### Phase 2 — Manual location editor per stop

Add a Location section to the existing "Edit place" sheet (the pencil on any
stop, every view, desktop and mobile):

- Address field already there; add a "Find this place" button beside it that
  re-runs the free lookup for just that stop and fills in the position.
- Latitude and longitude fields for the rare stop no service knows.
- A short status line: found, not found yet, or set by you.
- Anything you set by hand is marked as yours, so no later automatic pass or AI
  rewrite can overwrite it.

This is the escape hatch that guarantees no stop is ever permanently unmappable.

### Phase 3 — Map interaction

- Drag a pin while editing to correct its position; same "set by you" marking.
- A search/jump control in the map header to filter or jump to a day.
- Keep the full-screen overlay; the map does not get inlined into the reading
  page (it would crowd the layout and hurt mobile performance scores).

## Technical notes

- New per-stop editor UI goes in `src/lib/skins/shared/ActivityEditSheet.tsx`
  (shared, never a per-skin file), reusing `useEditing().onBlockChange` so edits
  coalesce into one undo step and ride the existing autosave.
- "Find this place" calls a new single-stop server function next to
  `src/lib/maps/locate.functions.ts`, reusing `resolveWithProviders` and the
  shared cache; the attempt cap and the never-cache-a-fault rule stay intact.
- Manual entries set `geocode.status = "manual"` on the `place` block so
  `enrichBlocksWithCoords` and `carryOverBlockFields` leave them alone.
- Phase 3 drag handling lives in `MapCanvas.tsx` / `DossierMap.tsx`, writing
  through the same block patch path as the sheet.
- Analytics in the same change: `stop_location_edited`,
  `stop_location_lookup_requested`, `map_pin_dragged`, carrying trip and view
  context only, documented in `docs/analytics/tracking-plan.md`.
- Tap targets 44px, reserved space for the status line so nothing shifts,
  reduced-motion respected. `bun test` and `npx tsgo --noEmit` green before done.
