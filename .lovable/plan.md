
# TravelDoss Feature Spec Pack — Combined Plan

Build order per your call: **4 → 1 → 3 → 2**. Each slice ships behind clean typecheck + tests, no skin-file edits, mobile-first, CLS-0. Spec 0 is delivered as an advisory since I can't run `git branch -a` from here — I'll produce it as a markdown checklist you can execute.

---

## Slice A — Spec 0 (Advisory)

Deliver `docs/branch-audit.md`: a template with the exact `git` commands, a reconciliation table skeleton (branch · contents · merged? · relevant? · action), and a targeted search checklist for photo/view-switcher/mobile/bubbles/auth work. No code changes. You run the CLI, fill the table, then greenlight the rest.

---

## Slice B — Spec 4: Retire Bubbles (subtractive, ship first)

1. **Delete** `src/components/motion/MobileBubbles.tsx`, `src/hooks/use-device-tilt.ts`, and any `GyroWallpaper` usage on mobile. Keep `GyroWallpaper` only if it has a desktop, non-orientation code path; otherwise delete it too (recommendation: remove everywhere per your own doc §4A).
2. **Purge listeners**: grep-and-remove any `deviceorientation`, `DeviceMotionEvent`, `requestPermission` call sites. Zero live references remain.
3. **Update imports** in `src/routes/index.tsx` and anywhere else that mounts them; verify no orphaned spacing (SandHero stays untouched).
4. **Test**: add `tests/no-orientation-listeners.test.ts` — greps the built bundle for `deviceorientation`/`requestPermission` and fails on match.

Acceptance: bundle drops, no iOS permission prompt possible, mobile layout identical minus the bubbles slot.

---

## Slice C — Spec 1: Mobile Integrity + Time-of-Day + View Pivot

### C1. Overflow tripwire + root-cause sweep
- Add `tests/mobile-overflow.test.ts` using Playwright: for each of the 3 views × sample dossier at 320/375/430, assert `document.scrollWidth <= innerWidth`.
- Sweep shared views + `skin.css`: add `min-width: 0` to flex/grid children of day columns and boarding-pass rows; add `overflow-wrap: anywhere` to `.tds-edit`, note/address cells, and URL-bearing text; replace any fixed `px` widths with `clamp()`/`minmax()`.
- `contenteditable`: enforce `max-width: 100%`; use `visualViewport` to scroll active block above the mobile keyboard (helper in `src/lib/skins/shared/keyboard-anchor.ts`).
- Verify `HorizontalView` and `GridView` collapse to Vertical below 768px (current code uses `md:` gates — audit and fix any leak).

### C2. Time-of-day icons — **recommendation: icons+labels on existing PartOfDay buckets only**
Rationale: `PartOfDay` already exists in `src/lib/skins/shared/itinerary.ts` and drives Vertical/Grid buckets. Adding a `timeOfDay` field on individual place blocks duplicates that signal, forces a schemaVersion bump, and touches the AI parser, normalizer, and every skin. Sticking to bucket labels gets the visible win with zero schema risk. Revisit only if you later want cross-bucket ordering (e.g., "6am flight before morning coffee").

Implementation:
- New `src/lib/skins/shared/PartOfDayLabel.tsx`: inline SVG (sunrise/sun/moon) + text label ("Morning/Afternoon/Evening/Night"). Stroke inherits `currentColor` so each skin's tokens color it.
- Wire into `VerticalView`, `HorizontalView`, `GridView` bucket headers. No per-skin edits.
- Extend `tests/mobile-edit-parity.test.tsx` with an assertion: each bucket header has both an icon (`svg` role) and text label across all three views.

### C3. Mobile view pivoter that a thumb can find
- Current: `ViewSheet.tsx` opens from a floating pill. Keep the pill but promote it to a **bottom-anchored 3-option segmented control** (44px, above `env(safe-area-inset-bottom)`) that auto-hides on scroll-down and reappears on scroll-up. First-visit pulse + one-shot tooltip persisted in `localStorage` per trip_id.
- Preserve all existing Epic H contracts (`?view=` param, `view_switched` analytics — add device class dimension).
- Desktop unchanged.

---

## Slice D — Spec 3: Auth Screen Sign-Up Distinction + Flow Integrity

