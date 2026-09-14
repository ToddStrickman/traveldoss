# Fix the Rome place misses, and get address lookups off Google

Reconciled against the Live Map PRD and Technical Design you uploaded.

## What the validation found on your branch

- Live probe through the connected Google account: "Pantheon, Piazza della Rotonda, 00186 Roma RM, Italy" returns **HTTP 200** with coordinates. The provider and the account are healthy; the address text is not the problem.
- Types: clean. Tests: 375 pass, 5 fail — four are the live AI-parser tests (unrelated), the fifth is the "does nothing without an API key" guard in the lookup file.
- One file still calls Google directly and it is exactly the one that resolves stops on existing trips: `src/lib/itinerary/geo.server.ts`. The two files already migrated (mint-time enrichment, the suggestion box) use the working path.

So every Rome stop is a miss for one reason: the lookup sends the connector key straight to Google as if it were a Google key, Google refuses it, and the code files the refusal as "address not found" — then caches that and counts it against the three-attempt limit.

## Where this meets the two documents

The documents already agree with the direction and even reserve the vocabulary for it:

- The design document's stop record already allows a lookup provider of `"photon"` alongside `"google-places"` and `"manual"`. A second provider was anticipated, never wired.
- Both documents state that rendering the map already costs nothing per view (MapLibre over OpenFreeMap, no browser key). **Address lookup is the only remaining Google spend in the whole feature.**
- Both list Google price drift as a live risk, and the Phase 3 list carries a per-user daily lookup ceiling as a cost control.
- The documents' invariants stay intact under this plan: no lookups at view time, an owner's manual fix is never overwritten, a map failure never breaks a dossier, one shared cache, one attempt ladder.

One thing the documents get wrong today and this plan corrects: they describe `GOOGLE_MAPS_API_KEY` as a Google key used directly. It is the connected-account key and must go through the managed connection. That mismatch is the root cause of the misses.

## The plan

### 1. Make the resolver provider-agnostic

Introduce one small resolver module with a provider list, keeping the existing shape (`query in`, `coordinates + optional place id out`). Everything else — the shared cache, the three-attempt ladder, the caps, the timeouts, `manual` never being touched — stays exactly as the documents describe it.

### 2. Put a free provider first, Google second

- **Primary: Photon** (the open geocoder over OpenStreetMap data). No key, no per-lookup cost, and it is the provider the design document already named. Store `provider: "photon"` on the stop and in the cache row, so every resolved stop is auditable by source.
- **Fallback: the connected Google account, through the managed connection** — used only when the free provider returns nothing for a query. That keeps the accuracy the free provider misses on named venues (small restaurants, bars) while collapsing the bill to the small tail.
- Result: for a typical dossier of well-addressed stops, close to zero paid lookups; the shared cache and the seven-day miss window continue to absorb repeats.

Honest trade-off, stated plainly: the free provider is strong on street addresses and weak on "the name of a small restaurant with no address". That is why Google stays as the second try rather than being removed outright. It also returns no Google place identifier, so stops resolved for free will not carry one — the map's grouping already falls back to coordinates plus name, so nothing breaks.

### 3. Stop turning faults into "address not found"

The current lookup returns "no result" for every kind of failure. Split the outcomes into three:

- a real answer,
- a genuine empty result (the provider answered, found nothing),
- a fault (misconfiguration, a rejected request, a timeout, a network error).

Then: **never cache a fault, and never count a fault as an attempt.** Only genuine empty results advance the ladder toward "needs review". This is the change that prevents a repeat of the current situation, whatever the provider.

### 4. Fix the failing guard and surface faults to the owner

- The lookup must do nothing when a caller explicitly passes no key — resolve the environment default at the call site, not in the parameter default. That turns the failing test green.
- When lookups are misconfigured, the map should tell the owner in one line instead of showing empty pins, matching the existing "not configured" behaviour on the locate path.

### 5. Documentation, tests, analytics

- Add the new provider ladder and the fault rule to `docs/directives/LOVABLE_HANDOFF_LIVE_MAP.md` "Do not undo these", and note the corrected key story.
- Tests: the free provider's URL and response parsing, the fallback firing only on an empty free result, faults not cached and not counted, plus the existing attempt-cap suite green.
- Record `provider` on the resolution events so you can see the free/paid split, per the documents' "is geocoding cheap?" question.

## Still blocked: the poisoned records

Even with all of the above, `/t/orsino-yhpv2w?map=trip` stays empty. The lookup cache holds 28 recorded failures for those exact stops, and all 28 stops are flagged as given-up. Every retry short-circuits on those records.

Recovery, awaiting your explicit approval:

1. Delete the 28 failure rows for this trip's queries from the lookup cache.
2. Reset those stops' lookup state (clear the given-up flag, zero the attempt count).
3. Run one owner-triggered locate pass and confirm pins appear.

## Notes

- Scope of code changes: `src/lib/itinerary/geo.server.ts`, a new provider module under `src/lib/maps/`, the two already-migrated call sites left as they are, docs and tests. No migration, no schema change, no rendering change.
- Verification: types clean, and the test suite with the attempt-cap test passing and only the four live AI-parser failures remaining.
