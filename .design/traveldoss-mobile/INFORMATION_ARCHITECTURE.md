# Information Architecture: TravelDoss Mobile — Visitor Path

> Constraint from the brief: the desktop IA is **preserved** — same routes, same names,
> same hierarchy. This document defines how each node *recomposes* on mobile
> (<768px, coarse pointer) and where its interactions physically live on screen.

## Site Map (unchanged, annotated for mobile)

- Landing `/` — sand-hero identity + single funnel CTA
  - Templates gallery `/templates` (`?pick=<skin>` deep-link) — the newsstand
    - Skin peek (mobile-only overlay state, no route change) — full-screen legible preview
  - Sample dossier `/t/<sample-slug>?mode=edit` — try-before-mint
  - Login `/login` (`?redirect=`) — gate before mint completes
- Dossier `/t/<slug>` — **the 80% view**; shared links land here
  - Owner edit `/t/<slug>?mode=edit` (StudioBar; second pass)
  - Expired state (same route, graceful re-publish CTA)
- Out of scope this pass: `/app` (trip list), `/plan`, `/e2e/*` (dev)

URL rules stay byte-identical to desktop. One **additive** parameter:
`?view=vertical|horizontal|grid` on `/t/<slug>` so a view choice survives
share/reload and cross-device handoff (currently ephemeral component state).
Default remains `vertical`; invalid values fall back silently.

## Navigation Model

- **Primary navigation (mobile)**: none — deliberately. The visitor path is a funnel,
  not an app shell; a bottom tab bar would advertise chrome the visitor never needs.
  Forward motion is always the single sticky bottom CTA; backward motion is a
  top-left `←` ghost link (existing convention) plus system back.
- **Secondary navigation**: contextual, per surface —
  - Gallery: search + one scrollable filter-chip row (edge-faded, no wrapping).
  - Dossier: collapsing masthead; when collapsed, a slim sticky bar shows the trip
    title and a **Days** button that opens the day-jump sheet (table of contents).
- **Utility navigation**: Login pill stays top-right on landing; on dossier surfaces
  utility actions (share, exports) live behind the masthead's single `⋯` button
  (sheet), never as icon rows.
- **Bottom-zone budget — one bar per mode, enforced**:
  | Dossier mode | Bottom zone occupant |
  | --- | --- |
  | Public read (visitor) | Floating **view pill** only, bottom-right, above safe area |
  | Sample / pre-mint | **MintBar**: `[view icon] [Mint this dossier →]` — one row, one primary action |
  | Owner edit | Existing StudioBar (already safe-area aware, 44px targets); view switch joins its overflow — second pass |

## Content Hierarchy

### Dossier `/t/<slug>` (the 80% view — one-handed, mid-trip)
1. **Skin masthead** (trip title, dates, skin identity) — the "premium artifact" moment a
   shared link was opened for; full-bleed, then collapses out of the way.
2. **Today / next upcoming day** — mid-trip readers want *tonight*, not Day 1; the
   day-jump sheet auto-highlights the current date when trip dates are known.
3. **Day cards in sequence** — big day numerals, chunked place cards, boarding-pass
   flight blocks. Vertical rhythm carries hierarchy; no tables.
4. **Shadow itinerary rail** (Plan-B options) — below primary days, clearly labeled.
5. **Footer utilities** (share, exports, expiry notice) — behind `⋯`, lowest priority.

### Templates `/templates` (the newsstand)
1. Editorial headline (kept — it *is* the brand promise, tightened to 2 lines).
2. Skin tiles: **legible cropped hero** of each skin + codename + personality hook —
   the hook is the purchase driver per the PDF; it must never truncate.
3. Search + filter chips (single row) — finding, not browsing, is secondary.
4. Tile tap → full-screen peek with horizontal swipe between skins; `Mint` pinned bottom.

### Landing `/`
1. Sand hero (identity) — already strong on mobile; keep.
2. One CTA: "Pick a dossier template."
3. Quick chips (existing) demoted to a single quiet row; construction banner
   shortened to one line on mobile.

### Mint sheet (from sample preview or gallery peek)
1. Step 1 — source: paste / Gmail scan / manual (segmented, one visible decision).
2. Step 2 — paste textarea (full-height sheet, submit pinned above keyboard).
3. Generation: full-screen GenerationLoader (already good), then dossier in edit mode.

## User Flows

