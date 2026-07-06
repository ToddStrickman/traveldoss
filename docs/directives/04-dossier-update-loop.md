# Directive 4 — Dossier Update Loop (re-ingest + diff + selective apply)

## Objective
An owner pastes a new confirmation email into an *existing* dossier and gets
a reviewable diff — "Flight BA117 departure 09:40 → 11:15" — applying only
what they accept. The dossier becomes a living document.

## Why
Trips mutate between minting and traveling. Today a changed booking means a
whole new dossier (new slug, lost edits). This is the retention feature: it's
what brings users back into the product between creation and departure.

## Current state
- `refine.functions.ts` already re-runs the whole itinerary through the
  parser when trip *meta* changes (serializes blocks to a markdown brief,
  re-parses). Good precedent for round-tripping, but it's whole-document and
  silent — not a reviewable merge.
- `parse-ai.functions.ts` turns raw email/paste text into blocks; it is the
  well-tested path — reuse it, don't fork it.
- Blocks persist as a JSON blob (`trips.content.blocks`); `updateTrip` in
  `trips.functions.ts` does a read-then-write the code itself labels racy.
- `IngestionModal.tsx` has the paste UI; `TdSheet` is the mobile sheet
  primitive; the view-transition pattern in `t.$slug.tsx` handles reflow.

## Work

### 1. The diff engine — pure, heavily tested (this is the heart)
New `src/lib/itinerary/merge.ts`, no I/O, exhaustively unit-tested:
- **Identity keys**: flight → `flightNumber + date` (fallback
  `from+to+date`); place → normalized name + enclosing day `n`; day → `n`.
  Normalize names (case, whitespace, punctuation) before matching.
- **Output changeset**: `{ added: Block[], removed: BlockKey[], modified:
  { key, before, after, changedFields }[] }` — field-level, not block-level,
  so the UI can say *what* changed.
- **Rules**: reordering alone is not a change; `tier: "shadow"` blocks are
  never removed by a merge (Plan-B content isn't in confirmation emails);
  editorial kinds (`quote`, `note`, `paragraph`, `hero`, `section`) from the
  fresh parse are ignored — a re-ingest updates *logistics*, not prose;
  fields the owner set manually (`enrichmentSource: "manual"`, see
  Directive 3) win over parsed values unless explicitly accepted.
- Target 10+ vitest cases before wiring any UI: time change, airline swap
  same flight number, added/removed day, no-op email, duplicate legs,
  manual-field protection.

### 2. Server functions — new `src/lib/itinerary/merge.functions.ts`
- `previewMerge` (POST, `requireSupabaseAuth`, owner check): input
  `{ slug, rawText }` → run `parseItineraryAi` → `diff(existing, parsed)` →
  return changeset + the trip's current `updated_at`.
- `applyMerge`: input `{ slug, acceptedChanges, expectedUpdatedAt }`. Apply
  only the accepted subset. **Close the race** the code comments admit:
  make the Supabase update conditional on `updated_at` matching
  (`.eq("updated_at", expectedUpdatedAt)`); zero rows updated → return a
  conflict the UI turns into "dossier changed elsewhere — re-run preview".
- Log each apply to a new `trip_ingestions` table (migration in
  `supabase/migrations/`): `id, trip_id, source_hash, changeset jsonb,
  applied_at`. v1 uses it for audit; undo can come later.

### 3. UI
- StudioBar (owner mode) gains "Update from email" → opens `IngestionModal`
  in an update variant (reuse the paste step verbatim, different submit).
- Result renders in a **DiffSheet** (new, built on `TdSheet`): changes
  grouped flights-first, each row showing `before → after` with a per-item
  accept toggle (default on), then one "Apply N changes" action. Follow the
  mobile budget: this is a sheet, not a new page.
- On apply, wrap the block state swap in the existing `startViewTransition`
  call so changes visibly settle into place.

## Sequencing
Ship 1 (engine + tests) → 2 (server fns, verified with curl/vitest against a
dev trip) → 3 (UI). Each step is independently mergeable.

## Definition of done
- [ ] End-to-end: paste an email moving a flight time → diff shows exactly
      one modified flight with the field-level change → apply → dossier
      updates in place → reload persists.
- [ ] No-op email yields an empty changeset and a friendly "nothing changed".
- [ ] Concurrent-edit conflict surfaces a toast, never a silent clobber.
- [ ] Shadow blocks and manual corrections survive an aggressive re-ingest.
- [ ] Diff engine ≥10 unit tests; `vitest` + `tsc` green; migration applies.
