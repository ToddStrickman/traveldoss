# Adaptive Trip Dossier

Implemented in the existing TanStack Start / Supabase application. Owner route: /app/dossier/$tripId. Open it from a trip card or the owner banner on its existing dossier.

## Scope and status

| Area                                      | Implemented                                                                                                                                                               | Deployment dependency / boundary                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Planning and canonical records            | Confirmations, updates, evidence, versions, cancellation, explicit rebooking links, user edits, Review and restore                                                        | New private Supabase tables and service role                                                                                              |
| Gmail                                     | Per-user OAuth with PKCE and one-time state, encrypted refresh tokens, scoped historical scans, incremental history, retry-safe cursors, pause/revoke/delete              | Google OAuth project and credentials; real account consent has not been exercised in this environment                                     |
| Extraction                                | Authenticated recognized-provider JSON-LD and explicit labeled fields; uncertain information goes to Review                                                               | Arbitrary prose, PDF/image contents and missing timezones are not guessed; add provider parsers/OCR behind the extractor interface        |
| Other email providers                     | Provider-neutral email and sync interfaces                                                                                                                                | Outlook/Microsoft 365 and IMAP-family adapters remain to be implemented                                                                   |
| Live Trip                                 | Automatic/manual activation, pause/end/extension, separate operational values, impact/dependency assessment, notification outbox, preparation advice, history and restore | Background scheduler must run for unattended operation                                                                                    |
| Weather                                   | Real Open-Meteo hourly forecast adapter for upcoming items with coordinates                                                                                               | Explicit opt-in environment setting; choose the appropriate service plan. This is a forecast, not an official severe-weather warning feed |
| Flights / traffic / transit / destination | Validated normalized HTTPS gateway adapters and documented contracts                                                                                                      | Supply supported vendor gateways and credentials; no vendor account is bundled                                                            |
| Push                                      | Browser permission/subscription, preferences, quiet hours, outbox, retry/idempotency key, service-worker notification/click handlers                                      | Supply an authenticated Web Push relay and its matching VAPID public key                                                                  |
| Demo                                      | Complete interactive Planning/Live slice using the production domain and UI                                                                                               | Development-only /e2e/adaptive; fictional reservations and signals are explicitly labeled; it never connects an inbox or sends a push     |

The original shareable dossier remains a designed document. Imported email evidence and canonical records live in an owner-only workspace, not public trips.content. “Review existing dossier items” stages existing place blocks for explicit confirmation, including dates/timezones. There is no automatic write-back into shared design blocks or public PDF exports. A signed-in collaborator cannot read the owner's email evidence.

## Major modules

- src/lib/adaptive/types.ts: domain records, schemas, preferences and provider signal contracts.
- normalize.ts, extract.ts, reconcile.ts: conservative extraction, identity matching, source relationships, idempotency, cancellation, rebooking, Review and reservation history.
- live.ts, commands.ts: lifecycle, operational updates, relevance/freshness, dependencies, impact, suggestions, suppression and user actions.
- gmail.server.ts, oauth.server.ts, crypto.server.ts: per-user Gmail authorization and ingestion; AES-GCM token encryption bound to the owner.
- store.server.ts, worker.server.ts, adaptive.functions.ts: authenticated owner boundary, atomic revision saves, account/job leases, scheduler, delivery and privacy controls.
- live-providers.server.ts, providers.ts: replaceable weather, flight, transit, advisory and delivery adapters.
- src/components/adaptive/: Planning/Live screens, source/history views, Review, preferences, manual reservation form and reuse of the existing MapLibre canvas.
- src/routes/_authenticated/app_.dossier.$tripId.tsx: private application route.
- src/routes/api.adaptive.gmail.callback.ts and api.adaptive.jobs.ts: OAuth and authenticated job endpoints.
- public/adaptive-push.js, vite.config.ts: production push handling and private-route cache exclusions.
- src/lib/analytics/scrub.ts and analytics.ts: private identifiers and callback/redirect values scrubbed; session replay disabled.

## Database rollout

Apply supabase/migrations/20260921120000_adaptive_trip_dossier.sql through the project's normal reviewed migration process. It has **not** been applied to the configured Supabase project by this implementation task.

The migration creates:

