## Goal
Let signed-in users add their own day photos (upload from device or paste URL) that replace the fallback Unsplash slides in each day's carousel. Default surface is per-day; each activity block (morning/afternoon/evening stop) also gets a smaller thumbnail control. Everything is gated to edit mode.

## Data model
No schema changes. Reuse the existing `images?: GalleryImage[]` on the `day` and `place` blocks (`src/lib/skins/types.ts`). Uploaded/pasted photos are appended to that array; the fallback pad logic in `ActivityImages` (already in place) fills any gap up to `MIN_DAY_IMAGES`.

## Storage
Create a public `dossier-photos` bucket (via `supabase--storage_create_bucket`, `public: true`). RLS on `storage.objects`:
- `SELECT` for anon + authenticated (bucket is public).
- `INSERT/UPDATE/DELETE` restricted to `bucket_id = 'dossier-photos' AND (storage.foldername(name))[1] = auth.uid()::text`.
Object key convention: `{userId}/{tripId}/{crypto.randomUUID()}-{safeFilename}`.

## New UI (edit mode only)
Two new components in `src/lib/skins/shared/views/`:

1. `DayPhotoManager.tsx` — full-width panel under the day header when `editing`. Thumbnails of existing `day.images` with per-image "Remove", "Upload photos" (multi-file `<input type="file" accept="image/*">`), and "Paste image URL" + Add. Progress + errors via `sonner`.
2. `ActivityPhotoThumb.tsx` — 44px "photo" button in each place row, edit-mode only. Popover with the same three affordances sized for a single thumbnail. Updates `place.images`.

Both call `onBlockChange(index, { images: next })` from `useEditing()`.

## Wiring
- `VerticalView.tsx`: mount `DayPhotoManager` under `EditableDayHeader`; `ActivityPhotoThumb` in each place row's action cluster.
- `HorizontalView.tsx` + `GridView.tsx`: same two components in their day header and place cells so parity holds across views.
- No changes to `parts.tsx` carousel logic — real images automatically take priority over fallbacks.

## Front-end ↔ back-end seam (tight, no lag)
This feature only touches storage + the existing autosave path. Every seam has an explicit contract so nothing waits on a serial round-trip:

1. **Auth reuse** — the browser `supabase` client (`@/integrations/supabase/client`) is already imported by the dossier route and holds the signed-in session. Upload calls (`supabase.storage.from('dossier-photos').upload(...)`) run over the same bearer, so no extra sign-in round-trip or middleware wiring is needed.
2. **Direct-to-storage upload** — the browser PUTs directly to Cloud Storage (Supabase Storage on Cloudflare). It does NOT round-trip through a server function, so upload throughput is bounded by the user's link + the storage edge, not by our worker cold start or the Data API. This is the fastest available path on this stack.
3. **Optimistic UI** — the moment `upload()` resolves, `getPublicUrl(path)` is synchronous (URL derivation, no network). We push the new `GalleryImage` into the block via `onBlockChange` immediately; the carousel re-renders with the real photo, and the fallback pad drops off in the same frame. There is no "processing" spinner between upload success and the image appearing.
4. **Existing autosave pipeline** — `onBlockChange` already flows through the trips autosave (`updateTripBlocks` server fn, debounced in `src/routes/t.$slug.tsx`). We add nothing here; the new `images[]` field piggybacks on the same debounced PATCH that already saves label/notes/date edits, so no extra server functions, no extra query invalidations, no extra network chatter per keystroke.
5. **Public read path is unchanged** — the dossier's public loader still reads `content.blocks` in one query; the new photo URLs are just strings inside that JSON. No N+1, no per-image lookup, no signed-URL step at render (bucket is public), so first paint and SSR performance for shared dossiers are unaffected.
6. **RLS matches the client contract** — the `(storage.foldername(name))[1] = auth.uid()::text` write policy mirrors the key convention the uploader uses. That means an upload either succeeds or fails immediately at the storage edge with a clear 4xx; we never let a "successful" upload leave a dangling reference in the block JSON. On failure we toast and don't mutate the block.
7. **Client-side guards prevent server thrash** — we reject `> 8 MB` and non-`image/*` files before the upload call, and we cap concurrent uploads (parallelism ≤ 3 per user gesture). That protects the storage edge from pathological batches and keeps the UI responsive.
8. **No new hot paths on the worker** — because uploads bypass our worker and reads are already served from the existing `getPublicTrip` server fn, this change adds zero new server functions and zero new HTTP endpoints. Nothing on the Cloudflare Worker gets slower.
9. **Post-launch verification** — after wiring, we sanity-check with `supabase--slow_queries` and browse the dossier route in the sandboxed Playwright environment to confirm carousel paint time and autosave debounce are unchanged versus the baseline.

## Upload path (browser)
```
supabase.storage
  .from('dossier-photos')
  .upload(`${userId}/${tripId}/${uuid}-${safe}`, file, { upsert: false, contentType: file.type })
```
On success: `supabase.storage.from('dossier-photos').getPublicUrl(path)` → push `{ src, alt, license: "user" }` into the block's `images` via `onBlockChange`.

## Constraints
- Only wired when `useEditing().editing === true` — locked dossier renders unchanged.
- File-size guard: reject files > 8 MB with a toast; accept `image/*` only.
- Parallelism cap of 3 concurrent uploads per gesture.
- No new dependencies.
- Tests + `tsc --noEmit` must stay green.

## Files touched
- `supabase/migrations/<ts>_dossier_photos_bucket.sql` (RLS policies)
- `src/lib/skins/shared/views/DayPhotoManager.tsx` (new)
- `src/lib/skins/shared/views/ActivityPhotoThumb.tsx` (new)
- `src/lib/skins/shared/views/VerticalView.tsx`
- `src/lib/skins/shared/views/HorizontalView.tsx`
- `src/lib/skins/shared/views/GridView.tsx`
- `src/lib/skins/shared/skin.css` (compact styles for both managers)

## Out of scope
- Reordering photos, alt-text editor, EXIF handling, image compression — leave as follow-ups.
- Photo Finder / Openverse browsing (already exists elsewhere).
