# Fix the Rome place misses

## What the validation found

I ran the checks on the current branch and made one live lookup through the connected Google Maps account.

- Live probe: "Pantheon, Piazza della Rotonda, 00186 Roma RM, Italy" returns **HTTP 200** with coordinates (41.8986108, 12.4768729). The map provider and the connected account are healthy. The address text is not the problem.
- Types: clean.
- Tests: 375 pass, 5 fail. Four are the live AI-parser tests (unrelated). The fifth, "does nothing without an API key", is the one guard still missing in the lookup file.
- The one remaining piece of code that still calls Google directly is `src/lib/itinerary/geo.server.ts` — it is the file that does the coordinate backfill for existing trips, i.e. the Rome stops. The two files already migrated (parse-time enrichment and the suggestion box) go through the working path.

So the misses continue for exactly one reason: the backfill still sends the connector key to Google as if it were a Google key, Google rejects it, and the code files the rejection as "address not found".

## Changes to make in `src/lib/itinerary/geo.server.ts`

1. **Route the lookup through the working path.** Import `placesRequest` from `@/lib/maps/places-request.server` and use it in `googleTextSearch` instead of `fetchImpl("https://places.googleapis.com/v1/places:searchText", ...)`. Drop the `X-Goog-Api-Key` header line; keep method, field mask (`places.id,places.location`), body, abort signal and timeout exactly as they are. Keep the injectable `fetchImpl` for the tests by passing it through to the helper (add an optional `fetchImpl` argument to `placesRequest`, defaulting to global `fetch`) — this keeps the existing test harness working unchanged.

2. **Stop recording configuration faults as "address not found".** `googleTextSearch` currently returns `null` for every failure. Split the outcomes into three:
   - a real answer (coordinates),
   - a genuine empty result (HTTP 200, no places),
   - a fault: the helper throwing (gateway credentials absent), any non-OK HTTP status, a timeout or network error.

   Return the fault distinctly (for example `{ kind: "error", status }`).

3. **Never cache or count a fault.** In `resolveGeocodeQuery`, only call `writeCache` for a real answer or a genuine empty result. On a fault, return without writing.

4. **Never burn an attempt on a fault.** In `enrichBlocksWithCoords`, skip faulted stops when applying outcomes: leave `geocode.attempts` and status untouched so the next save retries. Only genuine empty results increment attempts and eventually reach `needs_review`.

5. **Fix the failing guard test.** `enrichBlocksWithCoords` must do nothing when `apiKey` is explicitly absent — the environment key must not be used as a fallback when the caller passed `apiKey: undefined`. Resolve the default at the call site instead of in the parameter default.

6. **Surface a fault to the owner** (small, optional but worth doing in the same change): return a flag from the backfill saying "lookups are misconfigured" so the dossier can show a one-line owner-only notice rather than silently blank pins.

## Still blocked: the existing poisoned misses

Even with all of the above, `/t/orsino-yhpv2w?map=trip` stays empty. The lookup cache holds 28 recorded failures for those exact stops, and all 28 stops are flagged as reviewed-and-given-up. Every retry short-circuits on those records.

Recovery, which needs your explicit approval before I touch data:

1. Delete the 28 failure rows for this trip's queries from the lookup cache.
2. Reset the affected stops' lookup state (clear `needs_review`, zero `attempts`).
3. Run one owner-triggered locate pass and confirm pins appear.

Say the word and I'll do those three steps as a separate, reviewable action.

## Notes

- I did not edit any files this turn.
- `src/lib/maps/places-request.server.ts`, `parse-ai.functions.ts` and `suggest-location.functions.ts` need no further change; only `geo.server.ts` and its test harness are in scope above.
- Verification for the change: `npx tsgo --noEmit` clean, and `bun test src tests` with the attempt-cap test passing and only the four live AI-parser failures remaining.
