
# Remediation Plan — Minimal Brutalism for Vertical / Horizontal / Grid

## 1. Audit findings (Epictetus, as built today)

Reading `src/lib/skins/epictetus.tsx`, `src/lib/skins/shared/SkinFrame.tsx`, `src/lib/skins/shared/skin.css`, and `src/routes/t.$slug.tsx`:

**Inconsistencies between views**
- Epictetus is hand-rolled and bypasses `SkinFrame` — its three views are ad-hoc (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, `flex snap-x` row, `space-y-10`). Other skins go through `SkinFrame` and use a different system (`data-view="grid|horizontal"`, `grid-template-columns: repeat(auto-fill, minmax(300px,1fr))`, day-grouped cards). Same template id, two different layout engines → cards look inconsistent depending on skin.
- Wrapper width jumps: Vertical = 760px, Grid/Horizontal = 1200px, while `SkinFrame` uses 1080/1320. Switching views causes a visible reflow, not a transition.
- In Grid view, every block gets a generic card with `rgba(0,0,0,0.025)` background — sections, paragraphs, quotes, and notes become awkward boxes that fight their own internal styling (e.g. quote already has its own left rule; note already has its own panel).
- Horizontal view is a flat row of identical 360px cards — Day + its Places are split across cards, breaking grouping. `SkinFrame`'s `groupForBoard()` already solves this; Epictetus doesn't use it.
- No image / aspect-ratio treatment exists anywhere; `trip.hero_image_url` and `place` blocks have no image slot. Card heights vary wildly because content height drives them.
- Typography: heading uses inline `clamp(56px, 9vw, 132px)`, body sizes are hard-coded `18/16/13` px. Other skins use a `--tds-s*` step scale. No single type ramp.
- Tap targets: `ViewSwitch` buttons are ~24px tall (`py-1.5 text-[10px]`), well under 44px. Block tool icons are 22×22. Add-block button is small dashed.
- Motion: only `tds-enter` fade-in exists; switching views is an instant swap.

**Cross-reference with traveldoss.com / landing**
Landing system (per `styles.css`, `Ribbon`, `InfiniteDocs`) leans on: paper background, seal accent, uppercase 0.35–0.4em tracking eyebrows, double-rule dividers, generous gutters. Dossier views should inherit the same eyebrow / rule / spacing primitives instead of inventing per-skin rounded cards.

## 2. Minimal Brutalism system (token layer)

Add a single source of truth in `src/lib/skins/shared/skin.css` (and mirror into Epictetus by routing it through `SkinFrame`):

**Type scale** (one ramp, all skins):
```
--tds-fs-display: clamp(44px, 8vw, 112px);
--tds-fs-h2:      clamp(24px, 3.2vw, 34px);
--tds-fs-h3:      clamp(20px, 2.4vw, 26px);
--tds-fs-body:    clamp(15px, 1.05vw, 18px);
--tds-fs-meta:    clamp(10px, 0.8vw, 12px);   /* eyebrows, tracking 0.35em */
```

**Spacing** keep the existing `--tds-s1..s5` step but redefine via `clamp()` so views share one rhythm.

**Card primitive** (`.tds-card`): no rounded corner, 1px hairline `var(--tds-rule)`, no fill in vertical, 4% ink fill in grid/horizontal, padding `clamp(16px, 2vw, 24px)`. Brutalist: square corners, hairlines, one accent rule per card max.

**Image aspect ratios** (single set):
```
--tds-ar-hero:   16 / 9;
--tds-ar-card:    4 / 5;   /* place card */
--tds-ar-tile:    1 / 1;   /* grid tile */
```
Use `<AspectRatio>` (already in `components/ui/aspect-ratio.tsx`) so card heights stop drifting.

**Touch targets**: `min-height: 44px; min-width: 44px;` on `.tds-tap` applied to ViewSwitch buttons, block tools, add-block, ExportMenu trigger.

## 3. Layout engine (one renderer, three views)

Refactor `epictetus.tsx` to delegate body rendering to `SkinFrame` (it already supports `view`, `groupForBoard`, editing). Epictetus keeps its own hero/header chrome, but the body becomes `<SkinFrame view={view} blocks={body} trip={trip} tokens={tokens} />`. This removes the second layout engine.

Then in `skin.css`, redefine the three views using CSS Grid + Flexbox with shared rules:

