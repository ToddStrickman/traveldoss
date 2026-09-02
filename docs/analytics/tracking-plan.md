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
