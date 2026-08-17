# Tracking plan

## Contact form (`/contact`)

| Event | When | Properties |
| --- | --- | --- |
| `contact_message_submitted` | A contact message is accepted by the server function | `category`, `message_length` (length only — never message content) |
| `contact_message_failed` | Submission rejected (validation, throttle, insert error) | `category`, `reason` (truncated error text) |

## Access audit trail

| Event | Where | Properties |
| --- | --- | --- |
| `access_trail_opened` | client — owner expands the access trail on `/t/<slug>` | `trip_slug`, `event_count` |

Dossier views and exports themselves are recorded in the `trip_access_events`
table server-side (`getDossierBySlug`, `logTripExport`), not in PostHog: the
audit ledger must be complete and adblock-proof.
