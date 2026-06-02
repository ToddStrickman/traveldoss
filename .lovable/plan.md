## Terminology
"Template" everywhere user-visible (replaces "Skin" / "Collection"). Internal code keeps `skin` / `SKINS` / `template_id` to avoid a destabilizing rename.

## Step 1 — Discovery (`/`)
- Landing already has the right-hand `InfiniteDocs` rail and `Ribbon`. Keep both.
- Add a centered editorial template gallery section beneath the hero on `/` (reusing `SkinPreview` card style from `templates.tsx`, lighter density).
- Replace `<Link to="/templates">` on both the rail and gallery with a click handler that sets `selectedTemplate` in a tiny global store and opens `<IngestionModal />`.
- Keep `/templates` reachable as a deep-link fallback but stop driving the main funnel through it.

State: `useTemplateFlow` zustand-style store in `src/lib/flow/store.ts` holding `{ selectedTemplate, modalOpen, isGenerating, generationSteps }`.

## Step 2 — `<IngestionModal />`
- New `src/components/flow/IngestionModal.tsx`, built on `Dialog` (shadcn) with the `surface-card` aesthetic.
- Three tactile cards side-by-side (stack on mobile):
  - **A. Paste Itinerary** → expanding `textarea` (auto-grow). Reuses `parseDropIn(text, "text" | "ai")` from `src/lib/itinerary/parse.ts`.
  - **B. Upload Transcript** → drag-and-drop + file picker (`.txt`, `.vtt`, `.srt`, audio types). Audio path: stub with "Coming soon" toast in v1; text/transcript files read via `FileReader` and routed through `parseDropIn(text, "transcript")`.
  - **C. Scan Inbox** → triggers existing `/api/public/google/start` OAuth flow. Sub-text per spec. Post-OAuth handler (already in place) sets a pending-import flag; on return we read the user's recent bookings via a new server fn `ingestFromGmail` (placeholder query for v1; returns parsed `Block[]`).
- Footer: primary "Generate Dossier" CTA in Champagne Gold (existing `bg-seal` button styling, gold gradient on hover).
- Closes by setting `modalOpen=false`; never unmounts the selected template.

## Step 3 — Ceremony (`isGenerating`)
- On submit: set `isGenerating=true`, fade modal out (`AnimatePresence`).
- Reuse the existing `GenerationLoader` but pass a custom step list (`"Reading your input…" → "Crafting your dossier…" → "Designing the pages…"`).
- Add a sweeping gold gradient to the headline text via a `bg-clip-text` animated background-position (no spinners, no skeletons).
- Background work (all in parallel):
  1. `parseDropIn` or `ingestFromGmail` → `Block[]`.
  2. New server fn `createTripFromIngestion({ templateId, blocks, sourceMeta })` that mints a row in `trips` (reuses `pickTemplate`'s logic but accepts pre-parsed blocks instead of `DEMO_BLOCKS`).
  3. On success → `navigate({ to: "/t/$slug", params: { slug }, search: { mode: "edit" } })`.
- Failure: keep modal data, surface inline error inside the loader card.

## Step 4 — Live Studio (`/t/$slug?mode=edit`)
- Extend `src/routes/t.$slug.tsx` to read `?mode=edit` via `validateSearch`. Only the trip owner sees edit affordances (already enforced by RLS on writes; client check via `supabase.auth.getUser()`).
- New `src/components/studio/EditableSkin.tsx` wraps `<skin.Render />` and, when `mode=edit`:
  - Renders `<EditableBlock>` per block; click toggles a `contentEditable` div for paragraphs / headings.
  - Day/reservation reorder via `@dnd-kit/core` + `@dnd-kit/sortable` (add deps).
  - Floating skin switcher (top-right) — dropdown over `SKINS`. Switching only updates `template_id` + re-renders; blocks are skin-agnostic, so no data loss.
- Autosave: debounced (1s) `updateDossier({ slug, content, template_id })` server fn. Inline "Saved · 12:04" indicator near the floating toolbar.

## Step 5 — `<ExportMenu />`
- Floating bar bottom-right in edit mode (always visible in read mode).
- **Live URL**: copy `https://traveldoss.com/t/{slug}` and toast.
- **PDF Export**: client-side print path using `window.print()` against a dedicated print stylesheet (`@media print` rules in `src/styles.css` + a per-skin print layout block in `SkinFrame.tsx`). This preserves every `<a href>` as a real clickable hyperlink in the resulting PDF (browser print engines embed them natively). No server-side rasterization — that would break hyperlinks and isn't viable in the Worker runtime.
- **Google Docs**: new server route `/api/public/export/gdocs` that uses the `google_docs` connector gateway (per `<google_docs>` knowledge) to create a doc, then batchUpdate-insert the trip's blocks as paragraphs/headings/links. Requires the user's existing Google OAuth token (already stored in `google_tokens`) — we'll piggyback on it rather than the workspace connector so the doc lands in the end-user's Drive.

## Step 6 — `temporalPhase`
- Helper `getTemporalPhase(start_date, end_date)` → `"dreaming" | "active" | "archive"`.
- Wired into `t.$slug.tsx`:
  - **Dreaming**: current behavior. Cover + full itinerary, fully editable.
  - **Active**: prepend a `<CompanionToday />` panel that pins the next reservation, map link, and confirmation # above the fold. Inline editing still enabled.
  - **Archive**: force `mode=view`, hide ExportMenu writes (keep PDF/Doc export), add a sepia-tinted "Memories" ribbon header. Block all `updateDossier` calls.

## Database changes
None required — `trips.content jsonb` already stores blocks, `template_id` already swappable, `start_date`/`end_date` drive phase logic. Edits go through existing RLS policies on `trips`.

## File map
```
src/lib/flow/store.ts                   (new, ~40 LOC)
src/components/flow/IngestionModal.tsx  (new)
src/components/flow/TemplateGallery.tsx (new, used on /)
src/components/studio/EditableSkin.tsx  (new)
src/components/studio/SkinSwitcher.tsx  (new)
src/components/studio/ExportMenu.tsx    (new)
src/components/studio/CompanionToday.tsx (new)
src/lib/itinerary/temporal.ts           (new helper)
src/lib/trips.functions.ts              (add createTripFromIngestion, updateDossier, ingestFromGmail)
src/routes/api/public/export/gdocs.ts   (new server route)
src/routes/index.tsx                    (gallery + modal mount)
src/routes/t.$slug.tsx                  (mode=edit, phase logic, ExportMenu)
src/styles.css                          (print stylesheet)
```

## Out of scope for this pass
- Audio-transcript transcription (file accepted but flagged "coming soon").
- Real Gmail ingestion intelligence beyond a stub query — the OAuth + UI is wired, the parsing heuristics stay v1.
- Stripe checkout for the $1 charge — `pickTemplate`/`createTripFromIngestion` currently mint trips directly; gating can land in a follow-up.

## Open questions to flag, not block
- Print-to-PDF (browser) vs. server-rendered PDF: I'm choosing browser print specifically because it's the only path that keeps `href`s clickable in the Worker stack. If you want a magazine-grade server-side PDF with clickable links, that's a separate effort (likely a paid HTML-to-PDF API).
