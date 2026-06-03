# Itinerary System Rebuild — PRD + Design Spec

## Problem

The current 10 skins share a `Block[]` model that has no concept of time-of-day, no proper flight pairing, no activity metadata (phone, website, hours), and no real "day" container. Day blocks are siblings of place blocks in a flat list, so:

- Vertical view is a flat scroll with no morning/afternoon/evening rhythm.
- Horizontal view falls back to `groupForBoard()` which collapses anything that isn't a `place` out of the day.
- Grid view doesn't exist — `SkinView` is declared but only `vertical` is actually rendered well.
- Templates (`src/lib/templates.ts`) are loose `DocBlock` arrays (heading/paragraph) with no structured activities, so a freshly created trip from a template has nothing real to render.

The goal: one structured itinerary model, three first-class views, ten templates that produce real itineraries, all skinned by tokens only.

---

## Part 1 — Data Model

Replace the flat `Block[]` with a structured `Itinerary`. Skins receive this shape and render it; tokens (colors/fonts) stay per-skin.

```text
Itinerary
├── trip: { destination, subtitle, dates, slug }
├── flights: { outbound: Flight, inbound: Flight }
├── days: Day[]
│   └── Day { n, date, label, notes,
│             morning:   Activity[],
│             afternoon: Activity[],
│             evening:   Activity[] }
└── extras: Block[]   // quotes, notes, free paragraphs
```

