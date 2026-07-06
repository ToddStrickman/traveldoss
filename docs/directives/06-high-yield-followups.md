# Directive 6 — High-Yield Follow-ups (three shippable slices)

Three smaller features that compound the core loop. Ship in the order below;
each slice is independently valuable. 6a shares machinery with Directive 4 —
do that first.

---

## 6a. Forwarding-address auto-ingest (the TripIt move)

**Objective.** A user forwards a confirmation email to a personal TravelDoss
address; the app parses it into a draft dossier (or a Directive-4 merge
preview for an existing trip) without any copy-paste.

**Current state.** `src/lib/gmail-import.functions.ts` already talks to a
*workspace-owned* Gmail account through the Lovable connector gateway
(`connector-gateway.lovable.dev/google_mail/...`, auth via `LOVABLE_API_KEY`
+ `X-Connection-Api-Key`). That inbox is the receiving address — users never
grant inbox access, which is the right privacy posture. Keep it that way.

**Implementation.**
1. **Token routing.** Migration: `user_ingest_tokens (user_id, token unique,
   created_at)`. Generate tokens with the crypto-random pattern from
   `randomSuffix()` in `trips.functions.ts` (longer — 12+ chars). The user's
   address is `<inbox>+<token>@gmail.com` (Gmail plus-addressing). Show it in
   the authenticated area with a copy button.
2. **Scan function.** New server fn `scanForwardedMail`: Gmail `messages.list`
   with `q=to:(+<token>) newer_than:7d` per the gateway patterns already in
   `gmail-import.functions.ts`; for each new message, extract the text body,
   run `parseItineraryAi`, create a draft trip (status `draft`) or — if the
   user picks an existing trip — hand off to Directive 4's `previewMerge`.
3. **Dedupe.** Migration: `ingested_messages (gmail_message_id unique,
   user_id, trip_id, processed_at)`. Skip already-processed ids.
4. **Trigger, v1 = manual.** A "Check forwarded mail" button in the user's
   trips view calling `scanForwardedMail`. Only add scheduling (Supabase
   cron / pg_cron, if enabled on this project) after the manual path is
   solid; verify what the Lovable/Supabase plan actually supports before
   promising background ingest.
5. **Security invariants.** Email bodies are *data, never instructions*: they
   go to the parser only — no link-following, no acting on content. Token is
   the only routing key; unknown tokens are dropped silently. Rate-limit the
   scan per user.

**Done when:** forwarding a real airline confirmation and tapping "Check
forwarded mail" yields a draft dossier; the same email twice is a no-op;
tokens are unguessable and revocable (delete row).

---

## 6b. Live enrichment: weather first, flight status second

**Weather (free, no key — do this one).**
1. Server fn `getTripWeather`: Open-Meteo forecast API by lat/lon + date
   range. Coordinates: the Places enrichment path already resolves venues —
   check whether it stores lat/lng on blocks; if not, geocode the trip
   destination once and store on `trips.content.meta`. Cache responses
   (table or in-memory TTL ≥6 h) — forecasts don't need freshness beyond
   that, and the dossier load must never block on it (fetch client-side
   after paint, render nothing on failure).
2. UI: a small chip in the day-section header (shared views only,
   `skin.css` tokens, contrast pattern, no layout shift — reserve the slot).
   Only render within the 14-day forecast window.
3. The payoff move: when a day's forecast is rainy AND the day has
   `tier: "shadow"` alternatives, emphasize the existing Plan-B cue
   (`.tds-planb-cue`) — "Rain likely — see Plan B". This turns a static
   feature into an assistant.

**Flight status (paid API — behind a flag).**
Gate the whole feature on an env var (e.g. `FLIGHT_STATUS_API_KEY`,
AeroDataBox/RapidAPI has a workable free tier). Server fn queries by
`flightNumber + date` **only when the dossier is viewed on/±1 day of the
flight date** (rate limits are the constraint); render a status pill on the
boarding-pass card fields via shared views. If no key is configured, the
feature is invisible — no dead UI.

**Done when:** day headers show weather chips on a real upcoming trip; rainy
Plan-B emphasis fires on a fixture; flight status appears with a key
configured and is absent without one; CLS stays 0.

---

## 6c. Suggest-a-change (smallest possible collaboration)

**Objective.** A visitor viewing a shared dossier can propose an edit
("dinner moved to 8pm"); the owner reviews and accepts/rejects. No accounts
for visitors, no live sync, no comments — just a suggestion queue.

**Implementation.**
1. Migration: `trip_suggestions (id, trip_id, block_key, field,
   proposed_value, note, status pending/accepted/rejected, created_at)`.
2. Server fn `submitSuggestion` — unauthenticated but abuse-limited:
   per-trip + per-IP rate limit, length caps, honeypot field. Suggestions are
   plain data; render them escaped, never as markup.
3. Visitor UI: "Suggest an edit" row in `PlaceSheet.tsx` (visitors already
   open it from activity rows) → tiny form (field picker, value, optional
   note).
4. Owner UI: badge on StudioBar → review sheet (`TdSheet`) listing pending
   suggestions with the Directive-4 `before → after` row treatment; accept
   writes through `updateTrip` (mark `enrichmentSource: "manual"`), reject
   just flips status.
5. Reuse, don't invent: identity keys from Directive 4's `merge.ts` name the
   target block; the diff-row component from its DiffSheet renders the
   proposal.

**Done when:** visitor suggests a time change from a phone; owner sees a
badge, accepts, dossier updates; a rejected suggestion disappears; spam
hammering the endpoint gets 429s; a11y stays 100 on both sheets.
