# Design Brief: TravelDoss Mobile — Visitor Path

> Mission: redesign the desktop-first TravelDoss into a mobile experience that feels
> designed mobile-first — preserving the IA, functionality, brand, and skin system.
> Scope for this pass: **the visitor path** — landing → templates gallery → sample
> preview → mint (ingestion) → login → public dossier views.

## Problem

The people TravelDoss serves are phone-in-hand by definition: a partner opening a
shared dossier link from iMessage, a group-trip guest checking tonight's dinner
from a bar in Bologna, a planner pasting a ChatGPT itinerary from their couch. Today
they get the desktop composition squeezed to 375px — a kanban that demands mouse
drag-and-drop, template previews shrunk to illegible postage stamps, fixed toolbars
with no safe-area awareness, and tap targets built for cursors. The product sells
"premium editorial identity," but the most common way people encounter it —
a shared link on a phone — feels like the cheapest way to see it.

## Solution

Recompose every visitor-path screen for touch while keeping the desktop's mental
model and the skins' editorial language intact. The dossier becomes a calm,
single-column editorial feed with a collapsing masthead and thumb-reach controls;
the gallery becomes a swipeable newsstand where skin previews are actually legible;
the mint flow becomes a sticky-bottom, one-action-per-step sheet flow. Nothing is
removed — complexity moves into bottom sheets, progressive disclosure, and gestures.

## Experience Principles

1. **The dossier is the phone's home turf** — Every design call optimizes the shared-link
   reading experience first (one-handed, mid-trip, outdoors) before optimizing creation.
2. **Editorial scale over UI chrome** — Resolve density by letting the serif display type
   and whitespace carry hierarchy; controls collapse into sheets and sticky bars rather
   than shrinking into the layout. One primary action per screen.
3. **Same mind, different hands** — Desktop IA, naming, and skin identity stay identical;
   only interaction physics change (tap ≥44px, thumb-zone CTAs, swipe between options,
   sheets instead of side rails). A user switching devices should never relearn the product.

## Aesthetic Direction

- **Philosophy**: "Dark-Mode Skeuomorphic Revival" (existing) — deep navy canvas, ivory
  ink, champagne gold seal; editorial serif display over engineered mono/sans detail.
- **Tone**: Quiet luxury. Confident, unhurried, magazine-like. Never SaaS-busy.
- **Reference points** (from the inspiration sweep of recent.design, refero styles,
  and Awwwards Mobile):
  - *Linear mobile screens* — one bold statement per screen on a dark canvas; UI recedes.
  - *Novu-style mobile hero* — full-bleed imagery + two-line serif + single thumb-zone CTA.
  - *Refero "editorial museum on warm paper" / "literary journal" styles* — display serif
    at full-bleed with tiny letterspaced uppercase labels; validates TravelDoss's exact
    vocabulary at mobile scale when line length is controlled.
  - *Airbnb / Family-style bottom sheets* — complexity lives in draggable sheets with
    grabbers, not side rails.
  - *AllTrails-style stat confidence* — big numerals for flight times/day numbers over
    atmosphere, not data tables.
- **Anti-references**: TripIt utility density; Google-Docs-on-a-phone; hamburger-menu
  desktop ports; cramped "responsive" stacking; anything that reads as a compressed
  desktop site.

## Current Mobile Audit (evidence, 375×812 local + code scan)

| Screen | State today | Core friction |
| --- | --- | --- |
| Landing | Surprisingly strong: sand hero scales, CTA reachable, mobile chips exist | Construction banner wraps to 2 lines; Login pill top-corner; chips duplicate nav without hierarchy |
| /templates | Stacks acceptably; search + 10 filter chips | Skin previews are desktop dossiers scaled to ~355px — **illegible**, defeating "compare chrome like magazines"; filter chips wrap 4 rows deep |
| Sample preview + mint bar | Bottom bar exists | Bar isn't safe-area aware; view switcher (VERTICAL/HORIZONTAL/GRID) is desktop tabs; "Mint" CTA shares row with template dropdown |
| Ingestion modal | Radix dialog, 8 `md:` rules | Desktop-center modal, not a sheet; textarea + options + CTA all compete; keyboard handling untested |
| Dossier views | **Zero `md:` breakpoints in all three views** | Vertical: usable by accident (single column) but flight table renders as label stacks; Horizontal: mouse drag-and-drop kanban — unusable on touch; Grid: desktop grid squeezed |
| StudioBar | **Zero breakpoints**, fixed bottom | Overlaps content, no safe-area, undo/redo/export icons at cursor sizes |
| styles.css | — | No `env(safe-area-inset-*)`, no `touch-action`, no `pointer: coarse` rules anywhere |

## Existing Patterns (must respect / extend)