1. **Split routes**: keep `/login` (current), add `/signup` that renders the same component in signup mode. `login.tsx` already exists; extract shared form into `src/components/auth/AuthCard.tsx`, thread `mode: 'login' | 'signup'`.
2. **Button hierarchy**: primary filled "Log in" / outlined 44px "Sign up" beneath a hairline rule and "New to TravelDoss?" caption. Mirror on signup screen.
3. **Context chip**: if `template_id` + `view` were on the query string, show "Continuing with **{skin name}**"; persist through OAuth round-trip (already using `mint-pending.ts` — extend to also stash `authIntent: {templateId, view}` so it survives magic-link/OAuth).
4. **Unknown-email recovery**: catch Supabase `invalid_credentials` on login, offer "No account found — Sign up instead?" that navigates to `/signup?email=...`.
5. **Mobile**: 16px input font, submit visible above keyboard, "Open Mail app" hint on magic-link screen.
6. **Analytics**: emit `auth_screen_viewed`, `auth_mode_switched`, `auth_completed` with entry-point dimension.

No schema changes.

---

## Slice E — Spec 2: Photo System

### E1. Storage + RLS (migration in same slice, since you greenlit)
- Create private bucket `trip-photos` via `supabase--storage_create_bucket`.
- Migration: RLS on `storage.objects` scoped to `trip-photos` where the path prefix `trips/{trip_id}/` maps to a trip owned by `auth.uid()` (join via `public.trips`). Owner-only INSERT/UPDATE/DELETE; SELECT allowed for anon only when the parent trip is published (mirrors public trip visibility).

### E2. Schema
- Extend `Block` union in `src/lib/skins/types.ts`:
  - `{ kind: 'gallery', images: GalleryImage[], layoutHint?: 'carousel' | 'collage' | 'auto' }`
  - Optional `image?: GalleryImage` on `place` blocks.
- `GalleryImage = { id, storagePath, alt, caption?, width, height, dominantColor? }`.
- Bump `content.schemaVersion`; existing zod validator ignores unknown block kinds already (R9). Update `parse.ts` / `normalize-ai.ts` to skip cleanly.

### E3. Upload pipeline
- New `src/lib/photos/upload.ts`: client-side resize (canvas → WebP, JPEG fallback, ≤2000px long edge, ≤300KB), EXIF strip, compute dominant color, capture `width`/`height`. Cap 20/trip enforced in UI.
- Alt text required; default from `place.name` or caption. `aria-live` prompt.
- Server fn `savePhotoRecord` under `src/lib/photos.functions.ts` (uses `requireSupabaseAuth`).

### E4. Rendering (shared views only — never per-skin)
- **Mobile carousel** (`src/lib/skins/shared/gallery/PhotoCarousel.tsx`): CSS scroll-snap cover-flow, dot counter, tap → existing lightbox pattern extended with pinch-zoom via `@use-gesture/react` (already in deps? — will check; if not, hand-rolled pointer-events, no new dep).
- **Desktop collage** (`src/lib/skins/shared/gallery/CollageRoll.tsx`): justified layout using stored aspect ratios (extends existing `CoverflowGallery.tsx`).
- Grid view: gallery block spans a featured cell.
- Fallback per §7.6: any view that can't render → Vertical carousel.

### E5. Editor
- New "Add photos" tool in `Editable.tsx` block toolbar (mobile: camera + camera roll).
- Drag-reorder within gallery using existing dnd-kit; inline alt/caption editors reusing `EditableText`.

### E6. Share-card upgrade
- OG image handler in `src/routes/t.$slug.tsx` head() picks first gallery image (absolute URL from Supabase Storage) when available; falls back to current skin cover.

### E7. Tests
- `tests/gallery-block-roundtrip.test.ts`: zod parse survives unknown fields, gallery survives normalize.
- `tests/photo-carousel.test.tsx`: snap layout, reduced-motion variant flat.
- Playwright: `e2e/photos-upload.spec.ts` (owner uploads → renders in 3 views).

---

## Sequencing & gates

Each slice ends with `bunx vitest run` + `tsgo --noEmit` green before starting the next. Slice E only starts after Slice C's overflow tripwire is green (photos on a broken responsive base is thrash).

## Deliberately out of scope

- Any edits inside `src/lib/skins/<skin>.tsx` (house rule #1).
- Unsplash fallback (mentioned as "added strength" — deferred to a follow-up).
- Desktop bubbles replacement / cursor-parallax (deferred, per §4A "shipped as its own considered feature").
- Cross-bucket `timeOfDay` field on places (see C2 recommendation).

## Technical notes

- All new mobile UI behind `md:hidden` or `useIsMobile()`; desktop trees untouched per house rule #3.
- All animations honor `prefers-reduced-motion`.
- No new heavy deps: carousel = scroll-snap; masonry = flex + aspect-ratio; pinch-zoom = pointer events (fallback if `@use-gesture/react` is not already in the tree).
- `routeTree.gen.ts` untouched; new routes are `signup.tsx` (auto-registered).