`Activity` (rich enough for the grid view's "high detail" cells):

```text
Activity {
  kind: 'stay' | 'eat' | 'see' | 'do' | 'drink' | 'transit' | 'note',
  title,            // "Breakfast at Pastéis de Belém"
  time?,            // "08:30"
  durationMin?,
  place?: {
    name, address, phone, website, mapsUrl, hours, priceLevel
  },
  transit?: {
    mode: 'taxi'|'train'|'walk'|'car'|'metro',
    company?, phone?, from?, to?, confirmation?
  },
  reservation?: { name, time, partySize, confirmation },
  note?
}
```

Migration: keep the legacy `Block[]` as `extras` for backward compat; introduce `Itinerary` as the new source of truth. A tiny adapter (`blocksToItinerary`) lets existing stored trips still render.

---

## Part 2 — The Three Views (shared across all skins)

All three live in `src/lib/skins/shared/views/` and take `(itinerary, tokens)`. Skins remain tokens-only.

### 2a. Vertical — Chronological Reading View

A long scroll. One thing happens at a time.

```text
┌─────────────────────────────────────┐
│  TRIP TITLE                          │
│  subtitle · dates                    │
├─────────────────────────────────────┤
│  ✈  OUTBOUND  JFK → LIS · TAP 203    │
│     Tue Jun 10 · 21:55 → 09:40       │
├─────────────────────────────────────┤
│  DAY 01 · TUE JUN 10 · Arrival       │
│                                      │
│   MORNING                            │
│    ◦ 08:30  Breakfast — Pastéis…     │
│    ◦ 10:00  Walk to Jerónimos        │
│                                      │
│   AFTERNOON                          │
│    ◦ 13:00  Lunch — Time Out Market  │
│                                      │
│   EVENING                            │
│    ◦ 19:30  Dinner — Belcanto        │
├─────────────────────────────────────┤
│  DAY 02 …                            │
└─────────────────────────────────────┘
│  ✈  INBOUND   LIS → JFK              │
```

- Sticky left rail shows current day number while scrolling.
- Each part-of-day has a small label rule.
- Activity row: time · icon · title · (address muted, one line).
- Tap an activity to expand into the rich detail card.

### 2b. Horizontal — Kanban Board

Each day is a column. Activities are cards. Drag to reorder within or across days/part-of-day.

```text
┌──────────┐ ┌──────────┐ ┌──────────┐
│ DAY 01   │ │ DAY 02   │ │ DAY 03   │
│ Arrival  │ │ Sintra   │ │ Alfama   │
├──────────┤ ├──────────┤ ├──────────┤
│ MORNING  │ │ MORNING  │ │ MORNING  │
│ [card]   │ │ [card]   │ │ [card]   │
│ [card]   │ │          │ │          │
├──────────┤ ├──────────┤ ├──────────┤
│ AFTERNOON│ │ AFTERNOON│ │ AFTERNOON│
│ [card]   │ │ [card]   │ │ [card]   │
├──────────┤ ├──────────┤ ├──────────┤
│ EVENING  │ │ EVENING  │ │ EVENING  │
│ [card]   │ │ [card]   │ │ [card]   │
└──────────┘ └──────────┘ └──────────┘
```

- Flights pinned as a slim ribbon above the board.
- Card shows: icon · title · time. Hover/tap for details.
- Drag uses `@dnd-kit` (already in deps via SortableBlocks).
- Reordering updates the itinerary; history hook captures it for undo/redo.

### 2c. Grid — Operational Table View

Reference / printable. Maximum density.

```text
FLIGHTS
┌─────────┬──────────┬──────────┬─────────┬────────┬──────┐
│ Leg     │ Airline  │ From → To│ Depart  │ Arrive │ Conf │
├─────────┼──────────┼──────────┼─────────┼────────┼──────┤
│ Outbound│ TAP 203  │ JFK → LIS│ 21:55   │ 09:40+1│ ABC1 │
│ Inbound │ TAP 204  │ LIS → JFK│ 11:20   │ 14:05  │ ABC1 │
└─────────┴──────────┴──────────┴─────────┴────────┴──────┘

DAY 01 · Tue Jun 10 · Arrival
┌──────────────────┬──────────────────┬──────────────────┐
│ MORNING          │ AFTERNOON        │ EVENING          │
├──────────────────┼──────────────────┼──────────────────┤
│ Pastéis de Belém │ Time Out Market  │ Belcanto         │
│ Rua de Belém 84  │ Av. 24 de Julho  │ Largo S. Carlos 10│
│ +351 21 363 7423 │ timeoutmarket.com│ +351 21 342 0607 │
│ pasteisdebelem…  │ Lunch · 13:00    │ 19:30 · party 2  │
│ 08:00–22:00      │                  │ conf #L-882      │
└──────────────────┴──────────────────┴──────────────────┘
```

- Three fixed columns per day. Cells expand vertically with all available metadata (name, address, phone, website, hours, reservation #, transit info).
- Print-friendly (one day per page on `@page` break).

---

## Part 3 — Templates (rebuild all 10)

Each template now produces a real `Itinerary` with plausible flights, day labels keyed to the trip arc, and 2–4 activities per part-of-day. Templates inform structure; the user replaces content. List + thesis:

1. **Weekend City Break** (3d) — Lisbon-style: arrive Fri eve, full Sat, slow Sun departure.
2. **7-Day Road Trip** (7d) — coastal loop with daily drives, lunch stops, sunset overlooks.
3. **Two-Week Eurail** (14d) — 6 cities, train legs as `transit` activities between days.
4. **Honeymoon** (10d) — slow pace, 1–2 activities/part, more dinners than days.
5. **Family Beach** (7d) — pool AM, beach PM, casual dinners + 1 rainy-day plan.
6. **Solo Backpacking** (21d) — sparse template, hostel addresses, bus segments.
7. **Foodie Pilgrimage** (5d) — every reservation pre-filled; markets AM, tasting menus PM.
8. **Ski Week** (7d) — lift schedule mornings, après PM, 1 rest day.
9. **Safari + Bush** (10d) — game drives AM/PM, charter flights as transit between camps.
10. **Multi-City Conference** (9d) — flights between cities, talk times, lounge notes.

All templates share a single `buildTemplate(kind)` builder that returns an `Itinerary`.

---

## Part 4 — Design System Consistency

Every view reads only from `SkinTokens` (already defined: bg, ink, inkSoft, accent, rule, fontDisplay, fontBody). No hardcoded colors anywhere in the new view code.

New tokens to add (additive, non-breaking):
- `--tds-card`   — surface for kanban cards / grid cells (defaults to `color-mix(in oklab, var(--tds-ink) 4%, var(--tds-bg))`).
- `--tds-pop`    — hover surface.
- Part-of-day labels reuse `--tds-soft` + `--tds-rule`.

Each of the 10 skins keeps its current personality (Epictetus = editorial, Orsino = baroque, etc.) — only the tokens differ. All three views render correctly under all 10 skins.

---

## Part 5 — Files Touched

New:
- `src/lib/itinerary/model.ts` — `Itinerary`, `Day`, `Activity` types + `blocksToItinerary` adapter.
- `src/lib/itinerary/templates.ts` — `buildTemplate(kind)` for all 10.
- `src/lib/skins/shared/views/VerticalView.tsx`
- `src/lib/skins/shared/views/HorizontalView.tsx`
- `src/lib/skins/shared/views/GridView.tsx`
- `src/lib/skins/shared/views/parts.tsx` — shared `ActivityRow`, `ActivityCard`, `FlightStrip`.

Edited:
- `src/lib/skins/shared/SkinFrame.tsx` — switch on `view`, delegate to the three view components, drop the inline grouping logic.
- `src/lib/skins/shared/skin.css` — add card / pop tokens, grid + kanban styles (all token-driven).
- `src/lib/skins/types.ts` — extend `SkinRenderProps` to accept `itinerary?: Itinerary` alongside legacy `blocks`.
- `src/lib/skins/epictetus.tsx` + `src/lib/skins/orsino.tsx` — keep their hand-built vertical; route horizontal/grid through shared views.
- `src/lib/templates.ts` + `src/lib/templates.functions.ts` — replace `DocBlock` payloads with real itineraries.
- `src/routes/t.$slug.tsx` — pass `itinerary` and `view` into the active skin.
- `src/components/studio/StudioBar.tsx` — add view switcher (Vertical · Horizontal · Grid).

No changes to backend schema in this pass — itinerary is derived/stored alongside existing `blocks` JSON column. A later pass can promote it to its own column.

---

## Out of Scope (separate follow-up)

- Drag-and-drop persistence to backend (Kanban changes stay in client state for v1 — undo/redo already handles it locally).
- Maps integration (mapsUrl is captured but not rendered as an embedded map).
- Real-time collaboration on the board view.

---

## Acceptance

- Every one of the 10 skins renders the same trip in all three views without visual breakage.
- A trip created from any of the 10 templates shows a populated itinerary (flights + multi-part days + activities with metadata) on first load.
- Grid view prints to PDF with one day per page.
- View switcher in StudioBar toggles instantly with no data loss.
