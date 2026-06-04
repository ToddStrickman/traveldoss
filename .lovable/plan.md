## Goal

Make the parser emoji-safe and time-bucket-aware, keep it reductive (no invented blocks), and give every template a shared day-slot UI with a horizontal carousel of alternatives plus a "Shadow itinerary" rail at the bottom.

## 1. Emoji & input hygiene (parser)

In `src/lib/itinerary/parse.ts`:

- Add `stripEmoji(text)`: removes Unicode `Extended_Pictographic` runs, ZWJ joiners, regional indicators, variation selectors. Trim leftover punctuation.
- Run it inside `preprocessMarkdownTables` AND at the top of `parseDropIn` so emojis never survive into block names.
- Also strip emojis from row cells before period/time detection so `"🌅 Morning"` still maps to `09:00`.

In `src/lib/itinerary/parse-ai.functions.ts`:

- Strip emojis from the user-supplied `text` before sending to the model.
- Add to system prompt: "Discard emojis entirely. Never emit them in `name`, `label`, `text`, or `note`."

Tests added to `tests/itinerary-parser.test.ts`: pasted text with emoji bullets parses to clean names; `🌅 Morning | Walk` becomes a 09:00 block named "Walk".

## 2. Time → slot bucket (shared helper)

New `src/lib/itinerary/slots.ts`:

- `type DaySlot = "morning" | "afternoon" | "evening" | string` (string allows custom user slot labels like "late afternoon", "midnight").
- `DEFAULT_SLOTS = ["morning","afternoon","evening"]`.
- `bucketFor(time?: string, hintWord?: string): DaySlot` — uses clock time first, falls back to keyword map. **"late afternoon" → "afternoon"** (per the request: it should fall *into* the afternoon bucket by default; users can opt into a separate "late afternoon" slot via custom slots).
- `groupDayBlocks(blocks, day): Record<slot, PlaceBlock[]>` — returns ordered groups per day, preserving source order.

Extend `PERIOD_TIMES` in `parse.ts` so "late afternoon" still gets a clock time (17:00) — slot bucketer maps 17:00 → afternoon.

## 3. Reductive parsing (no invented stops)

- In the AI prompt, replace the "expand/recommend missing meals/lodging" sections with: **"Be reductive. Emit exactly one block per distinct user-stated item. Do NOT invent activities, meals, or stays that aren't in the input. Preserve 'must see' / 'highlight' / 'don't miss' markers verbatim in `note`."**
- Add rule: "An item like `Aperitivo at X` followed by `Farewell dinner at Y` is two separate place blocks — never merged."
- In `parse.ts`, when a clause contains markers like `must see|must-see|don't miss|highlight`, set a `note: "Must see"` on the emitted place block (new optional behavior; no schema change needed — `note` already exists).

## 4. Day header date placeholder

- Extend `Block` `day` variant with optional `date?: string` (already partially supported via flight `date`; add it cleanly to `day`).
- Parser: if a date follows "Day N" (`Day 1 – Mon Oct 14` or `Day 1 (10/14/25)`), capture it into `day.date`.
- Skin shared header renders `Day {n} — {label} · {date ?? "TBD (MM/DD/YY)"}`.
- Update `src/lib/skins/shared/views/parts.tsx` (the shared Day header) to render the placeholder.

## 5. Slot rail + alternatives carousel (shared UI)

New `src/lib/skins/shared/DaySlotRail.tsx` consumed by all three shared views (`VerticalView`, `HorizontalView`, `GridView`):

- For each slot in `DEFAULT_SLOTS` (plus any custom slot present that day), render: slot label, the chosen card, and — if more than one block falls into the slot — a horizontal-scroll carousel of "Alternatives" the user can pick from. Selection updates which block is treated as primary for that slot.
- Selection state is per-day-per-slot, stored in `localStorage` keyed by trip slug so it survives reloads without a schema change.
- Carousel: CSS scroll-snap, swipe on mobile, arrow buttons on desktop, accessible via keyboard.
- Add "+ slot" affordance letting the user add a custom slot (e.g. "late afternoon", "midnight"). Stored alongside selections in localStorage.

Wire `DaySlotRail` into the three shared views; hand-built skins (`epictetus`, `orsino`) get a minimal version so behavior is consistent.

## 6. Shadow itinerary rail

- Parser convention: any block whose source line starts with `Alternative:` / `Option:` / `Backup:` / `Plan B:` (case-insensitive) gets tagged `note: "shadow"` (or a new `tier?: "primary" | "shadow"` on the place block — cleaner; add to `Block.place`).
- AI prompt: emit shadow alternatives with `tier: "shadow"`; primary itinerary stays `tier: "primary"` (or unset).
- New `src/lib/skins/shared/ShadowItinerary.tsx`: collapsible section pinned at the bottom of every skin. Lists shadow blocks grouped by their associated day. Includes a small inline cue in each primary day header ("Plan B available ↓") that anchors to the shadow section.
- Render in all shared views + the two hand-built skins.

## 7. Tests

- `tests/itinerary-parser.test.ts`: emoji strip, late-afternoon bucketing, three-item aperitivo/dinner sequence stays as 3 blocks, alternative line gets `tier: "shadow"`, date capture from `Day 1 (10/14/25)`.
- `tests/slots.test.ts` (new): `bucketFor` mapping table.
- `e2e/` not touched in this pass.

## Technical notes

- `Block` schema change is additive: `day.date?: string`, `place.tier?: "primary" | "shadow"`. No migration required (it's view-state).
- Slot selection + custom slots are client-side only (localStorage). If the user later wants this persisted server-side, that's a follow-up.
- "Reductive" prompt change is the riskiest behavior shift — I'll keep the existing enrichment (address/phone/website/note) but remove the "fill missing meals/lodging" instructions.

## Out of scope

- Persisting slot selections 
- Drag-to-reorder between slots (current scope is pick-from-alternatives only).
- Changing the published skins' visual identity beyond adding the slot rail + shadow rail.