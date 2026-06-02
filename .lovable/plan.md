# Verify build + tighten Live Studio

The new flow (TemplateGallery → IngestionModal → GenerationLoader → /t/$slug?mode=edit with StudioDrawer + ExportMenu + CompanionToday) is wired up and the dev server is running. The runtime error in the snapshot ("Failed to fetch dynamically imported module … virtual:tanstack-start-client-entry") is the transient reload Vite triggers after optimizing the newly-added `@radix-ui/react-dialog` and `@dnd-kit/*` deps — it should clear on the next load. I'll restart the dev server after edits to confirm.

Reading through the new code against the live schema and skin contract, I found a handful of real issues worth fixing in the same pass, plus a few small UX tighten-ups.

## Bugs to fix

1. **Owner detection is wrong on `/t/$slug`.** `getDossierBySlug` doesn't select `user_id`, so the `isOwner` check in `src/routes/t.$slug.tsx` always falls through to the `else if (data.user) setIsOwner(true)` branch — every signed-in user sees the Edit button. Autosave fails silently via RLS for non-owners.
   - Add `user_id` to the select in `src/lib/templates.functions.ts → getDossierBySlug`.
   - Replace the fallback with a real `trip.user_id === data.user.id` comparison.

2. **Drag-and-drop IDs are unstable across edits.** `tagBlocks` derives `__id` from array index + kind, so editing or reordering a block remounts every editor row (and any open inline editor collapses). Use a `WeakMap<Block, string>` (or a `useRef` map keyed by object identity) to mint a stable id once per block instance, falling back to a fresh id when a block is added.

3. **Print mode still shows chrome.** `ExportMenu.printPdf()` toggles `body.td-print-mode`, but `src/styles.css` only suppresses some elements. Add a print rule that hides the back link, ViewSwitch, StudioDrawer, ExportMenu, CompanionToday banner, and the Ribbon while `body.td-print-mode` (and `@media print`) is active. Tag those elements with `data-print="hide"` so the CSS stays generic.

## Studio UX tightening

4. **ExportMenu visibility.** Only render it when the route is in viewable state (i.e. always, but disable Google Docs unless `isOwner` to avoid the 404/412). Pass `disabled={!isOwner}` for the gdocs button.

5. **Edit drawer ↔ URL sync.** When the drawer opens or closes, mirror it into `?mode=edit` / no search param via `navigate({ search })`, so reloading keeps the studio open and "Close" returns to the clean URL.

6. **Companion banner empty state.** Hide `<CompanionToday />` entirely when `pickNext` returns null instead of rendering "Enjoy the trip." with no context.

7. **Restart dev server** at the end so the Vite virtual-entry import error from the dep re-optimization clears, then re-check the runtime errors snapshot.

## Out of scope

- No schema changes — every column the new code touches (`template_id`, `original_template_id`, `doc_id`, `doc_url`, `content`, `expires_at`) already exists.
- No changes to `parseDropIn`, `GenerationLoader`, or `gdocs.ts` — they match their callers.
- No new design tokens.

## Files touched

- `src/lib/templates.functions.ts` — add `user_id` to dossier select
- `src/routes/t.$slug.tsx` — real owner check, URL sync for drawer, conditional CompanionToday, mark chrome with `data-print="hide"`, pass `disabled` to ExportMenu
- `src/components/studio/StudioDrawer.tsx` — stable block IDs via WeakMap, `data-print="hide"` on `<aside>`
- `src/components/studio/ExportMenu.tsx` — accept/respect `disabled`, `data-print="hide"`
- `src/components/studio/CompanionToday.tsx` — return `null` when no next item, `data-print="hide"`
- `src/components/landing/Ribbon.tsx` (only if it lacks a print rule) — `data-print="hide"`
- `src/styles.css` — single block: `body.td-print-mode [data-print="hide"], @media print [data-print="hide"] { display: none !important }`

After edits I'll restart the dev server and re-check `code--read_runtime_errors` plus the dev-server log to confirm the build is clean.
