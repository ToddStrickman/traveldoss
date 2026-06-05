# Unified ingestion + inline missing-field prompts

## What we're building

One entry point for every itinerary. After the first draft renders in the vertical skin view, missing dossier fields appear as **pulsing inline chips** in the exact spot they belong (dates under the hero, travelers in the header, pace/budget/interests in a meta strip, "Open Time" / "Transit TBD" inside empty slots). Tapping a chip opens a small inline editor; answering silently re-runs the generator and diff-merges the sharpened result into the live preview.

## Flow

```text
┌──────────────────────────────────────┐
│ Composer (one screen)                │
│ [Paste] [Upload] [Generate]  ← pills │
│ ┌────────────────────────────────┐   │
│ │ Paste itinerary, describe a    │   │
│ │ trip, or drop a transcript…    │   │
│ └────────────────────────────────┘   │
│              [Compose dossier →]     │
└──────────────────────────────────────┘
                  │
                  ▼
   First draft renders in vertical skin
                  │
                  ▼
┌──────────────────────────────────────┐
│ Hero: Lisbon                          │
│   • Add dates ⟂  (pulsing chip)       │
│   • 2 travelers · balanced · €€       │
│                                       │
│ Day 1 — Alfama                        │
│   09:00  Open Time  (chip)            │
│   13:00  Lunch — Cervejaria Ramiro    │
│   16:00  Transit TBD (chip)           │
└──────────────────────────────────────┘
```

## Changes

### 1. Composer — `src/components/flow/IngestionModal.tsx`

- Replace the three big tab cards with a single textarea + a row of three subtle pills (`Paste · Upload · Generate`) that bias the parser.
- One paperclip button next to the pills opens the file picker (transcripts).
- Remove the "Describe your trip" form, metadata grid, and interests grid from this surface entirely. Those values now come from inline chips on the rendered itinerary.
- The footer becomes a single primary action: **Compose dossier →**.
- On submit: route through the existing `parseAi` (paste/upload) or `generateAi` (generate) helpers, then jump straight to the rendered itinerary (no more "review" stage as the first stop).

### 2. Inline chip system on the vertical skin

- New component `src/components/studio/MissingFieldChip.tsx` — pulsing pill with subtle motion, opens an inline popover editor on click. Variants: text input, date range, select, multi-tag.
- New helper `src/lib/itinerary/missing-fields.ts` — given a `TripView + Block[]`, returns the list of missing dossier fields (`dates`, `travelers`, `pace`, `budget`, `interests`) plus per-day "open slots" (no place in a time slot the brief implies should be filled).
- New placeholder blocks emitted by the parser/adapter when a slot is empty: `{ kind: "placeholder", label: "Open Time" | "Transit TBD", slot, dayN }`. Add `placeholder` to `src/lib/skins/types.ts` and render it in `src/lib/skins/shared/views/VerticalView.tsx` as a dotted-outline row that is itself a chip.
- The hero block in `VerticalView.tsx` mounts the meta chips: Dates, Travelers, Pace, Budget, Interests — each renders either the current value or a pulsing "Add …" chip.

### 3. Silent re-generation on answer

- New server fn `refineItineraryAi` in `src/lib/itinerary/generate.functions.ts` — accepts current blocks + the single field that changed and returns an updated block list. Internally calls Gemini with a "preserve user edits, sharpen schedule, fill openings" prompt.
- New client hook `src/hooks/use-itinerary-refiner.ts` — debounced (1.2 s), queues changes, diff-merges the returned blocks into the live store, and rolls back on failure with a `toast`. Uses the existing `withRetry` helper.
- The chip editor calls `refiner.update({ field, value })` on save. No full-screen loader; a tiny "Sharpening…" indicator appears in the studio bar while the call is in flight.

### 4. Delete the standalone Generate form path

- Remove `GenerateForm` from `IngestionModal.tsx` (replaced by composer + inline chips).
- Keep `GenerationProgress` only for the initial first-draft generation overlay; subsequent refinements are silent.
- `useSavedTripRequests` still loads/saves drafts, but the editor for them moves to a small "Saved briefs" link in the composer.

### 5. Review stage becomes optional

- The existing block-reorder/edit "Review" stage moves behind a `Refine blocks` button in the studio bar (`StudioBar.tsx`). The default post-compose path is: draft renders → fill chips → mint. Power users can still open the structural editor.

## Technical notes

- `placeholder` block type kept narrow so existing skins that don't render it just fall through to nothing.
- Diff-merge strategy: match blocks by `id` (assigned in the parser); new blocks from the AI insert at their declared `order`; user-edited blocks (`block.userEdited === true`) are never replaced, only annotated.
- Re-generation is gated behind `refiner.canRun` (no in-flight call, ≥1.2 s since last change, ≥1 chip answered).
- All chip editors are keyboard-accessible (`Enter` to save, `Esc` to cancel, focus trap inside popover).
- No DB schema changes required; `trips.content.blocks` already stores the block array.

## Out of scope

- Map view chips (only vertical view in this pass).
- Audio transcript transcription (still "coming soon").
- Sharing the refined doc URL mid-refinement — the published URL still snapshots on mint.