- **Typography**: `--font-display` Playfair Display (serif display, italic accents);
  Inter body; monospace-flavored labels with `tracking-[0.3em–0.45em]` uppercase.
- **Colors**: `--paper` #0B1325 navy canvas, `--surface` elevated navy, `--ink` ivory,
  `--seal` champagne gold, `--seal-soft` brass, oklch-defined in styles.css. Skins carry
  their own token sets — skin internals are *content*, not app chrome.
- **Spacing/depth**: radius 0.875rem scale, `--shadow-soft/elev`, `--highlight-inset`
  skeuomorphic edges, `transition-elegant` cubic-bezier(0.4,0,0.2,1).
- **Components**: shadcn/Radix set (dialog, drawer — vaul is already installed, sheet,
  tabs, dropdown), motion/react for animation, Parallax/Tilt, SandHero, GenerationLoader,
  IngestionModal, TemplateGallery, StudioBar, three dossier views.
- **Conventions**: `td-shimmer`, `surface-card`, hairline `--rule` dividers.

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| Bottom sheet primitive | Exists (vaul `drawer`) | Unused on visitor path — becomes the workhorse |
| MobileMintBar (sticky CTA) | New | Safe-area aware; single primary action; replaces crowded preview bar on mobile |
| ViewSwitcher bottom sheet | New | Replaces desktop tabs on mobile; segmented control inside sheet |
| Dossier collapsing masthead | New | Skin title shrinks into a slim sticky bar on scroll |
| Day card (mobile vertical) | Modify VerticalView | Card-chunked days, big day numerals, flight block recomposed from label-rows to boarding-pass card |
| Kanban → Agenda swipe view | Modify HorizontalView | Touch: horizontal day-pager with vertical bucket lists + long-press reorder; desktop kanban untouched |
| TemplateGallery mobile tiles | Modify | Skin previews cropped to legible hero region + swipeable full-screen peek |
| IngestionModal → sheet flow | Modify | Vaul sheet, step flow (paste → confirm), sticky submit above keyboard |
| Filter chips row | Modify | Single horizontally scrollable row with edge fade |
| Safe-area / touch tokens | New (styles.css addendum) | `--safe-b`, min tap 44px utilities, `touch-action` rules, coarse-pointer variants |

## Key Interactions

- **Dossier scroll**: masthead collapses to sticky slim bar (skin title + day quick-jump);
  momentum scroll with day sections snapping headers.
- **View switching**: bottom-right floating pill opens a sheet; selection animates a
  shared-element transition between views. Reduced-motion: crossfade.
- **Mint flow**: sticky bottom bar (one CTA) → vaul sheet slides up → paste/scan/manual
  segmented steps → submit stays pinned above keyboard → GenerationLoader full-screen.
- **Gallery browsing**: vertical scroll of legible tiles; tap opens full-screen skin peek
  (swipe left/right between skins like a newsstand); "Mint this dossier" pinned bottom.
- **Kanban on touch**: swipe horizontally between days; within a day, buckets are lists;
  long-press lifts a card (haptic where supported) and drag reorders; drop targets glow seal.

## Responsive Behavior

- Breakpoint philosophy: `md:` remains the desktop layouts (unchanged). Base styles
  become intentionally mobile-composed, not shrunken desktop.
- Components that change *behavior*, not size: view switcher (tabs→sheet), ingestion
  modal (dialog→sheet), horizontal view (kanban→day pager), studio bar (icon row→
  overflow sheet, second pass), template tiles (scaled iframe→cropped peek).
- Safe areas: all fixed bottom elements pad `env(safe-area-inset-bottom)`; sand hero
  and mastheads respect `dvh` units (some `min-h-[82dvh]` usage already exists — extend).

## Accessibility Requirements

- WCAG AA contrast on navy: ink/soft-taupe pairs already pass; verify seal-on-navy for
  small text (use `--seal` ≥18px or bold; labels stay uppercase+tracked at ≥11px).
- Tap targets ≥44×44px on every interactive element in the visitor path.
- Sheets: focus-trapped, `aria-modal`, swipe-to-dismiss AND visible close button.
- `prefers-reduced-motion`: no parallax/tilt, crossfades instead of shared-element moves,
  sand hero already degrades to static.
- Keyboard: mint sheet fully operable with external keyboard; visible focus rings
  (`--ring` seal) on dark canvas.

## Out of Scope (this pass)

- Owner editing surfaces: /app trip list, /plan, StudioDrawer contents, inline block
  editing ergonomics (second pass — flagged, not forgotten).
- Export flows (PDF/Google Doc/Calendar) beyond keeping current buttons reachable.
- The dossier skins' internal typography systems (skin `Render` files stay untouched
  except where views themselves recompose).
- Native apps, haptics beyond web vibration API, offline/PWA behavior changes.
- Payments UI, auth providers, any backend/server function changes.
