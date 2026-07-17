# Site UX Audit — Fix Plan

Findings from a full pass over the visitor path (`/`, `/templates`, `/t/$slug`, `/login`). Ordered by severity. Every change stays in `src/lib/skins/shared/*` or route/component files — no per-skin edits (house rule #1). All new mobile UI ships as `md:hidden` siblings or gated by `useIsMobile()` (house rule #3).

## P0 — Ship first

### 1. Fixed bottom-bar collision on `/t/$slug` (mobile)
`StudioBar`, `ExportMenu`, and `ViewPill` are all independently `fixed` near the bottom with the same safe-area offset. On a phone with the mint StudioBar plus either export or view pill, they overlap at the right edge.

- Introduce a shared bottom-stack layout constant (`src/lib/ui/bottom-stack.ts`) exporting offsets for row 0 (StudioBar), row 1 (ExportMenu / ViewPill).
- Push `ExportMenu` and `ViewPill` above `StudioBar` on mobile only, using the same `env(safe-area-inset-bottom)` math.
- When `isEditing`, hide `ExportMenu` (already partially done) and the floating `ViewPill` — put view switching in the top masthead instead so nothing competes with editing controls.

### 2. Per-day photo carousel
Today only a whole-trip Coverflow overlay exists; days render a static `ActivityImages` row. There's no owner upload path either.

- Build `src/lib/skins/shared/gallery/DayPhotoCarousel.tsx` — scroll-snap CSS carousel on mobile, 3-up cover-flow-lite on desktop, tap to open the existing Coverflow overlay pre-scrolled to that image.
- Replace `<ActivityImages>` inside each day header in `VerticalView` / `HorizontalView` / `GridView` with `DayPhotoCarousel` when `day.images.length > 0`; keep the existing static grid as a `prefers-reduced-motion` fallback.
- Add a lightweight owner upload button ("Add photos") in edit mode via `Editable.tsx` block toolbar: uses the existing `trip-photos` storage bucket if present, otherwise creates it (private bucket + RLS scoped by trip owner, GRANT to authenticated/service_role). Client resizes to ≤2000px / ≤300KB WebP, strips EXIF, requires alt text.
- Extend the shared `day.images` collector to feed `DayPhotoCarousel` from both `place.image` and any per-day `gallery` blocks (kind already exists in `types.ts`).

### 3. Collapsed-column layout in Horizontal/Grid boards
A collapsed middle column can leave a tall empty gap next to expanded siblings.

- Verify with Playwright at 375px with a 3-day trip / middle collapsed; if the gap appears, set `align-items: start` on the board grid and add a subtle "expand" affordance in the collapsed column footer so it doesn't read as a layout bug.

## P1 — Clarity & polish

### 4. Truncate/expand affordance (desktop + mobile)
The butler-cloche icon is charming but not universally recognized as "collapse". First-time users miss it.

- Add a persistent chevron caret next to the cloche in `CollapseToggle` (`editing-kit.tsx`): rotates 0°/180° on toggle. Cloche stays for personality; chevron carries the affordance.
- Add a visible "Collapse" / "Expand" text label at ≥768px (currently label is `aria-label` only). Mobile keeps icon+chevron to save space.
- Increase touch target to 32×32 for the "part" variant on mobile (currently 26×26 with a 16px glyph).
- Unify Grid desktop `<details>` disclosure with `CollapseToggle` so desktop and mobile Grid share one pattern.
- Persist collapse state per trip in `localStorage` (`tds:collapsed:{tripId}`) so refreshes remember it.
- Add a "Collapse all days / Expand all" control in the masthead for trips with ≥3 days.

### 5. Save-status parity on mobile
`EditingStatusBar` shows autosave feedback on desktop; the mobile `DossierMastheadBar` shows nothing.

- Add a compact `SaveStatus` chip (idle / saving / saved · time) to `DossierMastheadBar` mirroring the desktop component.

### 6. Refinement history on mobile
Currently `hidden sm:inline-flex` — mobile owners can't reach it.

- Surface refinement history inside the mobile masthead overflow (three-dots) or as a sheet trigger on tablet+phone.

### 7. Login / signup (Spec 3, partial)
- Split `/signup` as its own route rendering the shared `AuthCard` in signup mode; keep in-page mode toggle as fallback.
- Read `template_id` / `view` from `search`, persist through OAuth via `mint-pending`, and render a "Continuing with {skin}" chip above the form.
- On `invalid_credentials`, offer "No account found — Sign up instead?" linking to `/signup?email=...`.
- Fix duplicated Tailwind class on `login.tsx:183` (`md:py-20 md:py-28`).

### 8. Export button labels on mobile
Three unlabeled circular icons are ambiguous. Show a short text label ("PDF", "Doc", "Cal") next to each icon on mobile, or collapse to a single "Export" pill that opens a sheet with labeled rows.

### 9. Gallery edge cases
- Show the gallery button in mobile edit mode too (currently hidden) so owners can preview while editing.
- Lower `MIN_IMAGES` to 1 so a single hero photo still opens.
- When trip photos exceed `MAX_IMAGES = 24`, show a subtle "+N more" indicator instead of silently dropping.

### 10. Templates page polish
- Fix typo `templates.tsx:497` "mint it it will go live" → "mint it — it will go live".
- Resolve the nested `<button>` inside `role="button"` card by making the whole card a plain `<div>` with a single top-level `<button>` for pick, or vice-versa.
- Debounce the `SkinPreview` basis switch across the 767px breakpoint so template thumbnails don't jump on tablet resizes.

### 11. MetaChip long-value wrapping
Add `max-w-full min-w-0` on the chip value span and let the interests chip expand to a second row rather than clipping.

### 12. Destructive action safety
`MetaChip` "Clear" wipes fields instantly with autosave 800ms later. Add a small inline "Undo" toast (5s) whenever a clear/delete commits — replaces the missing mobile Cmd-Z.

## P2 — Nice-to-haves / code hygiene

- Extract the three copies of `bottom-[max(16px, env(safe-area-inset-bottom))]` (`ActionDock`, `StudioBar`, `ExportMenu`) into one utility.
- Rename `tds-act-delete` used for the edit-pencil in `GridView.tsx:45` to `tds-act-edit`.
- StudioBar template `<select>` on mobile: constrain to 120px and show ellipsis.
- `t.$slug.tsx` mint-modal effect: add a `didOpenRef` guard so it can't re-open on unrelated re-renders.
- `templates.tsx` scroll-restoration: always restore `window.history.scrollRestoration` in a `finally` cleanup.
- Reduced-motion fallback for the collapse "drop" animation: keep a static position change so reduced-motion users still see the toggle move under the label.
- Landing "Login" pill (`index.tsx:224`): raise contrast and drop the shimmer so it reads as a primary auth entry, not decorative eyebrow text.

## Sequencing & gates

1. P0.1 (bottom-bar collision) → visual verify at 320/375/430.
2. P0.2 (per-day carousel + upload) — behind the storage/RLS migration; ships with `tests/day-carousel.test.tsx` + Playwright upload spec.
3. P0.3 (board layout) — Playwright verification first, then fix if reproduced.
4. P1 clarity items (4–7) in one batch since they touch shared kit + masthead.
5. P1 polish (8–11) + P2 hygiene as a cleanup pass.

Each slice ends with `bunx vitest run` + `tsgo --noEmit` green.

## Out of scope

- Per-skin file edits (house rule #1).
- Rewriting existing Coverflow overlay (only extending it).
- Desktop bubbles / gyroscope work (already retired).
- Payments, auth providers, backend schema beyond the `trip-photos` bucket + RLS.

## Open items to confirm before starting

- Confirm `HorizontalView` collapsed-column gap actually reproduces (P0.3).
- Confirm no photo-upload code already exists on an unmerged branch before I build Spec 2.
- Do you want the per-day carousel to double as the owner upload surface, or should uploads live only in the block toolbar? (Recommendation: both — the carousel gets a "+" tile in edit mode.)