### 1. Shared-link reader (the flow everything optimizes for)
1. Opens `/t/<slug>` from iMessage/WhatsApp on a phone.
2. Masthead renders skin identity in <1s (skeleton first, no layout shift).
3. Scrolls; masthead collapses to slim bar (title + Days).
4. Taps **Days** → day-jump sheet, current trip day highlighted → taps Day 4.
   - Reduced motion → instant jump, no smooth scroll.
5. Reads evening plans one-handed; taps a place card → detail sheet (address, phone,
   website as tap-to-act rows: call, map, open).
6. Optionally switches view via pill → sheet → Grid (crossfade under reduced motion).
7. If expired → graceful expired card + "Republish" CTA (owner) / plain notice (guest).

### 2. Newsstand → mint (revenue flow)
1. Lands `/` → CTA → `/templates`.
2. Scrolls tiles; taps *Vesper* → full-screen peek; swipes right → *Marcello*.
3. Taps `Mint this dossier` → mint sheet (Flow 3) on top of sample dossier.
   - Not signed in at submit → `/login?redirect=` → returns with state restored
     (existing sessionStorage resume logic — preserved untouched).

### 3. Paste-to-dossier (the parse flow, mobile-first shape)
1. Mint sheet opens at source step; user picks *Paste*.
2. Sheet expands to full height; textarea focused; keyboard up; `Compose Dossier`
   pinned above keyboard (never below the fold).
3. Submit → GenerationLoader full screen → dossier in edit mode → StudioBar.

### 4. Owner returns mid-trip
1. Opens own `/t/<slug>` (edit mode) on phone at the airport.
2. Reads like Flow 1; StudioBar present but quiet; drag-editing on the kanban is
   long-press (touch) — accidental scrolls never lift cards.

## Naming Conventions

| Concept | Label in UI | Notes |
| --- | --- | --- |
| Visual design module | **Template** (UI), skin (code) | Existing UI says "Dossier Template"; codenames (Vesper…) are the marketed unit per PDF |
| Purchase/instantiate | **Mint** | Established verb across bar/CTAs; never "buy/checkout" in UI copy |
| The artifact | **Dossier** | Never "itinerary" for the artifact; "itinerary" = the content being pasted/parsed |
| Plan-B entries | **Shadow itinerary** | Existing term, kept |
| View modes | **Vertical / Horizontal / Grid** | Kept verbatim; mobile Horizontal presents as day pager but keeps the name |
| Day TOC | **Days** | Button label on collapsed masthead; sheet title "Jump to day" |

## Component Reuse Map

| Component | Used on | Behavior differences (mobile) |
| --- | --- | --- |
| `SkinFrame` | sample, public, owner dossier | Receives `view` from URL param; unchanged API |
| Vaul sheet primitive | view switch, day jump, place detail, `⋯` utilities, mint flow | One primitive, five contexts; all: grabber, focus trap, swipe-dismiss + close button |
| MintBar (new) | sample preview, gallery peek | Same component, label varies ("Mint this dossier") |
| Collapsing masthead (new) | all `/t/<slug>` modes | Owner mode adds nothing — StudioBar stays separate |
| Day card recomposition | VerticalView (all skins) | Skin tokens style it; structure shared |
| Day pager (new) | HorizontalView touch only | Desktop kanban untouched; same `moveActivity` reducer |
| Filter chip row | /templates | Scrollable single row; desktop wrap unchanged |
| GenerationLoader | mint flow | Unchanged (already full-screen and calm) |

## Content Growth Plan

- **Skins grow** (6–8 → dozens): gallery already has search + facet chips; tiles are
  registry-driven; peek swiper reads the same filtered list. No IA change needed at 30+.
- **Days per trip grow** (city break → 3-week trek): day-jump sheet is a scrollable
  list grouped by week when >10 days; vertical view lazy-renders below-fold days.
- **Blocks per day grow**: place cards clamp notes to 2 lines with expand; detail
  lives in the place sheet, keeping scan speed constant.

## URL Strategy

- Pattern: unchanged — `/t/<slug>` with `?mode=edit` for owner, `?pick=<skin>` on gallery.
- New additive param: `?view=` on `/t/<slug>` (validated enum, optional, default vertical).
- No mobile-specific routes, ever — one URL works on every device (share integrity).
- Deep links that must keep working: `/templates?pick=vesper`, `login?redirect=`,
  sample slugs from marketing.
