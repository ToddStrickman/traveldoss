# Dossier Editing Redesign + Four Bug Fixes — Plan

## Part A · Dossier Editing Experience Redesign

### Reuse-first inventory (no parallel UI)

- `LockPill` (`src/components/studio/LockPill.tsx`) — extend, don't replace.
- `StudioBar` (`src/components/studio/StudioBar.tsx`) — its save-state read-out is extracted to a `SaveStatus` subcomponent and reused.
- `EditingProvider` / `useEditing` / `EditableText` / `SortableBlocks` (`src/lib/skins/shared/Editable.tsx`) — already flip every field to contentEditable when unlocked. No per-field edit buttons.
- `editing-kit.tsx` (`AddActivitySlot`, `AddDayButton`, `DayReorderControls`, `useAddDay`, `useDeleteDay`, `useMoveDay`) — restyled, not duplicated.
- `ExportMenu` (`src/components/studio/ExportMenu.tsx`) — Copy Link handler + toast reused; the "Live URL" button moves out.
- `TdSheet` + shadcn `DropdownMenu` — reused for the item overflow menu.
- `sonner` `toast` — reused for copy/save feedback.

### Changes

1. **Single Locked / Editing model.** `locked` in `t.$slug.tsx` stays the only source of truth. Remove the row-level `Trash2` in `parts.tsx` (delete lives in overflow menu now). No modal, no confirm, no scroll jump on toggle.
2. **One sticky editing-status bar (mobile + desktop).** New `EditingStatusBar` (composes `LockPill` + `SaveStatus` + `SharedDossierCard`). Replaces the top mobile "Editing · auto-saves" banner AND the bottom `StudioBar` placement on `/t/:slug`. `StudioBar` stays intact for the pre-mint sample flow (`emphasis="mint"`).
  - Locked chip: `Lock · Locked · Unlock editing`.
  - Editing chip: `Unlock · Editing · Saving…/Saved ✓/Offline — waiting/All changes synced ✓ · Undo/Redo · Lock`.
3. **Inline "Add" cards.** Restyle `AddActivitySlot` and `AddDayButton` as full-width dashed cards using skin tokens (`--tds-rule`, `--tds-soft`); hover lift + seal-tinted border. Tap opens the existing `InlineActivityEditor` in place across Vertical / Horizontal / Grid via the shared kit.
4. **Share Dossier component (replaces "Live URL").** New `ShareDossierCard` (title · URL · Copy · Locked/Editing badge). Desktop: right side of the status bar. Mobile: stacked below it, full-width Copy, no horizontal scroll. Copy calls the extracted `copyDossierLink(slug)` in `src/lib/share.ts` and fires `toast.success("Copied to clipboard")`. Remove the Live URL button from `ExportMenu`.
5. **Overflow menu on repeatable items.** New `ItemOverflowMenu` wrapping shadcn `DropdownMenu` on desktop and `TdSheet` on mobile. Options: Duplicate (calls `onBlockAdd(index, block.kind, { ...block })`) and Delete (calls `onBlockRemove`).
6. **Real-time sharing model.** No publish concept. The public route already reads latest saved `content` on every request, so autosave IS publish. The Shared Dossier URL is always current — reflected by the copy tooltip "Shares the latest saved version".

### New files (only where nothing fits)

- `src/components/studio/EditingStatusBar.tsx`
- `src/components/studio/SharedDossierCard.tsx`
- `src/components/studio/ItemOverflowMenu.tsx`
- `src/lib/share.ts` (thin helper)

### Files modified

- `src/routes/t.$slug.tsx` (mount bar, remove banner + bottom bar, drop `max-md:hidden` on `ExportMenu`)
- `src/components/studio/LockPill.tsx` (`variant="status"`)
- `src/components/studio/StudioBar.tsx` (export `SaveStatus`; leave mint flow alone)
- `src/components/studio/ExportMenu.tsx` (remove Live URL button; export `copyDossierLink`)
- `src/lib/skins/shared/Editable.tsx` (swap row `Trash2` → `ItemOverflowMenu`)
- `src/lib/skins/shared/views/editing-kit.tsx` (dashed add cards; drop redundant "Day added" toast)
- `src/lib/skins/shared/skin.css` (token-driven styles for add card + overflow trigger)

### State / API / schema

None. All state already exists (`locked`, `saving`, `savedAt`, `saveError`, slug). No new deps.

---

## Part B · Bug Fixes

### B1. Paste-parser: results don't render until user hits Edit

**Diagnosis (to confirm in the fix session, not now):**

