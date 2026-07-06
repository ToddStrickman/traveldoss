## Scope

Three intertwined changes:

1. **Language sweep** — user-visible "itinerary" becomes "dossier". (Except in the home screen)
2. **Lock/Unlock edit mode** — global toggle that switches the whole canvas between read and write; mobile is locked by default so a stray finger can't drag a card. Desktop stays unlocked so you can click straight into a field.
3. **Bottom-bar reclaim** — once a real (non-sample) dossier exists, the fat StudioBar collapses; the "Replace itinerary" CTA disappears entirely. Template picking moves off the bottom.

The previously-approved "add-day + auto-chronological reordering" work is a separate ticket and is explicitly out of scope here.

---

## 1) Language sweep: itinerary → dossier

Rename only user-visible copy. Do **not** rename files, exports, types, hooks, or CSS class names — that ripples through the codebase and off-scope tests without changing what the user sees.

### Strings to change


| File                                        | Line                     | Current                                                                                                         | New                                                                                                    |
| ------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/components/studio/StudioBar.tsx`       | 186                      | "Replace itinerary"                                                                                             | Removed with the whole button (see §3)                                                                 |
| `src/lib/skins/shared/BlankDayScaffold.tsx` | 98                       | "…real slot in your itinerary."                                                                                 | "…real slot in your dossier."                                                                          |
| `src/components/studio/ExportMenu.tsx`      | 117                      | "…reading your itinerary."                                                                                      | "…reading your dossier."                                                                               |
| `src/components/flow/IngestionModal.tsx`    | 138, 293, 356, 601, 1531 | "Reading your itinerary…", "Drafting your itinerary…", "Paste an itinerary — Day 1…", "Drafting your itinerary" | "Reading your dossier…", "Drafting your dossier…", "Paste a dossier — Day 1…", "Drafting your dossier" |
| `src/components/flow/IngestionModal.tsx`    | 155, 333                 | "…tailor the itinerary to you…" / "…tailor the itinerary."                                                      | "…tailor the dossier…"                                                                                 |
| `src/components/flow/IngestionModal.tsx`    | 365                      | "Couldn't generate that itinerary."                                                                             | "Couldn't generate that dossier."                                                                      |
| `src/routes/t.$slug.tsx`                    | 560                      | "Replace this dossier's itinerary?"                                                                             | Removed with the mint prompt (see §3)                                                                  |
| `src/lib/skins/shared/ShadowItinerary.tsx`  | 21                       | Visible heading "Shadow itinerary"                                                                              | "Shadow dossier" (component export name stays `ShadowItinerary`)                                       |
| `src/lib/skins/shared/ShadowItinerary.tsx`  | 16                       | `aria-label="Shadow itinerary — backup plans"`                                                                  | `aria-label="Shadow dossier — backup plans"`                                                           |


### Not renaming

- File paths (`src/lib/itinerary/*`, `use-itinerary-refiner`, `ShadowItinerary.tsx`).
- Type/function names (`Itinerary`, `buildItinerary`, `useItineraryRefiner`, `hardenItineraryAi`, etc.).
- CSS classes (`.tds-shadow-itinerary`, `.td-...`).
- Test string in `GenerationProgress.test.tsx` — updated to match the new copy so the test still passes.

---

## 2) Lock / Unlock edit mode

New global state that gates every interactive editor.

### State model

Store `locked` in `sessionStorage` under key `td:lock:<trip.slug>` so a refresh keeps the mode, but a fresh session picks the sensible default per device:

- Mobile (via existing `useIsMobile()`): `locked = true` by default.
- Desktop: `locked = false` by default.

Wire it into `t.$slug.tsx` alongside `canEdit`:

```ts
const [locked, setLocked] = useState(defaultLockFor(device));
const isEditing = canEdit && !locked;
```

Pass `editing: isEditing` into `EditingProvider` — every existing editable (`EditableText`, `MetaChip`, DnD sensors, ghost tiles, delete/add tools) already reads `useEditing().editing`, so they all flip together with zero per-component churn.

### Toggle affordances

- **Desktop** — a `LockPill` component fixed to the top-right of the canvas (same z-band as the current back-pill). Two visual states:
  - Locked: `Lock` icon · "Editing off" · muted seal border.
  - Unlocked: `Unlock` icon · "Editing on" · solid seal fill.
  Framer Motion `AnimatePresence` crossfades the label + icon (opacity + 4px slide) on toggle. `Cmd/Ctrl+E` shortcut mirrors the click.
- **Mobile** — the Lock/Unlock control becomes the primary right-side action in `DossierMastheadBar` (replacing the current `Days` chip position; Days moves into an overflow menu that only appears when there are 2+ days). Tap target 44px, respects safe-area-inset-top.

### Locked-mode behavior

- `EditableText` renders read-only (already handled by `editing === false`).
- `SortableBlocks` / `ActivityDndContext` skip mounting sensors when `editing === false` (already the case — but audit `dnd.tsx` line 80: `if (!editing) return <>{children}</>;` is correct).
- `MetaChip` shows values with no click-to-edit affordance.
- `BlankDayScaffold` still renders but ghost tiles get a `disabled` treatment with a single-line hint at the top of the scaffold: "Unlock to start filling in your dossier." Clicking a ghost while locked opens the unlock action instead of inserting a block.
- Mobile only: tapping any editable region while locked flashes a Sonner toast "Unlock to edit" once per session (rate-limited via a ref) so users learn the model without noise.

### Framer Motion

Uses the already-installed `motion` package (`motion/react`) — no new deps.

- `LockPill` icon+label crossfade: `AnimatePresence` + `motion.span` with `initial/animate/exit` opacity + 4px y-translate, `duration: 0.18`.
- Bottom bar reveal/hide (§3): `motion.div` with `initial={{y: 32, opacity: 0}}` → `animate={{y: 0, opacity: 1}}`.
- All animations respect `prefers-reduced-motion` via `useReducedMotion()` from `motion/react`, collapsing to opacity-only.

---

## 3) Bottom bar reclaim

Current `StudioBar` for a minted dossier carries: undo · redo · history · template select · saving status · **Replace itinerary** button. It's a lot of chrome, and Replace is the confusing part.

### New behavior

- **Sample state (`isSample === true`)** — unchanged. The "Mint this dossier" CTA still lives in the bar because that's how a user commits their scratch dossier into a real one.
- **Real dossier + locked** — bar hides entirely. A single tiny floating `Unlock to edit` pill sits bottom-right on desktop, bottom-center-safe-area on mobile. This IS the affordance; no other chrome.
- **Real dossier + unlocked** — bar slides up (Framer Motion) with the reduced set: [Lock] [Undo] [Redo] [History] [Saved status]. **No template select, no Replace CTA.**

### Where template picking goes

Template swaps are a deliberate design choice, not a per-edit action — they belong off the writing surface. Move the picker into:

- **Desktop** — a "Template" quiet chip attached to the top-right cluster next to the LockPill. Click opens a Popover with the same select. Only visible for the owner.
- **Mobile** — an entry in the `DossierMastheadBar` overflow (a new lightweight ⋯ menu; opens the same picker as a bottom sheet using the existing `TdSheet`).

### Where "Replace" goes

Gone. The AI-driven "replace the whole dossier" workflow moves into the desktop template menu as a secondary "Regenerate from source…" action, and the mobile overflow. It stops squatting on the bottom bar. The existing confirm-then-open-IngestionModal flow is unchanged; only its trigger location moves.

---

## 4) Reinforced blank-canvas cues

Existing scaffold already dashes each ghost tile. Add three ambient hints that only appear when `isEditing === true`:

1. **Hero placeholder underline** — `EditableText` gains a `data-editing="true"` attribute that applies a `.tds-edit-hint` rule: a 1px dashed underline in `color-mix(in oklab, var(--tds-accent) 55%, transparent)` on any element whose text equals its placeholder ("Trip title", "Day label", etc.). Fades in over 200ms on unlock, out on lock (Framer Motion).
2. **Meta-chip pulse** — empty `MetaChip` tiles already pulse (`td-chip-pulse`); the pulse is currently always on. Gate it on `editing === true` so a locked read-mode dossier reads calm.
3. **Ambient banner** — first time a user unlocks a blank dossier (no `place`/`flight` blocks), a one-line notice slides in above the scaffold: "Editing on — tap any dashed slot to add real content." Dismissible; remembered per-session via `sessionStorage`.

---

## 5) Mobile touch specifics

- Lock/Unlock is the mobile gate — no other change to sensor thresholds. The existing `ActivityDndContext` already uses a 250ms long-press touch sensor, which is fine once the user has consciously unlocked.
- Ghost tiles in `BlankDayScaffold` already carry `.tap` (44px min). Verify the LockPill mobile placement doesn't cover the top-right of the first ghost; if it does, add scroll-margin-top to the scaffold.
- No horizontal scroll introduced. CLS stays 0 (LockPill has fixed dimensions; bottom-bar reveal animates transform + opacity only).

---

## 6) Accessibility & house rules

- No aria-label blanket adds; LockPill's visible label satisfies its accessible name.
- All new tap targets ≥44px.
- `prefers-reduced-motion` collapses every Framer Motion animation to opacity-only via `useReducedMotion()`.
- Lighthouse a11y and CLS on `/t/<slug>` must stay at their current values — verify after implementation.

---

## Files to change

**Edit**

- `src/routes/t.$slug.tsx` — add `locked` state + `defaultLockFor(device)`, derive `isEditing = canEdit && !locked`, pass into `EditingProvider`. Remove the `onMint` + Replace prompt from the StudioBar mount when `!isSample`. Add the desktop LockPill + Template menu mounts.
- `src/components/studio/StudioBar.tsx` — accept a new `variant?: "sample" | "minimal"`. In `minimal` (real dossier, unlocked), drop the mint button, template select, and refine status label; render `[Lock][Undo][Redo][History][Saved]`. Wrap the outer `<div>` with `motion.div` for slide/fade. Update the removed "Replace itinerary" fallback copy.
- `src/components/mobile/DossierMastheadBar.tsx` — accept `locked`, `onToggleLock`, `canEdit`, `templateId`, `onTemplateChange`. Right-side slot becomes Lock when `canEdit`; Days moves to an overflow ⋯ menu when needed. Adds a "Template" entry into overflow (owners only).
- `src/lib/skins/shared/BlankDayScaffold.tsx` — read `editing` from `useEditing()`; when false, disable ghost buttons, dim guide text, show top-of-scaffold hint "Unlock to start filling in your dossier."
- `src/lib/skins/shared/Editable.tsx` — add `data-editing` to the `EditableText` element so the CSS hint rule can key off it.
- `src/lib/skins/shared/skin.css` — add `.tds-edit-hint` dashed underline for placeholder text; add gating for `td-chip-pulse`; small style for the ambient unlock banner.
- Copy sweep files listed in §1.

**New**

- `src/components/studio/LockPill.tsx` — the desktop lock toggle with Framer Motion transition and `Cmd/Ctrl+E` shortcut.
- `src/components/studio/TemplateMenu.tsx` — Popover-based template picker (desktop) + bottom sheet variant used by `DossierMastheadBar` overflow (mobile).
- `src/components/studio/UnlockBanner.tsx` — the one-shot "Editing on — tap a dashed slot…" notice above the scaffold.

**Not touching**

- `src/routeTree.gen.ts`, per-skin files (cassian/epictetus/orsino/etc.), `src/integrations/supabase/*`, itinerary lib code.

---

## Verification

- `bunx tsgo --noEmit` — clean.
- `bun test` — no regressions vs. baseline (7 pre-existing AI-parser failures unrelated).
- Manual: on desktop `/t/<slug>?mode=edit`, page loads unlocked, click Day 01 label, type — persists. Cmd+E locks; everything freezes. On mobile viewport, page loads locked, tap ghost → toast "Unlock to edit"; tap LockPill → scaffold ghosts activate; add a place; scaffold vanishes.
- CLS check via Lighthouse on `/t/<slug>` — must stay 0.

---

## Out of scope (tracked, not built)

- Add-Day affordance + chronological auto-reordering by date (previously approved separately).
- Any per-skin visual changes.
- Backend / persistence changes — `locked` is client-only session state.
- Renaming files, types, hooks, or CSS classes containing "itinerary".