## Problem

A blank dossier renders as an empty canvas — the "Begin from a blank page" path in `IngestionModal.tsx` passes `[]`, and every skin view just maps over blocks, so there is literally nothing on screen. New users have no visual affordance telling them where to start.

## Solution

Render a **Blank Day scaffold** inside the current skin canvas whenever an editable dossier has no place/flight content. It looks like a real day, but every slot is a grayed ghost tile with placeholder copy. Clicking any ghost inserts a real, seeded block at the right spot (correct day, correct part-of-day, correct category), and the ghost disappears.

The scaffold is a UI overlay, not persisted content — so undoing back to a truly empty dossier still shows the scaffold, and minting later never has to strip fake blocks.

### What appears on screen (Day 01 skeleton)

- **Trip hero** — "Untitled dossier" placeholder title, existing meta chip rail (dates / travelers / pace / budget / interests) already handles its own emptyLabel pulse and stays as-is.
- **Outbound flight ghost strip** — dashed FlightStrip-shaped card: "Add outbound flight · airline · confirmation · seats".
- **Day 01** heading (editable) with a subtle "Rename this day" hint.
  - **Morning rail** — two ghost activity rows:
    - `accommodation` → "Where you're staying · check-in time"
    - `transit` → "Rental car / transfer pickup"
  - **Afternoon rail** — two ghosts:
    - `culture` → "Museum, gallery, or landmark"
    - `walk` → "Neighborhood walk or hike"
  - **Evening rail** — two ghosts:
    - `restaurant` → "Dinner reservation · dress code"
    - `event` → "Concert, theater, or nightlife"
- **Inbound flight ghost strip** at the bottom.
- **"+ Add another day"** ghost row under the day.

Every ghost is a real button:
- Dashed 1px border in `color-mix(in oklab, var(--tds-ink) 22%, transparent)`.
- Copy in `color-mix(in oklab, var(--tds-ink) 45%, transparent)` (WCAG-safe on all ten skins — reuses the palette we already vetted).
- Category icon on the left (existing `CategoryIcon`).
- Min-height 44px, `.tap` utility, focus ring — passes the a11y bar in the house rules.
- Reduced-motion respected: the gentle pulse is disabled under `prefers-reduced-motion`.

Clicking a ghost calls `onBlockAdd` with a seeded patch (see technical section). The new block appears in place, editable inline; the corresponding ghost is removed from the scaffold. When the scaffold has no ghosts left AND real content exists, it unmounts.

### Mobile behavior

Same component, single-column stack (already the base layout). Ghosts collapse to full-width rows with 44px tap targets. Nothing horizontally scrolls. Because the scaffold is `md:hidden`-agnostic (mobile-first CSS), it just re-flows.

### Blank-flow seeding

`IngestionModal.tsx` "Begin from a blank page" currently passes `[]`. Change it to seed:
```
[{ kind: "day", n: 1, label: "Day 01" }]
```
so the dossier has real structural bones and the scaffold has a Day to anchor onto. Everything else is ghost until the user clicks.

### Trigger rule

Scaffold renders when **all** are true:
- `editing === true`
- No `place` or `flight` blocks exist
- No shadow-tier blocks exist

The instant the first real place/flight is added, ghosts for that specific slot disappear; once any real content exists in a slot, only the still-empty ghosts remain.

## Files to change

**Edit**
- `src/components/flow/IngestionModal.tsx` — replace the two `onGenerate([], …)` calls (lines 640, 656) with a seeded single-day array.
- `src/lib/skins/shared/Editable.tsx` — widen `EditingCtx.onBlockAdd` signature to accept an optional `seed: Partial<Block>` so ghosts can pre-populate category / part-of-day / direction.
- `src/routes/t.$slug.tsx` — update the `onBlockAdd` implementation in `editingCtx` (lines 400–416) to merge the seed into the fresh block.
- `src/lib/skins/shared/views/VerticalView.tsx` — mount `<BlankDayScaffold />` under the meta rail when the trigger rule fires; skip the normal itinerary render in that state.
- `src/lib/skins/shared/views/HorizontalView.tsx` and `GridView.tsx` — same mount for parity.
- `src/lib/skins/shared/skin.css` — add `.tds-ghost-*` styles (dashed border, muted copy via `color-mix`, focus ring, reduced-motion-safe pulse).

**New**
- `src/lib/skins/shared/BlankDayScaffold.tsx` — the scaffold component. Reads `useEditing()`, computes which ghosts are still empty, and calls `onBlockAdd(afterIndex, kind, seed)` on click.

**Do not touch**
- Per-skin files (`cassian.tsx`, `epictetus.tsx`, `orsino.tsx`, etc.) — house rule #1.
- `src/routeTree.gen.ts`.

## Technical notes

**Seeded insert signature**

```ts
onBlockAdd: (
  afterIndex: number,
  kind: Block["kind"],
  seed?: Partial<Block>,
) => void
```

The trip-route implementation merges `seed` into `fresh` before splicing, so a click on the "Dinner reservation" ghost inserts:
```ts
{ kind: "place", name: "", category: "restaurant" }
```
with an empty `name` that `EditableText` renders as a placeholder — the user lands right on the field ready to type.

**Trigger detection**

```ts
const hasContent = blocks.some(
  (b) => b.kind === "place" || b.kind === "flight",
);
const showScaffold = editing && !hasContent;
```

Cheap, memoized inside the view.

**Accessibility**

- Ghosts are `<button type="button">` with visible text; no `aria-label` blanket-adds (house rule #2).
- Focus order follows visual order (outbound → day → morning → afternoon → evening → inbound → add day).
- Reserved space per ghost (min-height + fixed row heights) so nothing shifts as ghosts are removed — CLS stays 0.

**Tests + typecheck**

- Extend `blocks` fixtures with a `[]` case and a `[{ kind: "day", n: 1, label: "Day 01" }]` case to snapshot the scaffold.
- Add a unit test that clicking the "restaurant" ghost produces a `place` block with `category: "restaurant"`.
- Run `npx vitest run` and `tsc --noEmit` before finishing (house rule #5).

## Out of scope

- No changes to the AI / paste / transcript ingestion tabs.
- No changes to persistence — scaffold is view-only.
- No new dependencies.
- No changes to the sample-preview dossier (that has real blocks and isn't blank).