```text
data-view="vertical"
  .tds-canvas { display: grid; grid-template-columns: minmax(0, 68ch); justify-content: center; gap: var(--tds-s3); }

data-view="grid"
  .tds-canvas { display: grid; grid-template-columns: repeat(auto-fill, minmax(clamp(260px, 28vw, 320px), 1fr)); gap: var(--tds-s2); }
  .tds-hero, .tds-section, .tds-quote, .tds-flights { grid-column: 1 / -1; }
  /* days become .tds-card with stacked places inside */

data-view="horizontal"
  .tds-canvas { display: flex; flex-wrap: nowrap; overflow-x: auto; scroll-snap-type: x mandatory; gap: var(--tds-s2); padding-inline: clamp(16px, 4vw, 40px); }
  .tds-hero, .tds-section, .tds-quote { flex: 0 0 100%; }
  .tds-card { flex: 0 0 clamp(260px, 70vw, 340px); scroll-snap-align: start; }
```

Behavior locked: `section`/`quote`/`paragraph` always span full width; only `day+places` become cards in grid/horizontal. In horizontal, day cards have a sticky day-label header so scrolling reveals context.

## 4. Kinetic Minimalism (smooth view transitions)

- Add a `data-transitioning` flag on `.tds` set for 220ms when `view` changes.
- Use the View Transitions API where supported: `if (document.startViewTransition) document.startViewTransition(() => setLayout(next));` in `t.$slug.tsx`'s `ViewSwitch`. Fallback: existing `tds-enter` fade scoped to `.tds-canvas > *` on `data-view` change.
- Block-level FLIP isn't worth the cost; the canvas-level transition reads as the "kinetic" beat without jank.
- Respect `prefers-reduced-motion` (already gated in CSS) — skip the view-transition wrapper too.

## 5. Mobile responsiveness

- All sizes go through `clamp()` — no hard breakpoints for type.
- Horizontal view becomes the default on `≤640px` for `grid` selection too? No — keep user choice, but on `≤480px` grid collapses to a single column (`grid-template-columns: 1fr`). Horizontal cards become `flex: 0 0 84vw`.
- `ViewSwitch` moves to `bottom: max(16px, env(safe-area-inset-bottom))` on `≤640px` to stay reachable; buttons grow to 44px tall.
- Add `scroll-padding-inline` and momentum scroll on the horizontal canvas.

## 6. Component refactor steps (in order)

1. **`skin.css`** — add `--tds-fs-*` ramp, `.tds-card`, `.tds-tap`, rewrite `data-view` rules to use grid/flex as above; collapse 768px breakpoints into `clamp()` where possible; add reduced-motion guards.
2. **`SkinFrame.tsx`** — replace ad-hoc class strings with `.tds-card`; ensure `data-view` is the only switch; add `<AspectRatio ratio>` slots when a future `place.image` exists (leave behind a stable selector now).
3. **`epictetus.tsx`** — keep header/title/footer, delegate body to `SkinFrame` so it inherits all three views. Remove the inline `view === "grid" | "horizontal"` branches and the duplicate flight wrapper.
4. **`t.$slug.tsx`** — wrap `setLayout` in `document.startViewTransition` when available; add `.tds-tap` to `ViewSwitch` buttons; move switch to bottom on mobile via Tailwind responsive utils.
5. **`StudioBar`, `ExportMenu`, block tools** — apply `.tds-tap` (44×44 min) without changing visuals.
6. **Cross-skin sanity check** — open Orsino, Calliope, Halcyon, Marcello, Marguerite, Cassian, Shishu, Solveig, Vesper in all three views; visually confirm parity.
7. **Tests** — extend `tests/block-tools-hover.test.ts` with a smoke test that asserts `.tds[data-view="grid"] .tds-card` exists after switching.

## 7. Security

No API keys, secrets, or service-role usage touched. All work is presentational CSS + component refactor. Nothing read from `process.env` in client code.

## 8. Out of scope (call out, don't do)

- New image upload UX for places / hero (system leaves slots ready).
- New skins.
- Editing model changes (Editable / DnD untouched).
- Persisted per-user "default view" preference.

## 9. Acceptance criteria

- Switching Vertical ↔ Horizontal ↔ Grid on `/t/epictetus-3nkgng` reflows via a single 220ms transition, no layout jumps in header/footer.
- All three views share the same type ramp, hairlines, and spacing rhythm; cards are square-cornered with one hairline.
- Days+places stay grouped in grid and horizontal; sections/quotes/paragraphs span full width.
- All interactive controls (view switch, block tools, add-block, export, mint button) measure ≥44×44 CSS px in DevTools.
- Mobile (375px): horizontal scrolls at 84vw per card; grid collapses to one column; type scales without overflow; view switch reachable above safe-area.
- Lighthouse a11y for the dossier route unchanged or higher.
