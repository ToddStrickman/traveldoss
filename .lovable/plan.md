## Goal

Replace the current saga landing with a three-zone workspace: a left vertical ribbon, a centered "Pick TravelDoss Template" CTA, and a right-side infinite vertical scroll of Google-Doc thumbnails. Add a template-picker carousel (3-up desktop, 1-up mobile) with 10 sample templates. When picked, the template is materialized into the user's own Google Doc and a new trip is created.

Keep the Thorgal aesthetic (parchment, ember, Bebas Neue display) the user just approved.

## 1. Landing page (`/`) — three-zone layout

```text
┌────┬────────────────────────────┬──────────────┐
│ R  │                            │  ░ Doc 1 ░   │
│ I  │   TRAVELDOSS               │  ░ Doc 2 ░   │
│ B  │                            │  ░ Doc 3 ░   │
│ B  │   [ PICK A TEMPLATE ]      │  ░ Doc 4 ░   │
│ O  │                            │  ░ Doc 5 ░   │
│ N  │   tagline                  │  ░ … loop ░  │
└────┴────────────────────────────┴──────────────┘
```

- **Left ribbon** (sticky, ~88px): vertical icon+label rail.
  Items: Browse Places, Templates, Past Trips, Saved Stops, Settings, Enter.
  Public visitors click → routed to `/login` (the gated routes); the ribbon doubles as a marketing hint.
- **Center**: oversized wordmark + the stylized "PICK TRAVELDOSS TEMPLATE" button (ember underline, carved-shadow press state) that links to `/templates`. Tagline + Google Doc → Live Map line.
- **Right rail** (sticky on desktop, hidden < `md`): continuously upward-scrolling column of Google-Doc-style thumbnails (CSS keyframe loop, duplicated list for seamless wrap). Hover pauses, click jumps straight to that template's carousel slide.

## 2. Templates catalog (shared module)

`src/lib/templates.ts` — 10 entries:

1. Weekend City Break
2. 7-Day Road Trip
3. Two-Week Eurail
4. Honeymoon Itinerary
5. Family Beach Holiday
6. Solo Backpacking Trail
7. Foodie Pilgrimage
8. Ski Week
9. Safari + Bush
10. Multi-City Conference Trip

Each: `id`, `title`, `subtitle`, `days`, `tone`, `accent`, `sections` (Day-1 / Day-2 headings + sample notes), `crawlFields` (which Drive/Gmail fields it pulls — flights, hotel confs, reservation emails, photo references, contact cards), `docTemplate` (an array of paragraph/heading blocks used to populate the Google Doc on selection).

## 3. Template picker (`/templates`)

- Carousel of `TemplateCard`s, 3 visible on desktop (`md`+), 1 on mobile.
- Built with `motion/react` drag + paged transform (no extra deps).
- Each card: parchment surface, doc-paper preview, title, day count, "fields we'll crawl" chip row (Gmail, Drive, Maps, Calendar), accent ember stripe.
- Primary button: "Use this template" → calls `pickTemplate({ templateId })` server fn.

## 4. Materialize template → Google Doc

`src/lib/templates.functions.ts`:

```ts
pickTemplate({ templateId })
  // requires Supabase auth + linked Google account (existing /api/google flow)
  // 1. ensure google_tokens row exists; if not → return { needsGoogle: true, authUrl: '/api/google/start' }
  // 2. POST to Docs API: create doc titled `${template.title} — ${date}`
  // 3. batchUpdate to inject the template's sections (headings + paragraphs)
  // 4. INSERT into public.trips: doc_url, doc_id, destination = template.title, start_date/end_date placeholder, status='draft'
  // 5. return { tripId, docUrl }
```

Uses the existing per-user Google OAuth (already in `google_tokens` table) via direct `https://docs.googleapis.com/v1/documents` calls — no Lovable connector, since the docs must live in each end-user's Drive.

After success, navigate the user to `/app?tripId=...` (the authenticated app view) and open the new Doc in a new tab.

## 5. Routes / files

| File | Status |
|---|---|
| `src/routes/index.tsx` | rewrite (three-zone) |
| `src/routes/templates.tsx` | new (carousel) |
| `src/lib/templates.ts` | new (10 templates + types) |
| `src/lib/templates.functions.ts` | new (`pickTemplate` server fn) |
| `src/components/landing/Ribbon.tsx` | new |
| `src/components/landing/InfiniteDocs.tsx` | new |
| `src/components/templates/TemplateCarousel.tsx` | new |
| `src/components/templates/TemplateCard.tsx` | new |

No DB migration needed (existing `trips` + `google_tokens` cover this).

## 6. Aesthetic continuity

- Reuse parchment/ember tokens already in `src/styles.css`.
- Bebas Neue for the wordmark and the "PICK TRAVELDOSS TEMPLATE" button.
- Cinzel for ribbon labels and field chips.
- The infinite-scroll docs are rendered as miniature parchment cards with simulated heading rules — they feel like Doc thumbnails without being literal Google screenshots.

## Open question

The right-side infinite scroll: should the doc thumbnails be **stylized parchment mock-ups** (consistent with the Thorgal look, ships immediately) or **actual screenshots** of real Google Docs (requires you to provide images)? I'll default to stylized mock-ups unless you say otherwise.
