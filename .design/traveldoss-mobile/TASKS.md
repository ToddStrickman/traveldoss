# Build Tasks: TravelDoss Mobile — Visitor Path

Generated from: .design/traveldoss-mobile/DESIGN_BRIEF.md + INFORMATION_ARCHITECTURE.md
Date: 2026-07-04

Ordering: foundation → the two highest-risk/highest-visibility dossier slices →
sheets/flows → gallery → polish. Every task is verifiable at 375×812 in the local
preview and must leave desktop (`md:`+) pixel-identical unless stated. Aesthetic
philosophy ("Dark-Mode Skeuomorphic Revival", editorial-scale-over-chrome) is
established in Tasks 1–3 and inherited by everything after.

## Foundation

- [ ] **T1 · Mobile foundation utilities**: Add to `src/styles.css`: safe-area helpers
  (`.pb-safe`, `--safe-b: env(safe-area-inset-bottom)`), `.tap` (min 44×44px hit area),
  coarse-pointer variants, `.edge-fade-x` for scrollable chip rows, and a
  `.no-touch-callout` utility. Zero visual change on desktop; verify by diffing
  desktop screenshots before/after. _Modifies: styles.css only._
- [ ] **T2 · TdSheet primitive**: Wrap the installed-but-unused vaul `drawer.tsx` into a
  branded `TdSheet` (navy `--surface` panel, grabber, hairline top rule, focus trap,
  swipe-dismiss + visible close, `prefers-reduced-motion` → fade). Done = a demo
  trigger opens/dismisses it cleanly on mobile preview with keyboard + screen-reader
  labels. _Reuses: components/ui/drawer.tsx (vaul), tokens. New: components/mobile/TdSheet.tsx._

## Core UI — the dossier (highest visibility, highest risk first)

- [ ] **T3 · VerticalView mobile recomposition**: Card-chunked days with oversized day
  numerals, boarding-pass flight card (replaces label-stack table), place cards with
  2-line note clamp. Base styles = mobile composition; existing desktop layout
  preserved behind `md:`. Must render correctly in at least 3 skins (Epictetus,
  Cassian, Vesper) since skins consume these shared views. _Modifies:
  src/lib/skins/shared/views/VerticalView.tsx + skin.css._
- [ ] **T4 · Collapsing masthead + day-jump sheet**: On `/t/<slug>` mobile, the skin
  masthead collapses on scroll into a slim sticky bar (trip title + **Days** button).
  Days opens a TdSheet table of contents; current trip date auto-highlighted; tap
  jumps (instant under reduced motion). Done = scroll collapse with zero layout shift
  and working jump on a 20-day fixture. _Depends: T2. New: components/mobile/DossierMasthead.tsx,
  DayJumpSheet.tsx; modifies t.$slug.tsx._
- [ ] **T5 · View pill + `?view=` param**: Floating bottom-right pill (public mode only,
  above safe area) opens a TdSheet with Vertical/Horizontal/Grid segmented control;
  selection writes the new validated `?view=` search param on `/t/<slug>` (default
  vertical, additive, shareable). Desktop keeps its existing tabs untouched.
  _Depends: T2. Modifies: t.$slug.tsx route search schema; new ViewSheet.tsx._
- [ ] **T6 · HorizontalView touch day-pager**: On coarse pointers, the kanban becomes a
  horizontally swipeable day pager (one day per viewport, snap) with vertical bucket
  lists; long-press lifts a card for reorder via the existing `moveActivity` reducer;
  drop targets glow `--seal`. Desktop mouse kanban byte-identical. Done = existing
  `tests/horizontal-kanban-move.test.ts` still green + manual touch run on the
  `/e2e/kanban` harness at 375px. _Modifies: HorizontalView.tsx. Depends: T3's card idiom._

## Sheets & Flows

- [ ] **T7 · Place detail sheet**: Tap any place card → TdSheet with the place's full
  note and tap-to-act rows — call (`tel:`), map (geo/Google Maps URL), website;
  address row copies on tap. Covers: place with all fields / minimal place / shadow-tier
  styling. _Depends: T2, T3. New: PlaceSheet.tsx._
- [ ] **T8 · MintBar**: Safe-area-aware sticky bottom bar for sample/pre-mint dossiers:
  `[view icon] [Mint this dossier →]` — replaces the crowded preview bar on mobile
  only; enforces the one-bar-per-mode budget from the IA (view pill hidden when
  MintBar present). _Depends: T1, T5. New: components/mobile/MintBar.tsx._
- [ ] **T9 · Mint flow as sheet**: On mobile, IngestionModal renders as a full-height
  TdSheet step flow — source segmented control (Paste/Gmail/Manual) → paste step with
  textarea and **Compose Dossier** pinned above the keyboard (visualViewport-aware).
  Desktop dialog unchanged. Covers: keyboard open/close, validation error, loading
  handoff to GenerationLoader. _Depends: T2, T8. Modifies: IngestionModal.tsx._

## Gallery & Landing

- [ ] **T10 · Newsstand tiles**: Gallery tiles on mobile show a legible cropped hero
  region of each skin preview (not the full scaled page); codename + personality hook
  never truncate; filter chips become one scrollable edge-faded row. _Depends: T1.
  Modifies: TemplateGallery.tsx / templates.tsx._
- [ ] **T11 · Skin peek swiper**: Tapping a tile opens a full-screen peek — swipe
  horizontally between skins (embla-carousel, already installed), MintBar pinned
  bottom, close returns to scroll position. `?pick=` deep-links open the peek directly.
  Covers: reduced-motion (no parallax), 10-skin list. _Depends: T8, T10. New: SkinPeek.tsx._
- [ ] **T12 · Landing tidy**: One-line construction banner at mobile, quick-chips as a
  single quiet row, Login pill tap target ≥44px. Sand hero untouched. _Modifies:
  index.tsx only; smallest slice, safe filler between reviews._

## Responsive & Polish

- [ ] **T13 · Accessibility pass**: Verify seal-on-navy contrast for small text (≥AA),
  focus rings on all new controls, sheet `aria-modal`/labels, 44px audit across the
  visitor path, full reduced-motion sweep (masthead, pager, sheets, peek). Fix
  everything found. Breakpoints: 375, 390, 430.
- [ ] **T14 · Performance pass**: Lazy-render below-fold day cards; verify masthead
  collapse causes no CLS; confirm sheets animate at 60fps under 4× CPU throttle;
  check bundle impact of embla/vaul usage (route-level code splitting already exists).
  Done = Lighthouse mobile ≥90 perf on `/t/<slug>` fixture, no new layout shift.

## Review

- [ ] **T15 · Design review**: Run /design-review against the brief with screenshots at
  375/390/768/1280 across landing, gallery, peek, dossier (3 views), mint flow.

### Build rules for every task
- Verify in local preview at 375×812 **and** confirm desktop 1280 unchanged.
- No pushes to main during the build phase; ship as one reviewed batch when Todd says go.
- Skins are content: never edit individual skin `Render` files; only shared views/tokens.
