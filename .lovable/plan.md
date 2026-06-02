## Goal

Kill the left-rail block editor. Make the dossier itself the editor. Give every new trip a real AI-generated title + one-sentence ethos. Let owners freeze a trip as an offline snapshot. All of this must work in all three views (vertical / horizontal / grid).

## 1. Inline editing primitive

Add `src/lib/skins/shared/Editable.tsx`:

- `EditingProvider` (React context) carries `{ editing, onTextChange(path, value), onBlockChange(i, patch), onBlockRemove(i), onBlockAdd(after, kind), onReorder(from, to) }`.
- `<EditableText path="…" value={…} as="span|h1|p" multiline?>` — when `editing` is false, renders the value as plain text. When true, renders a `contentEditable` element with `suppressContentEditableWarning`, calls `onTextChange` on blur (debounced via the existing autosave). Styling stays identical to the original element so the document does not visually change between modes.
- `<EditableBlock index={i} block={b}>` — wraps a block with a hover toolbar (drag handle, delete, "+ add below"). Only visible when `editing` and on hover. Uses `dnd-kit` `useSortable`.
- Small `useStableIds(blocks)` (same `WeakMap` pattern already in StudioDrawer) so dnd ids survive edits.

`Editable.tsx` is the single source of truth: skins import these primitives.

## 2. Skin updates

For every text node currently rendered as plain JSX (`{hero.title}`, `{block.text}` etc.), swap to `<EditableText>` and wrap each block in `<EditableBlock>`. Touch:

- `src/lib/skins/shared/SkinFrame.tsx` — covers the 8 token-driven skins. Add a `<SortableContext>` around the body. Treat the hero as the trip's `destination` + `subtitle` (see §3), not a separate "hero block". Append a "+ Add block" affordance at the end when editing, in all three views.
- `src/lib/skins/epictetus.tsx` — same treatment for hand-built layout.
- `src/lib/skins/orsino.tsx` — same.

CSS additions in `src/lib/skins/shared/skin.css`:

- `.tds [contenteditable]:focus { outline: 2px solid var(--tds-accent); outline-offset: 4px; border-radius: 2px; }`
- `.tds-block { position: relative; }` plus a small `.tds-block-toolbar` that fades in on hover when an ancestor has `data-editing="true"`.
- Horizontal/grid views already place day cards as flex/grid items — the toolbar lives inside each card so editing works identically.

## 3. AI-generated title + ethos

New server function `generateTripIdentity` in `src/lib/trips.functions.ts`:

- Input: `{ blocks: Block[] }`.
- Calls Lovable AI (`google/gemini-2.5-flash`) with the parsed itinerary text and asks for strict JSON:  
  `{ destination: string (≤60), subtitle: string (one sentence, ≤140, no period) }`.
- Returns `{ destination, subtitle }`. Falls back to `{ destination: "Untitled Trip", subtitle: skin.personality }` on parse failure.

Wire-in:

- `createTripFromIngestion` now calls `generateTripIdentity` itself before insert, so the row lands with a real `destination` + `subtitle`.
- Expose a "Regenerate title" button in the studio control bar that calls a thin server fn and updates `destination` + `subtitle` via `updateDossier`.
- `IngestionModal` only needs to add a step label "Naming your trip…" to the generation loader; no schema change.

## 4. Title + ethos render in the document

Stop relying on a `hero` block for the title. The render tree becomes:

```text
H1 = EditableText(trip.destination) + accent dot
subtitle = EditableText(trip.subtitle)  ← italic, one line
[body blocks…]
```

Any legacy `hero` block from older trips is migrated on read: if `trip.destination === "Untitled Trip"` and a hero block exists, lift its title/subtitle into the trip fields once on first edit. (Pure client-side; no migration.)

## 5. Studio drawer → slim control bar

Replace `StudioDrawer` block list with a compact **control bar** anchored bottom-center (next to existing ExportMenu, mirrors the top ViewSwitch). Contents:

- Template selector (existing `<select>` of SKINS, but inline pill)
- "Regenerate title" button
- Save status dot ("Saving…" / "Saved · 10:42:11")
- Lock toggle (see §6)
- Existing ExportMenu folds into the same bar

Remove the entire fixed left drawer. The `?mode=edit` URL param is gone; editing is always on when `canEdit`. (View-only visitors still see the read-only document.)

`StudioDrawer.tsx` is deleted. `t.$slug.tsx` mounts the new `StudioBar.tsx` instead and provides the `EditingProvider` to the skin tree.

## 6. Offline lock mode

Migration: add `locked_at timestamptz` and `locked_snapshot jsonb` columns to `public.trips`. RLS unchanged.

Behavior:

- "Lock for offline" button writes `{ locked_at: now, locked_snapshot: { blocks, destination, subtitle, template_id } }`.
- When `locked_at` is set, the document renders from `locked_snapshot` (frozen), edit primitives become read-only, and a small "Locked snapshot · {date}" badge appears next to the title. "Unlock to edit" reverses it.
- PDF + Google Docs export already work against the rendered DOM / current blocks, so locking + exporting produces the same artifact the user sees. No export changes needed beyond hiding the toolbar (already handled by `data-print="hide"`).

## 7. Cleanup

- Drop unused `tagBlocks`/per-block sortable editor code.
- `CompanionToday` keeps working — it just reads `blocks` (locked or live, whichever is active).
- `archive` phase already forces read-only; lock layers cleanly on top.

## Files touched

- New: `src/lib/skins/shared/Editable.tsx`, `src/components/studio/StudioBar.tsx`, migration `add_trip_lock_columns`.
- Edit: `src/lib/skins/shared/SkinFrame.tsx`, `src/lib/skins/shared/skin.css`, `src/lib/skins/epictetus.tsx`, `src/lib/skins/orsino.tsx`, `src/lib/trips.functions.ts`, `src/lib/templates.functions.ts` (return locked fields), `src/routes/t.$slug.tsx`, `src/routes/index.tsx` (loader step label), `src/components/flow/IngestionModal.tsx` (loader step label).
- Delete: `src/components/studio/StudioDrawer.tsx`.

## Out of scope (pushing to a follow-up)

- Real-time collaboration / multi-cursor.
- Audio transcript upload (currently shows "coming soon").
- Editing flight-card fields in horizontal/grid views — flights stay in the summary card and are editable in vertical view first; we keep the existing inline form, just wired through `EditableText`.
