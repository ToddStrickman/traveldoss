# Tracking plan

## Contact form (`/contact`)

| Event                       | When                                                     | Properties                                                         |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| `contact_message_submitted` | A contact message is accepted by the server function     | `category`, `message_length` (length only — never message content) |
| `contact_message_failed`    | Submission rejected (validation, throttle, insert error) | `category`, `reason` (truncated error text)                        |

## Access audit trail

| Event                 | Where                                                  | Properties                 |
| --------------------- | ------------------------------------------------------ | -------------------------- |
| `access_trail_opened` | client — owner expands the access trail on `/t/<slug>` | `trip_slug`, `event_count` |

Dossier views and exports themselves are recorded in the `trip_access_events`
table server-side (`getDossierBySlug`, `logTripExport`), not in PostHog: the
audit ledger must be complete and adblock-proof.

## Compose flow (intake modal)

| Event                          | When                                                                                                | Properties                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `flow_step_navigated`          | A landing-page flow step is reached via the prev/next controls, arrow keys, or a swipe              | `step`, `from_step`, `via` (`button` \| `keyboard` \| `swipe`), `surface` (`mobile` \| `desktop`)             |
| `compose_opened`               | The intake modal opens                                                                              | `entry` (`mobile_bar` \| `dock` \| `template_card`), `template_id` (null when the template stage opens first) |
| `template_previewed`           | A cover settles in the centre of the stage-1 carousel (throttled, so a swipe does not spray events) | `template_id`                                                                                                 |
| `template_picked`              | A cover is chosen in stage 1                                                                        | `template_id`, `index`                                                                                        |
| `template_switched`            | The top-bar template chip is used to change the dossier mid-compose                                 | `from_template_id`, `template_id`                                                                             |
| `template_browse_mode_changed` | The /templates browse switcher changes layout (grid / horizontal / vertical)                        | `mode`, `from_mode`                                                                                           |

## Mint funnel

`compose_opened` is step 1 (see the compose table above); the modal-open moment
has exactly one event name.

| Event                | When                                                            | Properties                                                |
| -------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| `mint_input_ready`   | The Mint Dossier button first becomes enabled                   | `template_id`, `tab`, `input_length`                      |
| `mint_submitted`     | Mint Dossier is pressed                                         | `template_id`, `tab`, `input_length`                      |
| `mint_login_required`| The composer draft is stashed and the user is sent to the wall   | `template_id`, `tab`                                      |
| `mint_parse_failed`  | AI parse throws, or no blocks could be read                     | `template_id`, `tab`, `reason`                            |
| `mint_completed`     | The dossier row exists (client mirror of the server event)       | `template_id`, `trip_id`, `block_count`, `day_count`       |
| `mint_failed`        | `createTripFromIngestion` rejects                               | `template_id`, `reason`                                   |

`mint_completed` is ALSO captured server-side in `createTripFromIngestion`
(`source: "server"`) — the money/lifecycle transition is never trusted from the
client, and the client copy is the adblock-proof denominator, same pattern as
`dossier_viewed`. Both carry `trip_id`, never `trip_slug`: the slug is a
capability URL and every capture fans out to GA.

## Google Analytics 4 (mirror destination)

GA4 (`gtag.js`, measurement id in `src/lib/analytics/gtag.ts`, overridable via
`VITE_GA_MEASUREMENT_ID`) is a **mirror**, not a second vocabulary: every
`capture()` in `src/lib/analytics.ts` fans out to GA with the same
`object_verb` snake_case name and the same properties. There are no
GA-specific call sites, and inline `gtag(...)` calls outside
`src/lib/analytics/gtag.ts` are forbidden.

- The tag installs once, from the root route `head().scripts`, with
  `send_page_view: false`.
- `page_view` is sent per resolved navigation from `src/router.tsx`, with the
  path scrubbed by `src/lib/analytics/scrub.ts` (`/t/:slug`, `/guides/:slug`,
  `/templates/:id`, `/auth/*`) — GA never receives a real slug.
- GA carries no PII and no content: lengths and counts only, same rule as
  PostHog. Money/lifecycle transitions stay server-side.
- The tag is emitted only for production builds and only configures itself on
  measurable hosts: `localhost`, `127.0.0.1`, `id-preview--*.lovable.app` and
  `*.lovable.app` never report into the production property.
