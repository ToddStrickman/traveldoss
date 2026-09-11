# Live map failure on /t/orsino-yhpv2w — diagnosis and recovery

## What is actually wrong

The map has no pins because **every single location lookup this app has ever
made has failed**, not because the place names are bad.

Evidence:

- All 28 stops on that dossier carry full, unambiguous addresses ("Pantheon and
  Piazza Navona, Piazza della Rotonda, 00186 Roma RM, Italy", "Monreale
  Cathedral, Piazza Vittorio Emanuele II, 90046 Monreale PA, Italy"). All 28
  have no coordinates and all 28 are marked needs_review.
- The shared lookup cache contains **28 rows, 100% of them failures**, all
  written inside one 24-minute window (2026-09-07 21:40–22:04 UTC). A working
  provider with these addresses would produce a near-100% hit rate.
- I ran one lookup for "Pantheon, Rome, Italy" through the Lovable-managed
  Google Maps connection: **HTTP 200**, correct coordinates
  (41.8986108, 12.4768729). So the map provider and this workspace's
  Google Maps access are healthy.

Root cause: the lookup code calls Google's Places service **directly** and
signs the call with `GOOGLE_MAPS_API_KEY`. In this project that variable is
**not** a Google key — it is the connector connection key for the Lovable
Google Maps gateway (secrets list marks it "managed by connector"). Google
rejects it, the code turns every non-OK response into a silent "not found",
records a failure in the shared cache, and burns one of three attempts. Three
saves later every stop is needs_review. The same direct-to-Google pattern
exists in three places: `src/lib/itinerary/geo.server.ts`,
`src/lib/itinerary/parse-ai.functions.ts`,
`src/lib/itinerary/suggest-location.functions.ts` — so AI-parse enrichment and
the location suggester are failing silently for the same reason.

Preview vs live: no difference. Both run against the same secrets and the same
database, and the poisoned cache and needs_review flags live in shared data.

## Why "retry" cannot rescue it today

Two independent locks, both must be cleared:

1. The 28 failure rows are cached for 7 days from 2026-09-07, so they are still
   live until ~2026-09-14. Any retry short-circuits on the cache and never
   reaches the provider.
2. Every stop sits at attempts = 3 / needs_review, which the automatic pass
   skips permanently. Only an explicit owner "retry" flag bypasses it.

## Ownership question — no leak

`public.trips` has exactly four policies; SELECT is `auth.uid() = user_id`.
There is no public/anon SELECT policy, and `anon` has no SELECT grant. So the
ownership comment in `locateTripPlaces` is accurate: a non-owner cannot read
another person's trip through it. Public dossier viewing runs on a separate
admin-client read in `trips.functions.ts`, as intended. One hygiene note, not
a live exposure: `anon` holds an UPDATE grant on `trips` with no UPDATE policy
to use it — worth dropping.

## Recovery path (proposed, not yet executed)

1. Route all three lookup call sites through the Lovable Google Maps gateway
   (`https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText`,
   with the Lovable key plus the connection key), instead of calling Google
   directly. Verified working above.
2. Stop failures from being indistinguishable from "not found": classify the
   response (auth/permission rejection, rate limit, timeout, genuine zero
   results). Only genuine zero-result answers should be cached or should
   consume an attempt; a provider/config rejection must not.
3. Clear the poison: delete the 28 failure rows from the lookup cache, and
   reset geocode status/attempts on the affected stops so the normal pass can
   run again. This is a data change, so it happens only on your go-ahead.
4. Re-run the owner "Locate stops" pass for orsino-yhpv2w and confirm pins
   appear, then spot-check a second dossier.
5. Add a visible signal for the owner when lookups are rejected for
   configuration reasons, so this fails loudly next time instead of looking
   like unresolvable addresses.

## Technical notes

- `enrichBlocksWithCoords` treats a missing key as a no-op but treats a
  rejected key as a miss — that asymmetry is what poisoned the data.
- Cache key is a SHA-256 of the normalised query, so clearing by query string
  requires hashing the same way (or deleting the whole failure set, which is
  currently the entire table).
- `geocode_cache` grants and the `geocode_cache` table itself are fine; reads
  and writes are working, which is exactly why the failures persisted.
- Analytics: the fix should ship a first-use/failure event for locate passes so
  a provider outage is measurable rather than inferred from empty maps.