1. adaptive_workspaces: one revisioned JSON aggregate per owner, containing canonical items, evidence, versions, Review, live state, audit and notification outbox.
2. adaptive_email_accounts: owner-specific Gmail connection, encrypted credentials, scope/cursor/status and sync lease.
3. adaptive_oauth_states: short-lived, hashed, one-use OAuth state and encrypted PKCE verifier.
4. adaptive_push_subscriptions: owner-specific browser subscriptions.

All four use RLS. Only the owner can read their workspace through the authenticated role; clients cannot directly mutate adaptive state or read credential/subscription tables. Service-only functions implement compare-and-swap writes, job leases, sync/management leases and atomic reconnect. The Supabase service role is server-only and must never use a VITE\_ prefix.

Reservation + evidence + history + outbox changes commit together. Cursor advancement happens only after reconciliation persists. A retry can replay email pages without duplicate records. Conflicting writes retry against a fresh revision. Reconnect, pause, disconnect and erasure cannot replace a connection while its sync lease is held.

Application writes stop safely at 11 MB of aggregate JSON; the database has a 12 MB ceiling. No automatic history pruning occurs. Large accounts should move to partitioned item/evidence/outbox tables before that ceiling becomes common. Account deletion cascades these tables.

## Gmail setup

1. Enable Gmail API in a Google Cloud project. Configure the OAuth consent screen, authorized users/testing status and the appropriate production verification process for the requested access.
2. Create a **Web application** OAuth client. Register the exact production redirect URI: https://YOUR_HOST/api/public/adaptive/gmail/callback.
3. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI, ADAPTIVE_TOKEN_KEY and the Supabase server keys. ADAPTIVE_TOKEN_KEY must be 32 cryptographically random bytes encoded as base64. Keep it stable and securely backed up: replacing it makes stored tokens unreadable unless they are re-encrypted.
4. Open a private dossier → Settings → choose Last 30 days, Last 90 days, All travel history or New emails only → Connect Gmail.
5. Grant the Gmail read-only scope. Choose Sync now, or allow the configured worker to process pages.

No password is requested. Scope: https://www.googleapis.com/auth/gmail.readonly. Authorization uses offline access and a refresh token; refusal, expired/replayed state and missing scope fail closed. State is bound to an HttpOnly SameSite=Lax callback cookie, expires after ten minutes and is consumed atomically.

Historical search processes 20 message IDs per worker page and retains the page cursor. Gmail history follows new messages after the historical baseline. An expired history cursor restarts discovery inside the originally selected boundary; “new only” never silently widens to all mail. Unsupported attachments are represented as uncertain evidence, not fabricated parsed bookings.

Storage retains bounded subject/sender/timestamp/excerpt and extracted reservation data required for provenance, not a complete mailbox or raw HTML archive. Gmail IDs are namespaced by account. Unrelated message bodies are not retained. Pausing retains the connection; disconnecting revokes Google access and clears credentials. Explicit imported-data deletion requires disconnection plus typed confirmation and also erases the associated imported history; routine sync never deletes it.

Verify the published privacy disclosure and Google consent configuration reflect this actual use before enabling Gmail in production.