- `page_referrer` is scrubbed too (`scrubUrl`): slug placeholders, sensitive
  query values redacted, fragment dropped.
- The inline bootstrap is idempotent (`window.__tdGtagBooted`) because TanStack
  Router re-executes inline head scripts on client-side navigation.
- Disclosure: Privacy Policy v1.1 §5 "Cookies and Analytics" names GA4 and the
  `_ga` cookie. `ANALYTICS_ENABLED` in `gtag.ts` is coupled to that disclosure.
- Full rationale and verification steps: `docs/directives/ANALYTICS.md`.

## First-party store & admin console (2026-09-03)

GA4 cannot be queried from the app and PostHog has no key configured, so every
`capture()` also lands in a first-party table that the admin console reads.

- `src/lib/analytics/first-party.ts` — batched, anonymous sink. A per-tab
  `sessionStorage` id (`td_sid_v1`) is the only identifier; the path is scrubbed
  by `scrub.ts` so a dossier slug is never stored. Flushes every 2s, on
  `pagehide` and on tab hide. Also emits `page_viewed` per resolved navigation
  (the funnel's "landed" and "browsed templates" steps).
- `src/lib/analytics/event-allowlist.ts` — the complete event vocabulary. New
  events must be added here and documented in this file.
- `src/lib/product-events.functions.ts` — public `recordEvents` endpoint:
  allowlisted names, capped batch (20), capped prop count/length, primitives
  only, no client-supplied user id. Writes with the service role; RLS denies all
  client access to `product_events` and grants reads only to `has_role(uid,'admin')`.
- `src/lib/admin/queries.server.ts` — metrics from ground-truth tables (`trips`,
  `trip_access_events`, `trip_entitlements`, `profiles`, `contact_messages`) plus
  `product_events`. Returns counts, rates and lengths only.
- `/app/admin` (`src/routes/_authenticated/app_.admin.tsx`) — admin-only console;
  the rail button in `Ribbon.tsx` renders only for admins.

New event: `page_viewed` (first-party only, not mirrored to GA — GA sends its own
`page_view`). Props: `entry` (boolean), scrubbed `path`.

## Investor snapshots (admin-only, server-captured)

Snapshot links freeze the console's aggregate panels behind a random 32-hex
token served at `/admin/s/:token` (noindex, 30-day expiry, revocable).

| Event | Where | Props |
| --- | --- | --- |
| `admin_snapshot_created` | `createAdminSnapshot` (server) | `range_days`, `ttl_days`, `labelled` |
| `admin_snapshot_revoked` | `revokeAdminSnapshot` (server) | — |
| `admin_snapshot_viewed` | `getAdminSnapshot` (server, public read) | `range_days` |

All three are server-side only (`captureServer`) and carry no viewer identity:
the public view uses the fixed distinct id `snapshot-viewer`. The stored payload
is the same aggregate `AdminMetrics` shape the console renders — no live feed, no
session ids, no slugs, no emails.

Revenue now reads the `purchases` ledger (Paddle, verified webhook only) instead
of `trip_entitlements`; with zero rows the panel renders an explicit
"Revenue not switched on yet" state rather than a misleading zero.

## Session segments (first-party, on every event)

Every first-party event now carries three coarse first-touch props, added in
`src/lib/analytics/first-party.ts` from `src/lib/analytics/segments.ts`:

| Prop | Values | Notes |
| --- | --- | --- |
| `src` | `direct`, `search`, `instagram`, `x`, …, `referral: <host>`, or a `utm_source`/`ref` value | Host bucket only — never a referring path or query (OAuth callbacks park tokens there) |
| `device` | `mobile`, `tablet`, `desktop` | From the UA string; no screen measurements |
| `browser` | `Chrome`, `Safari`, `Firefox`, `Edge`, `Opera`, `Samsung`, `other` | Family only, never a version |

Frozen on the first event of a tab (sessionStorage `td_seg_v1`), so an internal
navigation cannot re-attribute the visit. No new event names.

The console reads them in `loadAdminMetrics` → `metrics.segments`: four funnel
cuts (traffic source, device, browser, template) rendered by
`src/components/admin/SegmentFunnels.tsx`. Each session is attributed to the
segment value on its earliest event in the range; steps are landed → browsed →
composed → submitted → minted (`mint_completed`). Segments below `SMALL_N` (20
sessions) return `mintRate: null` and the UI shows counts plus a "small sample"
marker instead of a percentage.
