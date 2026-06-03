## Goal
Add undo/redo across every trip template so any edit to a dossier (block content, add/delete/reorder, template change, destination/subtitle rename, mint-replace) can be reversed and re-applied.

## Where state lives
All editable dossier state is centralized in `src/routes/t.$slug.tsx`:
- `blocks`, `templateId`, `destination`, `subtitle`

Every mutation flows through `editingCtx` (passed to all templates via `EditingProvider`), plus `onTemplateChange` and `handleMint`. This is the single chokepoint — we don't need to change individual skins.

## Approach
Introduce a small history stack of immutable snapshots `{ blocks, templateId, destination, subtitle }`, plus pointer `index`. One snapshot per committed change.

### 1. New hook: `src/hooks/use-history.ts`
- `useHistory<T>(initial, { limit = 100 })` returns `{ state, set, replace, undo, redo, canUndo, canRedo, reset }`.
- `set(next)` pushes a new snapshot (truncates redo tail). Coalesces rapid successive edits to the same "field key" within 500ms (so typing in an EditableText collapses to one undo step instead of one-per-keystroke).
- `replace(next)` updates current snapshot without growing history (used for initial load / server sync).

### 2. Refactor `t.$slug.tsx`
- Replace the four `useState`s with a single `useHistory` snapshot.
- Derive `blocks/templateId/destination/subtitle` from `history.state`.
- Each mutation in `editingCtx`, `onTemplateChange`, `handleMint` calls `history.set(producer)` with an optional coalesce key:
  - `onBlockChange(i, patch)` → key `block:${i}:${field}` (coalesce typing)
  - `onTripChange(field, value)` → key `trip:${field}`
  - `onBlockAdd / Remove / Reorder / onTemplateChange / handleMint` → no key (always a discrete step)
- After every committed change call existing `queueSave(...)` (debounced autosave stays unchanged).
- Mint replaces the snapshot but remains undoable (one step back restores prior dossier).

### 3. Keyboard shortcuts
- Global listener on the dossier route: Cmd/Ctrl+Z → `undo`, Cmd/Ctrl+Shift+Z and Cmd/Ctrl+Y → `redo`.
- Ignore when focus is inside a non-editable input/textarea/`contentEditable` element where the browser's native undo should win (we still trigger our undo if `canUndo` and the edit target is one of our `EditableText` fields — they re-render from state, so this is safe). Practical rule: only intercept when `!(target instanceof HTMLInputElement || HTMLTextAreaElement) || target.dataset.tdsHistorySkip`.
- Skip when `!canEdit`.

### 4. UI affordance in `StudioBar.tsx`
- Add two small icon buttons (lucide `Undo2`, `Redo2`) to the left of the Template select, sized to the existing `.tds-tap` 44px target on mobile.
- Disabled state when `!canUndo` / `!canRedo`. Tooltip with the shortcut.
- Plumb `onUndo`, `onRedo`, `canUndo`, `canRedo` props from `t.$slug.tsx`.

### 5. Reset boundary
- On route load / slug change, `history.reset(initialSnapshot)` so a fresh dossier starts with empty history.
- Mint also resets? No — keep history so user can undo a bad mint. We just push it as a normal step.

## Non-goals
- No server-side history persistence (in-memory per session is enough for this scope).
- No multi-user OT/CRDT — single-editor assumption holds (only owner can edit).
- No change to individual skin files; all templates inherit because they already route through `editingCtx`.

## Files to touch
- `src/hooks/use-history.ts` (new)
- `src/routes/t.$slug.tsx` (refactor state + shortcuts + props)
- `src/components/studio/StudioBar.tsx` (Undo/Redo buttons)

## Acceptance
- Cmd/Ctrl+Z reverses the last edit in every template (vertical/horizontal/grid) for any block type, template switch, destination/subtitle rename, and mint.
- Cmd/Ctrl+Shift+Z re-applies it.
- Undo/Redo buttons appear in StudioBar for owners only, correctly disable at history ends.
- Autosave still fires after undo/redo (server reflects current snapshot).
- Typing one word in an `EditableText` collapses to a single undo step, not one per keystroke.