References: [Google web-server OAuth](https://developers.google.com/workspace/gmail/api/auth/web-server), [Gmail synchronization](https://developers.google.com/workspace/gmail/api/guides/sync), [OAuth security practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices).

## Background processing

Configure a trusted scheduler to POST to https://YOUR_HOST/api/public/adaptive/jobs with:

- Authorization: Bearer followed by ADAPTIVE_JOB_SECRET (at least 32 random characters).
- A five-minute interval to start; increase throughput with a durable queue as the account count grows.
- Retry on errors and monitor both HTTP status and the response's failed count.

The endpoint claims up to five due owners. Each pass refreshes owned-trip metadata, processes one page per connected Gmail account, evaluates lifecycle/live providers, and dispatches eligible notifications. It returns processed/failed counts without private user data. Stuck leases expire. Manual “Sync now” also refreshes email and applicable live providers; push delivery happens in the worker.

Email sync runs in Planning, Paused and Ended phases. Operational providers are polled only for Live trips, for items from three hours ago through the next 48 hours. Default automatic activation is 24 hours before the first active item. A manual pause/end persists; an extension prevents automatic end. With no reliable end time or all items cancelled, the system keeps the disruption context available rather than inventing an end.

The UI reports recent background coverage only after an actual worker check-in within 15 minutes. “Configured” describes an adapter, not verified healthy coverage. Provider failures retain the last known status and appear in the processing log. Five-minute polling is not a guarantee of instantaneous status; source/retrieval timestamps remain visible.

This route is an external scheduler boundary, not an automatically provisioned cron installation. For sustained scale, use a durable per-owner queue, renew job leases for long multi-account batches, separate evidence/outbox storage, and add provider backoff and monitoring.

## Live provider contract

Set the URL/TOKEN pairs for ADAPTIVE_FLIGHTS, ADAPTIVE_TRANSIT and/or ADAPTIVE_LOCAL. Endpoints must use HTTPS. Requests are POST JSON containing items with id, type, provider, startAt/endAt, route/location/coordinates and flightNumber. Traveler names, mailbox bodies, OAuth credentials and booking references are not sent.

Return an array matching SignalSchema in types.ts (maximum 100 signals / 500 KB). Example for a flight gateway:

```json
[
  {
    "id": "vendor-stable-update-id",
    "itemId": "EXACT_REQUEST_ITEM_ID",
    "category": "flights",
    "kind": "delay",
    "source": {
      "id": "airline-feed",
      "name": "Airline operational feed",
      "kind": "provider",
      "authoritative": true
    },
    "observedAt": "2030-06-18T10:00:00Z",
    "validFrom": "2030-06-18T10:00:00Z",
    "validUntil": "2030-06-18T10:30:00Z",
    "confidence": 0.98,
    "summary": "Departure is delayed by two hours.",
    "severity": "meaningful",
    "action": "Check the airline and review your airport pickup.",
    "association": {
      "startAt": "2030-06-18T12:00:00Z",
      "location": "JFK",
      "provider": "Air France",
      "flightNumber": "AF007"
    },
    "values": {
      "departure": "2030-06-18T14:00:00Z",
      "arrival": "2030-06-18T21:00:00Z",
      "gate": "C4"
    }
  }
]
```

The sample is a contract fixture, not an actual provider observation. association.startAt identifies the booked event time, not the changed departure. Use a stable vendor reference for id and the real source timestamp; do not manufacture freshness. The engine independently requires item/time/place agreement, authority and confidence. Flight signals additionally require provider and confirmation or flight-number identity. Low-confidence but plausible signals go to Review; unrelated or stale signals do not alter a plan.

Operational freshness: 30 minutes; weather/preparation: three hours, plus an applicable validity window. Gates, terminals, boarding, baggage, departure/arrival and suggested leave-by time are supported values. Original reservation values remain separate. Air quality/advisories/official severe-weather, traffic, diversions and rebooking coverage depend on the configured gateway; the bundled weather adapter does not supply every category.

Open-Meteo: enable ADAPTIVE_WEATHER_ENABLED=true. OPEN_METEO_API_KEY selects the customer API when supplied. The adapter fetches hourly temperature, rain probability, wind, UV and weather code for up to eight coordinate-bearing items within 48 hours. The UI explicitly states that retrieval time is known and model issue time is unavailable. Confirm deployment usage/plan against [Open-Meteo documentation](https://open-meteo.com/en/docs).

Dependencies are conservative inferred same-airport/city edges within 12 hours after transport arrival, with clearly labeled estimated transfer buffers. They are not route calculations or guaranteed minimum connection times. The current engine detects cancellation and arrival-time conflicts; a weather/traffic provider should supply relevant changed operational timing where a downstream delay is known. It does not infer travel-time delays from a generic weather headline.

## Notifications and privacy

Push defaults off. Critical and Important tiers can push only for relevant actionable fresh updates when enabled. Helpful stays in the dashboard unless explicitly opted in. Trip-specific category switches, quiet hours and a selected critical exception apply at assessment and again immediately before delivery. Planning stays quiet except for the separate, default-off critical email-booking-change setting.

Related Helpful updates appear together in the dashboard. A separate scheduled digest sender is not implemented. Duplicate content and superseded same-kind updates are suppressed. The outbox preserves why an update did or did not qualify.

Configure ADAPTIVE_PUSH_RELAY_URL, ADAPTIVE_PUSH_RELAY_TOKEN and ADAPTIVE_VAPID_PUBLIC_KEY. The relay must:

- Accept authenticated POST JSON with subscription and payload { title, body, url, tag }.
- Encrypt and send Web Push with the private VAPID key matching the configured public key.
- Persistently honor Idempotency-Key across retries; the app derives it from notification + browser subscription.
- Return 2xx after successful or previously completed delivery, 410 for an expired subscription, or a retriable failure otherwise.

The application does not ship that delivery service or a private VAPID key. Browser subscription requires the production service worker and HTTPS. Demo signals always remain in-app. Disabling push prevents new sends but does not unsubscribe the browser; the subscription is account-owned and removed when the account is deleted or the provider returns 410.

Location is requested only by an explicit traveler action and is optional. Coordinates stay in component memory and are cleared when disabled. Itinerary locations drive monitoring regardless of device permission. The current device location can open a user-requested map link; it is not used for unattended movement tracking or automatic traffic routing.

Private dossier/API/auth navigations are excluded from service-worker HTML caching. Server functions return private/no-store. Email bodies are not inserted as HTML. The private path and nested auth redirects are scrubbed in analytics and PostHog session replay is disabled. Operational provider requests carry only the fields described above; there is no advertising use.

All “contact provider”, map and external links require user interaction. No adapter can make purchases, change/cancel bookings or send provider messages. Reservation restore and live-status restore change the local dossier and add audit entries.

## Validation and local demo

Use the repository's frozen Bun lockfile. In this Windows environment the synced repository node_modules was incomplete, so dependencies and validation run from a temporary source mirror; source changes remain in the repository.

Commands:

```sh
bun install --frozen-lockfile
bun run test
bunx tsc --noEmit
bun run build
bunx playwright test e2e/adaptive-dossier.spec.ts
```

The focused feature tests cover matching, repeated email IDs, out-of-order cancellation, ambiguous identifiers, rebooking links, user-edit protection, cancellation attachment handling, timezone safety, Review, restore, lifecycle, location/date/source association, dependency risk, stale/duplicate signals, quiet hours/categories, planning silence, demo isolation, uncertainty and explicit erasure. Gmail protocol tests stub the external HTTP API to check pagination, history recovery, scope boundaries, MIME/authentication handling and owner-bound token encryption.

The migration test runs only against disposable PGlite, never the configured Supabase instance:

```sh
bun run scripts/check-adaptive-migration.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js
```

Browser coverage uses Chromium and WebKit at desktop/mobile widths, exercises Planning/Live/Review/cancellation/preferences/manual items/history/map, checks page errors and overflow, and verifies unauthorized job requests fail closed. Screenshots are written under test-results.

Run bun run dev and open /e2e/adaptive. Demo controls exercise updates/cancellations/delay/rain using the actual reconciliation and live-assessment code. The route returns not-found outside development mode.

## Launch checks and bounded follow-ups

- Apply the migration and supply server-only configuration; configure/observe the scheduler.
- Complete a real Gmail consent, initial scan, schedule change, cancellation, reconnect and revoke cycle with a test account.
- Validate a supported provider gateway against real event identity/timestamps and test push delivery on target devices.
- Update published privacy/consent disclosures through the existing versioned legal-document process before enabling access.
- Add parser fixtures for actual provider formats and a reviewed attachment extraction service as needed.
- Scale beyond the current bounded aggregate/polling model and add full authenticated staging tests.

No production migration, deployment, mailbox connection, push delivery, or external booking operation was performed by the local implementation task.

## Verified result (2026-09-21)

- Full Bun suite: **490 passed, 4 existing live-AI tests skipped, 0 failed** across 45 files.
- TypeScript: **passed** (tsc --noEmit).
- Scoped ESLint: **passed**, covering the feature, added tests/routes and analytics/Vite integration changes.
- Production build: **passed**, with non-fatal dependency directive/chunk-size/Nitro main-override warnings. The service worker now builds into the deployed .output/public directory and precaches 102 entries.
- Chromium and WebKit: **8 browser scenarios passed**, including desktop and mobile widths; screenshots inspected for layout and contrast.
- Disposable PostgreSQL: **22 checks passed** for ownership, grants, revision conflicts, job/account leases, privacy-operation serialization and atomic reconnect.
- Built service-worker browser probe: **passed** activation, public navigation caching, private dossier cache exclusion, push-handler import and no browser errors.

Run the production-artifact probe with Node:

```sh
node scripts/check-adaptive-service-worker.mjs
```

The direct Playwright probe hung under Bun on this Windows installation; it completed successfully under Node. The regular Playwright suite also completed successfully through the existing bunx entrypoint.

These results validate local code, simulated external protocols, browser behavior and the migration in disposable PostgreSQL. They do not claim a production deployment, a live Google consent/scan, live vendor status accuracy, or delivered device push.
