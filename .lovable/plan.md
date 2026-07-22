# Plan — Left rail identity + Cover Flow carousel

Two workstreams, independent files, ships together.

**Cross-cutting requirement (applies to both parts):**
Every change must be verified on **mobile (375px) and desktop (≥1280px)** before shipping. During implementation and QA, explicitly double-check:
- **Spacing / rhythm** at both breakpoints — no clipped text, no horizontal page scroll on mobile, no collisions with the fixed bottom bar on mobile or the top masthead on desktop, consistent gutters at 375 / 768 / 1280 / 1680.
- **Input parity** — every interactive target must respond correctly to **click (mouse)** *and* **touch (finger)**. That means:
  - Hit targets ≥44×44 on mobile, ≥24×24 on desktop (house rule).
  - Use pointer events (not mouse-only) so touch and stylus behave identically to click.
  - No hover-only affordances on mobile: any control revealed on `:hover` must also be reachable on `(pointer: coarse)` (persistent or focus-visible).
  - Tap vs. swipe disambiguation: a tap must not be swallowed by a swipe handler (movement threshold before drag engages).
  - Focus rings visible for keyboard on desktop; not required to render on touch.

---

## Part 1 — Left rail (`Ribbon`): session-aware identity

**File:** `src/components/landing/Ribbon.tsx`

Note: the rail itself is `md:flex` (desktop-only surface). No mobile visual change — but verify that removing the `LogIn` "Enter" item doesn't leave a mobile drawer or menu missing a sign-in path; if it does, keep an equivalent entry there.

### Signed-out
- Replace the static `TD` tile with a **Sign-in chip** linking to `/login`.
- Same 44×44 footprint (preserves rail geometry + tap/click target).
- Lucide `UserCircle2` glyph; tooltip "Sign in" (reuse the existing right-side tooltip pattern).
- Remove the redundant `LogIn` "Enter" nav item — the top chip owns it now.

### Signed-in
- Read session with `supabase.auth.getUser()` on mount + subscribe to `onAuthStateChange` (unsubscribe on unmount).
- Display name: `user_metadata.full_name || user_metadata.name || email`.
- Initials: first letter of first + last name token; fall back to first two chars of the email local-part. Uppercase.
- Top tile becomes a **profile chip** showing initials, links to `/app`. Tooltip = full name.

### A11y & input
- Tooltip lives in a hidden `<span>`, accessible name stays clean.
- `aria-live="polite"` on the rail so signed-out → signed-in swap is announced.
- Tooltip revealed on hover **and** `focus-visible` (keyboard users see it too).
- No layout shift between states.

---

## Part 2 — Per-activity image carousel (Cover Flow)

This is the images-per-day/place carousel rendered by `ActivityImages` in
`src/lib/skins/shared/views/parts.tsx` — **not** the dossier thumbnail or hero.
Must feel first-class on both mobile touch and desktop mouse/keyboard.

**Files:** `src/lib/skins/shared/views/parts.tsx`, `src/lib/skins/shared/skin.css`

### Layout model
- Stage: `position: relative`, height `clamp(220px, 44vw, 380px)`, `perspective: 1400px`, `overflow: hidden`.
- Each slide is absolutely positioned, centered, transformed from its offset (`offset = index − active`):
  - `translateX = offset * 62%` of stage width (plus live drag delta while swiping)
  - `scale = offset === 0 ? 1 : 0.74`
  - `rotateY = clamp(offset, −1, 1) * −18deg`
  - `opacity = offset === 0 ? 1 : 0.55` (0 when `|offset| > 2`)
  - `filter = offset === 0 ? none : blur(1.5px) saturate(0.85)`
  - `z-index = 100 − |offset|`
- Slides beyond `|offset| > 2` still render but `opacity:0; pointer-events:none`.
- Neighbor peek ~14% each side signals more photos exist.

### Spacing double-checks
- **Mobile (375px):** stage padding matches surrounding day-card gutter (no edge bleed); neighbor peek visible without overflowing viewport; arrows do not overlap the mobile bottom bar or day-card title.
- **Desktop (≥1280px):** stage width capped so the active slide reads at comfortable viewing distance; arrows sit inside the stage, not colliding with the sidebar rail or export pill.

### Motion
- Single transition on `transform, opacity, filter` at `520ms cubic-bezier(0.22, 1, 0.36, 1)`.
- `prefers-reduced-motion`: transitions stripped, `rotateY: 0`, blur removed; scale kept.

### Interaction — click AND touch parity
- **Arrows:** `goTo(active ± 1)` on click/tap. 44×44 hit target, 32×32 visible chip.
  - Desktop: fade in on hover/focus-within (200ms), `opacity: 0` at rest.
  - Touch (`(pointer: coarse)`): persistent `opacity: 0.9` — never hover-only.
- **Neighbor tap/click:** `goTo(that index)` (via `onOpen={i === active ? openLightbox : goTo}`).
- **Active tap/click:** opens lightbox.
- **Keyboard:** `ArrowLeft` / `ArrowRight` / `Home` / `End` on the stage (already wired).
- **Swipe (touch + trackpad drag):** pointer events on the stage; track live `dx` and translate all slides together; on release snap to `active ± 1` if `|dx| > 15%` of stage width or velocity > `0.35 px/ms`.
- **Tap vs. swipe:** engage drag only after >8px of movement so a stationary tap always registers as a click on the underlying slide.
- Focus ring on the active slide only.

### Add-photo tile
- Participates as the rightmost slot with the same Cover Flow transforms.
- Active + tap/click → `uploader.pick()`.
- Non-active tap/click → `goTo(index)`.
- Same 44×44 minimum on mobile.

### Loading / fallbacks
- Eager-load extended from `|offset| ≤ 1` to `|offset| ≤ 2`.
- Existing skeleton shimmer, fallback badges, and error/retry states preserved.
- `IntersectionObserver` removed — `active` is authoritative.

### Single-image path
- When `total === 1`, keep today's static card. Cover Flow only kicks in for 2+ slots.

---

## Out of scope
- ActionDock, ExportMenu, top masthead bar, template gallery, dossier thumbnails, hero imagery.
- Auth flow — Part 1 only reads existing session.
- Lightbox internals.

## Files touched
- `src/components/landing/Ribbon.tsx`
- `src/lib/skins/shared/views/parts.tsx`
- `src/lib/skins/shared/skin.css`

## Verification (mandatory both viewports)
- `npx vitest run` + `tsc --noEmit` (house rule).
- Manual pass at **375px mobile** and **1280px+ desktop**, on a dossier with 4+ day photos:
  - Cover Flow layout renders, neighbors peek, arrows positioned correctly at both sizes.
  - Neighbor **click** (mouse) and **tap** (touch) both centre that slide; active click/tap opens lightbox.
  - Swipe on mobile viewport snaps cleanly; a stationary tap opens lightbox instead of scrubbing.
  - Arrows fade in on desktop hover; are persistently visible on touch.
  - Keyboard arrows navigate on desktop.
  - `prefers-reduced-motion` honored.
  - No horizontal page scroll at 375px; no collisions with fixed bars at either size.
  - Ribbon identity chip swaps cleanly on desktop; no mobile regressions.