- `IngestionModal.tsx` calls `parseItineraryAi`, then invokes `onGenerate(blocks, …)` — in `src/routes/t.$slug.tsx` (line 751) that is `handleMint`, which persists to Supabase.
- Strong suspicion (matches user's hypothesis): after `handleMint` writes, the local `blocks` state that feeds `SkinFrame` isn't updated in the same tick — the route only re-reads on loader invalidation. Toggling Edit re-runs a state effect that reseeds from persisted content, so the parsed itinerary "appears" then.

**Fix scope (state/data-flow only, per guardrails):**

- On successful parse in `IngestionModal`, hand blocks to the caller AND update the route's local `blocks`/`view` state synchronously — same setter path `EditingProvider` already uses for edits — before closing the modal. Call `router.invalidate()` after the DB write resolves so loader-derived state is authoritative.
- Immediate loading state: show `GenerationProgress` (already exists) the moment `parseItineraryAi` is dispatched — including on the "paste" tab, not just the "generate" tab (see gate at IngestionModal:658 `tab === "generate" && parsing`). Extend the gate to `(tab === "paste" || tab === "generate") && parsing`.
- Timeout: wrap `parseItineraryAi` in `withRetry`/`AbortController` with a 45s ceiling; on timeout show inline error card with **Try again** action (reuse the toast+action pattern from `ExportMenu.exportToGoogleDoc`).
- Error state: on catch, render the existing inline warning card with `Try again` button — never close the modal to a blank canvas.

**Files:** `src/components/flow/IngestionModal.tsx`, `src/routes/t.$slug.tsx`, `src/routes/index.tsx` (mirror the same success handler), `src/lib/itinerary/parse-ai.functions.ts` (accept `AbortSignal`).
**Guardrails:** no changes to parser prompt, parsing logic, or block schema.
**Verify:** paste a sample itinerary → progress visible → content on screen without touching Edit → intentionally corrupt paste → error card with Try again.

### B2. Email/password signup and login broken; Google works

**Diagnosis to run first (report before fixing):**

- `src/routes/login.tsx` `onSubmit` already calls `supabase.auth.signUp` / `signInWithPassword` and toasts errors. Two likely real causes: (a) Supabase project has email provider disabled or email confirmations required with no delivery configured; (b) after signup with confirmations on, `signUp` returns no session and code falls through with only a toast — new users think it failed.
- Verify via `supabase--configure_auth` inspection + Auth logs. If email confirmations required, verify email infra is set up (`email_domain--check_email_domain_status`).

**Fix scope:**

- If email provider is off, enable via `supabase--configure_auth`. If HIBP not on, keep as-is (out of scope).
- If auto-confirm off + no delivery, either (a) enable auth email templates (`email_domain--scaffold_auth_email_templates`) OR (b) turn `auto_confirm_email: true` — only if the user approves; do not silently flip.
- Distinguish error paths in `login.tsx`: `invalid_credentials` → "Wrong email or password"; `email_not_confirmed` → "Confirm your email to sign in" with **Resend** button (`supabase.auth.resend`); `user_already_registered` → "An account exists — sign in instead" with a mode-switch link.
- After successful `signUp` with a session, `window.location.assign(redirect)` like the signin branch. Without a session, keep the check-email toast but ALSO render an inline confirmation panel (no navigation).
- `emailRedirectTo` uses `window.location.origin + redirect` — verify `redirect` sanitization already in place (it is) and that the deployed origin, not localhost, is used at runtime.

**Files:** `src/routes/login.tsx`; possibly `supabase--configure_auth`, `email_domain--*` tools.
**Guardrails:** no changes to Google OAuth flow, session handling for existing users, or DB tables beyond auth.
**Verify:** fresh signup email works end-to-end; wrong-password shows specific error; unconfirmed-email shows resend; Google login unchanged.

### B3. Lock/unlock control is unintuitive

**Audit (report in fix session):** `LockPill` currently renders top-right on desktop as an icon-only pill (`hidden sm:inline` for label), title `"Editing off/on (⌘/Ctrl+E)"`; on mobile it appears only inside the top banner when already unlocked — first-time owners never see how to enter Edit.

**Fix (folds into Part A):**

- The new `EditingStatusBar` always renders explicit `Edit` (view) / `Done` (edit) BUTTONS with labels — not icon-only — on both breakpoints, with 44px hit area.
- Toggle feedback: `toast.success("Editing enabled" / "Editing locked")` on transition; canvas gets `data-editing="true"` which drives a subtle outline on hover-editable regions (already partially present in `skin.css`).
- Locked-state helper text: "Locked to prevent accidental changes — tap Edit" as a tooltip on the button (1s delay, matching the ActionDock tooltip pattern).
- Keep ⌘/Ctrl+E as a power-user shortcut; label the button with it in `title`.

**Guardrails:** UI/UX only. No permission/ownership/field-editability changes.
**Verify:** on 375px and desktop, describe view → tap Edit → banner shows "Editing" + Done button → tap Done → banner shows "Locked" + Edit button; toast confirms each toggle.

### B4. Generation/processing overlay never appears on mobile

**Diagnosis to confirm:**

- `IngestionModal` gates `<GenerationProgress>` on `tab === "generate" && parsing` (line 658). On the paste tab (mobile-common), overlay never mounts (also B1). Additionally, `GenerationLoader` in `src/routes/index.tsx` uses fixed positioning + `vh`; check for `hidden md:*` classes.
- Suspect stack: `IngestionModal` `DialogContent` may set `md:max-h-…` allowing progress to be scrolled out of view on mobile; and the outer sheet's `overflow` may clip the fixed overlay.

**Fix:**

- Extend the parsing gate to all intake tabs (paste/upload/generate) — same change as B1.
- Ensure `<GenerationLoader>` and in-modal `<GenerationProgress>` use `fixed inset-0 z-[70] min-h-[100dvh]` (swap any `100vh` → `100dvh`); no `hidden md:*`.
- On mobile, promote the progress panel to a full-viewport layer (`fixed inset-0`) inside the modal instead of the scrollable content area, so the address-bar collapse doesn't hide it.

**Files:** `src/components/flow/IngestionModal.tsx`, `src/components/GenerationLoader.tsx`.
**Guardrails:** no visual redesign of the panels; match desktop behavior.
**Verify:** at 375px width, paste and generate flows both show the panel throughout; desktop unchanged.

---

## Cross-cutting

- No changes to skin content files (`src/lib/skins/*.tsx` except `shared/`) — House Rule #1.
- No changes to `routeTree.gen.ts` or generated Supabase files.
- After each part: `npx vitest run` and `tsc --noEmit` clean. Add tests:
  - `EditingStatusBar` renders `Shared Dossier` URL + copy in both locked/editing states.
  - Parse success in `IngestionModal` calls `onGenerate` AND leaves modal in a state that resets `parsing` before render.
  - `login.tsx` maps known Supabase auth error codes to human strings.
- CLS on `/t/:slug` unchanged (bar has reserved height in both states).