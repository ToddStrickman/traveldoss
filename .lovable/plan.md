# Calendar view, import test repair, and shared editing

Three pieces of work, in this order. Each one stands on its own, so you can stop after any of them.

---

## 1. Calendar quick-reference panel

A **Calendar** button sits beside Hotels and the flight summary at the top of every itinerary, in all three layouts, on phone and desktop.

Tapping it opens a panel with two parts:

- **Month strip** across the top: the trip's dates only, each with a small marker showing what happens that day (a plane for a flight day, a dot for stops, a bed tint for the hotel night). Tap a date to jump.
- **Agenda underneath**: each day in order with its date heading, flights first, then the hotel for that night, then each stop with its time, name and category icon. Untimed stops are grouped after the timed ones rather than given a fake time.

Details:

- Days whose date can't be worked out are still listed by day number, so nothing disappears.
- Plan-B (shadow) alternatives are excluded, matching how they behave everywhere else.
- Tapping a stop closes the panel and scrolls the itinerary to that stop.
- Hidden entirely when a trip has no dated days and no flights, the same way the Hotels button hides itself.
- Reservation numbers and other private booking details never appear here on a shared link.

---

## 2. Fix the four failing import tests

The cause is confirmed and it is in the tests, not the importer: the four tests call the import routine through its web wrapper, which returns nothing when there is no browser request behind it, so every assertion reads an empty result. That is why all four fail identically with the same "no result" error.

Work:

1. Point the tests at the importer's direct entry point so they exercise the real thing.
2. Re-run them. Any assertion that then genuinely fails is a real gap in the importer — day renumbering when days arrive out of order, inferring the destination when it isn't stated, every stop having a category, and recommended stops being marked lower-confidence than ones you typed. Each real failure gets fixed in the normaliser, not by weakening the test.
3. Add cheap offline tests covering the same four behaviours so they run without calling the AI service, keeping the live ones as the slow suite.

Honest note: the failing tests were never proof that imports drop stops, hotels or flights. Once they run properly we will know, and I'll report exactly what the importer does and doesn't fill.

---

## 3. Shared editing: foundation, then invites and history

Phase 2 can't stand without Phase 1, so both ship here.

### Phase 1 — foundation (invisible to you except one label)

- Member, invite and change-log tables, plus the per-trip invite policy settings.
- Every existing trip gets its owner record.
- Every stop, flight and note gets a permanent internal id so a change can be tracked to one block and put back exactly where it was.
- Every content change from every save path writes a change-log record naming who made it. Automatic passes are recorded as the system, never as an unknown person.
- Deleting a block removes it from the dossier; the change-log record keeps the whole block and its position, which is what makes restoring possible.
- The Share option is relabelled **Copy view-only link**, and I audit that no link or route can grant editing to anyone but you and your invited co-planners.

### Phase 2 — co-planners

- **Invite to edit** in the Share sheet, several addresses at once. Your invites send immediately.
- **Invite email** from TravelDoss: "{your name} invited you to plan {trip}", with a "Join the trip" button. This needs an email-sending service connected — see Needs from you.
- **Acceptance page** at a private link: shows the trip name, cover and who invited them; they sign in as the invited address and land in the editor. Signed in as a different address, they get a plain explanation and an option to switch.
- **Co-planners get the full editor** minus everything owner-only: publishing, paying, renewing, changing the look, changing who can see it, deleting the trip, managing members. Those are blocked on the server, not just hidden.
- **"Edited by {name}"** marker on any block a co-planner last touched. Editor only, never on the public dossier.
- **Two people at once**: a save based on a stale copy is refused with "{name} changed this since you opened it" and a choice to reload or keep yours. Keeping yours is still recorded.
- **Members panel** (yours only): each person's name, how they joined, status and join date, with Remove.
- **History panel** (yours only): changes in time order, filterable by person, each with a before/after preview, **Restore** to put a deleted block back in its original place, and **Roll back to here** for the whole trip. Restores are themselves recorded, so they can be undone.
- **Delete notice**: when a co-planner deletes something you wrote, you get an in-app notice plus a daily email summary, each with one-tap restore.
- **"Start your own dossier"** link in the co-planner's view.
- Locked or expired trips are read-only for co-planners exactly as they are for you.

---

## Needs from you

- **Email sending** for invites and the delete summary. There is no email service connected yet beyond sign-in links, so I'll need Resend switched on and a sending address before invites can actually leave. I'll build the invite flow so it works end to end the moment that is in place, and until then invite links can be copied manually.

---

## Technical notes

**Calendar.** New `src/lib/skins/shared/CalendarQuickRef.tsx` modelled on `HotelsQuickRef.tsx`: same `TdSheet` panel, same inert-render and trusted-viewer handling. Day grouping reuses `itinerary.ts`; date resolution goes through `src/lib/itinerary/temporal.ts` / `day-dates.ts` (no new date parser); icons through `resolveCategoryIcon`. Button rendered in `VerticalView`, `HorizontalView`, `GridView` beside `HotelsQuickRef`. Styles appended to `skin.css` as `.tds-calref*` — month strip is a horizontal scroller with `scroll-snap`, 44px targets, reserved height so CLS stays 0. Jump-to-stop uses the existing day/block anchor ids. Unit tests for date-window building, undated fallback and shadow exclusion. Analytics: `calendar_quickref_opened {day_count, has_flights}`, `calendar_day_jumped`, documented in `docs/analytics/tracking-plan.md`.

**Parser tests.** `tests/itinerary-parser-ai.test.ts` `runParser()` calls `mod.parseItineraryAi({ data })` — the `createServerFn` wrapper, undefined outside a request. Switch to the already-exported `parseItineraryAiCore(data)` from `src/lib/itinerary/parse-ai.functions.ts`. New offline cases go in `src/lib/itinerary/normalize-ai.test.ts` against fixture model output.

**Collaboration.** Follows `docs/directives/08-collaboration.md` Phases 1–2 and the Discovery findings: `trip_revisions` does not exist, so `trip_changes` is the single history and point-in-time rollback is reconstructed from it. Migrations create `trip_members`, `trip_invites`, `trip_changes`, the `trips` columns (`member_invite_policy`, `invite_policy_prompted`), an `is_trip_member(trip_id, roles[])` helper, GRANTs and RLS per directive section 4. Attribution via a trigger on `trips` diffing `content.blocks` by block id; privileged writers (`updateDossier`, `createTripFromIngestion`, `pickTemplate`, `cloneGuide`, MCP `create_trip`, `locateTripPlaces`, `admin/evergreen.server.ts`) set the actor with `set_config('app.actor_id', …)` or are logged `actor_kind = system`. Block-id backfill threads through `carry-over.ts`, undo/redo and the edit sheets, which are index-based today — ids are added alongside indexes, not replacing them. Invite tokens hashed at rest, single-use, email-bound, 14-day expiry; acceptance through a server function at `/invite/$token`. All server work uses `createServerFn` + zod + `requireSupabaseAuth`. Analytics per directive section 6. `bun test` and `npx tsgo --noEmit` green before done; no per-skin file is touched.
