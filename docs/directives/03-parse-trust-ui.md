# Directive 3 — Parse Trust UI (surface confidence, one-tap correction)

## Objective
When the AI parse is unsure about a field, the dossier says so — quietly —
and the owner can correct it in one tap. Verified blocks lose the flag.

## Why
Parse failures used to be silent (the original bug hunt in this repo was a
retry-storm in `parse-ai`). The normalizer made parsing resilient; this makes
its *uncertainty visible*, which is what converts a skeptical first-time user.

## Current state — the schema is ahead of the UI
`src/lib/skins/types.ts` already defines on `place` blocks:
- `confidence?: number` (0–1; the doc comment specifies **flag below 0.85**)
- `enrichmentSource?: "model" | "google-places" | "manual"`
- `enrichedFields?: string[]`

But `grep confidence` shows only `IngestionModal.tsx` touches it — nothing in
the dossier views. Also available to build on:
- `harden.functions.ts`: background pipeline that re-verifies blocks after
  first render (search pass + logic-confirm pass).
- `trips.functions.ts` `updateTrip` (~line 78): accepts partial `blocks`
  writes.
- `PlaceSheet.tsx` (`src/components/mobile/`): the tap-a-row action sheet.

## Work

### 1. Make the parser actually emit confidence
Check `parse-ai.functions.ts`'s output schema and prompt: if `confidence` /
`enrichedFields` aren't populated per block, add them (prompt instruction +
zod passthrough in `normalize-ai.ts`, with tests in `normalize-ai.test.ts`).
Enrichment code that gap-fills via Google Places must set
`enrichmentSource: "google-places"` and list the fields it filled.

### 2. Flag low-confidence rows in the shared views
In `src/lib/skins/shared/views/parts.tsx` (ActivityRow) and the grid/
horizontal equivalents: when `confidence < 0.85`, render a small "verify"
affordance — recommended: a dotted underline on the uncertain field plus a
compact chip on the row. Constraints:
- Style in `skin.css` using skin tokens with the contrast pattern
  (`color-mix(in oklab, var(--tds-accent) 78%, var(--tds-ink))`) — this must
  read on all ten skins without touching any skin file.
- Chip participates in the row's existing tap target (rows are already
  `role="button"` opening PlaceSheet) — don't nest a second button.
- Accessible name must contain the visible chip text (WCAG 2.5.3 — this repo
  has been burned three times; see DESIGN_REVIEW.md polish addendum).

### 3. Correction flow in PlaceSheet
Extend `PlaceSheet.tsx` with a section that appears when the block is
flagged: which fields were auto-filled (`enrichedFields`), from where
(`enrichmentSource`), and — **owner only** — inline inputs for the flagged
fields (time, name, address) plus two actions: "Save correction" and "Looks
right". Both write through `updateTrip`: corrections set the field +
`confidence: 1` + `enrichmentSource: "manual"`; "Looks right" just sets
`confidence: 1`. Visitors get a read-only "details unverified" note. Desktop:
reuse the same data in a Radix hover-card (already a dependency) — no new
pattern.

### 4. Let hardening clear flags
When `harden.functions.ts`'s logic-confirm pass validates a block it
re-writes, have it raise `confidence` so flags disappear on their own within
a minute of minting. This is the difference between "the app doubts itself"
and "the app checks itself".

## Definition of done
- [ ] Fixture with mixed confidences (extend `DEMO_BLOCKS` in
      `src/lib/skins/demo.ts`) shows flags only under 0.85, on all three
      views, on at least Cassian + Epictetus.
- [ ] Owner corrects a time in two taps; flag clears; reload persists.
- [ ] "Looks right" clears the flag without changing fields.
- [ ] Lighthouse accessibility stays 100 (run the harness against a deployed
      or local prod build).
- [ ] Normalizer tests cover confidence passthrough; `vitest` + `tsc` green.
