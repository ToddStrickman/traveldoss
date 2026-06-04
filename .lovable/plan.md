## Goal

Two deliverables:

1. **Parser regression fixtures** — extend the existing suite with messier inputs that stress reconstruction and day ordering.
2. **Gmail booking → trip Doc preview** — new end-to-end feature: pull booking confirmations from Gmail, parse them through the existing AI itinerary parser, attach a generated Google Doc preview to the matching trip, with Playwright E2E coverage.

---

## Part 1 — Parser fixtures

### 1A. Local fallback fixtures (`tests/itinerary-parser.test.ts`)

Add four new `describe` blocks against `parseDropInWithMeta`:

- **Missing dates** — paste with only "Day", "next day", "then" tokens. Assert sequential `day.n` numbering and that no `place` block is mis-promoted to a day label.
- **Missing destination** — paste of pure activities ("ramen at Ichiran… train to Kyoto… ryokan check-in"). Assert `destination` is inferred from the first geographic anchor (Kyoto) or returns `null` if nothing matches — pin current behaviour.
- **Conflicting day order** — input lists Day 3, Day 1, Day 2 out of order. Assert local parser preserves input order (it is line-based) and that day numbers round-trip; document this as the expected fallback behaviour (reordering is the AI parser's job).
- **Run-on transcript, no day markers** — single paragraph with semicolons and "after that". Assert it falls back to a single `paragraph` block plus any extracted place names; no spurious `day` blocks.

### 1B. AI parser fixtures (`tests/itinerary-parser-ai.test.ts`, new)

Gated suite — `describe.skipIf(!process.env.LOVABLE_API_KEY)`. Calls `parseItineraryAi.handler` directly (bypassing the RPC layer) with the same four fixtures and asserts:

- Days renumbered 1..N in chronological order even when input is shuffled.
- `destination` non-null for the missing-destination fixture.
- At least one `place` block per day; every place has a `category`.
- Every recommended (not user-named) place has `confidence < 0.85`.

Add `bun run test:ai-parser` script and document it in README.

---

## Part 2 — Gmail booking → Doc preview

### 2A. Connector + secrets

- Link the **Gmail** and **Google Docs** app connectors via `standard_connectors--connect`. (Google Drive is already linked.)
- Use the existing `google_tokens` table for per-user OAuth; Gmail uses connector creds for the workspace inbox initially — confirm scope during build (`gmail.readonly`).

### 2B. Schema

New migration:

```sql
create table public.trip_doc_previews (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  user_id uuid not null,
  source text not null check (source in ('gmail','manual')),
  source_message_id text,         -- Gmail message id, unique per user
  google_doc_id text not null,
  google_doc_url text not null,
  preview_html text,              -- cached first-page HTML for embed
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  unique (user_id, source_message_id)
);
-- grants + RLS: owner-only CRUD, service_role full
```

### 2C. Server functions (`src/lib/gmail-import.functions.ts`)

- `listBookingEmails()` — Gmail Text Search `category:travel OR subject:(confirmation OR itinerary OR booking) newer_than:90d`, returns `{id, snippet, from, subject, date}[]`.
- `importBookingEmail({ messageId, tripId })`:
  1. Fetch full Gmail message via connector gateway.
  2. Extract plain text body (decode base64url, strip HTML).
  3. Call existing `parseItineraryAi` to get `{destination, blocks}`.
  4. Build a Google Doc through the Docs API (TipTap-style batchUpdate using the doc skill mapping): title = `${trip.destination} — Booking ${date}`, body = rendered blocks.
  5. Insert `trip_doc_previews` row, update `trips.doc_id` / `trips.doc_url` if missing.
  6. Return `{ docPreviewId, googleDocUrl }`.
- `listTripDocPreviews({ tripId })` for the UI.

All three use `requireSupabaseAuth`; admin client only inside `.handler()` via `await import("@/integrations/supabase/client.server")` (transitive-import rule).

### 2D. UI

- New `GmailImportPanel` in `src/components/flow/` — list candidate emails, "Import to trip" button per row, shows toast + opens Doc preview.
- Trip dossier (`src/routes/t.$slug.tsx`): if `trip_doc_previews` exist, render a `<iframe src={googleDocUrl + "/preview"}>` card.

### 2E. E2E tests (`e2e/gmail-import.spec.ts`)

- Mock the Gmail + Docs connector gateway by intercepting `https://connector-gateway.lovable.dev/**` via `page.route(...)`. Two fixtures: a flight confirmation and a hotel confirmation.
- Seed a trip via existing test seeding hook (extend the `/e2e/...` route used by kanban tests).
- Flow:
  1. Sign in as the seeded test user.
  2. Open Gmail import panel → expect both mocked emails listed.
  3. Click "Import to trip" on the flight email.
  4. Assert: success toast, `trip_doc_previews` row created (read via test helper server fn), iframe with `googleDocUrl` rendered on dossier page.
  5. Negative: importing the same `messageId` twice surfaces "already imported", no duplicate row.

Extend `playwright.config.ts` with a `gmail-import` project? No — single chromium project, just new spec.

---

## Technical notes

- Worker runtime safe: only `fetch` + `crypto`, no Node-only deps.
- Google Docs JSON ↔ block mapping follows the `google_docs` knowledge file (no HTML intermediary).
- Reuse `parseItineraryAi`; do not duplicate its system prompt.
- Tests for AI parser must respect cost — gated behind env var, opt-in script.
- All new tables follow the public-schema-grants rule (GRANT then RLS then policies).

---

