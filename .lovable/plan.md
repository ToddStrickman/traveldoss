# Admin Intelligence Console

A private, admin-only analytics console at `/app/admin`, reached from a graph
icon on the left rail that only appears for admins. Built to be read by an
investor over your shoulder: big honest numbers, funnel visuals, trend lines,
and per-template performance.

## Why a first-party event store is needed

Verified in this project: PostHog has **no key configured** (the secret list has
none), so every `capture()` call in `src/lib/analytics.ts` currently sends to
GA4 only — and GA4 data cannot be read back into the app without separate
Google service credentials. So the console reads from your own database.

Two data sources, combined:

1. **Ground truth from tables you already have** — `trips` (mints, templates,
   destinations), `trip_access_events` (dossier views and exports),
   `trip_entitlements` (paid mints), `terms_acceptances`, `contact_messages`,
   `saved_trip_requests`, `profiles` (signups). These give real history from day
   one, not just from launch day.
2. **A new `product_events` table** for the behavioral moments no table records:
   template browsing, view/layout switches, composer opens, parse failures,
   photo uploads, guide reads. Every existing `capture()` fans out to it, so no
   new event vocabulary and nothing to remember at each call site.

## Access control

- New `app_role` enum + `user_roles` table + `has_role()` security-definer
  function (the standard, injection-safe shape — roles never live on `profiles`).
  Your account is seeded as `admin` in the migration.
- Route lives at `src/routes/_authenticated/app.admin.tsx`, so the managed auth
  gate handles sign-in; the route itself checks `has_role(admin)` and shows a
  quiet "Not available" panel otherwise.
- The rail's graph button renders only when the signed-in user is an admin — a
  non-admin sees the rail exactly as it is today.
- Every metric query runs inside one admin server function that verifies the
  role before touching data. No metrics reach the browser for non-admins.

## What the console shows

### 1. Headline strip (KPI cards, sparkline in each)

Visitors, template browsers, composer opens, dossiers minted, paid mints,
revenue, dossier views by recipients, active builders. Each card shows the
number, the % change vs the previous equal period, and a 30-day sparkline.

### 2. The conversion funnel (the centerpiece)

A horizontal stepped funnel with step-to-step conversion % and drop-off called
out in red:

```text
Landed  →  Browsed templates  →  Opened composer  →  Input ready
   →  Mint submitted  →  Signed in  →  Dossier minted  →  Shared  →  Viewed
```

Below it: **the three questions you asked**, each as its own stat with a trend
chart — browse rate, browse→mint rate, and build engagement (share of minted
dossiers that get edited after creation, from `trips.updated_at` vs
`created_at`, plus block-count growth).

### 3. Behavior and engagement

- **Engagement depth histogram** — dossiers by number of days, blocks, photos.
- **Time to first mint** — distribution from signup to first dossier.
- **Return builders** — how many owners mint a second dossier (cohort curve).
- **Editing intensity** — edits per dossier, autosave failures.
- **Feature adoption bars** — import, paste, AI generate, photo upload, map,
  export, refine, offline: first-use counts and % of builders.
- **View/layout preference donut** — vertical vs horizontal vs grid.

### 4. Template performance leaderboard

Table + bar chart per template: previews, picks, mints, mint rate, average day
count, share rate, downstream views. This tells you which of the eleven
templates earns its place and which to retire.

### 5. Distribution and virality

- Views per dossier, unique recipients, view→mint loop (recipients who become
  builders), export mix (PDF / calendar / print), guide reads by guide.

### 6. Cohorts and retention

Weekly signup cohorts as a retention heatmap (mint in week 0, 1, 2 …) and a
cumulative dossiers-minted area chart.

### 7. Revenue

Paid mints, gross revenue, average revenue per builder, paid vs free ratio,
revenue trend — read from `trip_entitlements` only, never from the client.

### 8. Health and friction

Parse failure rate by source, mint failures, autosave errors, contact messages
by category, slowest funnel step. Anything trending the wrong way turns amber.

### 9. Live activity feed

The last 50 events in plain language ("Dossier minted · Cassian · Lisbon · 4
days"), auto-refreshing. No emails, no itinerary text — this is the panel that
makes the product feel alive in a demo.

### Controls

Date-range presets (7 / 30 / 90 days, all time) with comparison to the previous
period, template and channel filters, and CSV export of any panel.

## Design

Built in the existing TravelDoss language — paper/ink/seal tokens, hairline
borders, `--font-display` headings, the sunset-pink accent for active controls.
Charts use **recharts** (already a dependency, `^2.15.4`) with tokenized colors,
no default purple. Mobile-first: cards stack at 375px, two- and three-column
grids behind `md:`. Reduced-motion honored; skeleton panels reserve height so
nothing shifts while numbers load.

## Privacy

Counts, lengths, IDs and hashes only — no emails, no pasted itinerary text, no
block content, and never a dossier slug in an event property (the slug is a
capability URL). The live feed shows destinations and template names, which are
your own data, and never recipient identity beyond a hash.

## Technical shape

- **Migration 1**: `app_role` enum, `user_roles` (+ GRANTs, RLS, `has_role()`),
  seed your account as admin.
- **Migration 2**: `product_events` (`id`, `occurred_at`, `event`, `user_id`
  nullable, `session_id`, `template_id`, `trip_id`, `props jsonb`, `path`) with
  GRANTs, RLS denying all client access, admin-only read via `has_role`, and
  indexes on `(occurred_at)`, `(event, occurred_at)`, `(template_id)`. Plus SQL
  aggregate views for the funnel, cohorts and template leaderboard so each
  panel is one cheap read.
- `src/lib/analytics.ts` — `capture()` gains a third destination: a batched,
  debounced write through a new public `recordEvents` server function (rate
  limited, event names validated against an allowlist, no free-text props).
- `src/lib/admin.functions.ts` — `getAdminMetrics` (range + filters →
  everything the console needs), `getLiveFeed`, `exportPanelCsv`; each verifies
  `has_role(admin)` first, then reads via the admin client.
- `src/lib/admin/queries.server.ts` — the SQL/aggregation layer.
- `src/routes/_authenticated/app.admin.tsx` — the page, with `head()` metadata
  and `noindex`.
- `src/components/admin/*` — `KpiCard`, `FunnelChart`, `TrendChart`,
  `CohortHeatmap`, `TemplateLeaderboard`, `AdoptionBars`, `LiveFeed`,
  `RangePicker`, `AdminPanel` shell.
- `src/components/landing/Ribbon.tsx` — one admin-gated `BarChart3` rail item
  linking to `/app/admin`, using the existing 44×44 geometry and pill tooltip.
- Docs: new events appended to `docs/analytics/tracking-plan.md`; console
  rationale in `docs/directives/ADMIN_CONSOLE.md`.
- Tests: role-gate rejection for non-admins, funnel math on fixture rows, event
  allowlist rejection, and a 375px render test for the console shell.

## Sequencing

1. Roles migration (approval) → 2. events + views migration (approval) →
3. event capture fan-out → 4. admin server functions and queries →
5. console UI panel by panel → 6. rail button → 7. tests, typecheck, publish.
