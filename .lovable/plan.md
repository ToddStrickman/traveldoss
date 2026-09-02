# Mint funnel in Google Analytics

## Where things stand (verified in the code)

- `src/lib/analytics/gtag.ts` resolves `G-L84257MD4T`, exports `initAnalytics` and `gtagEvent`, and carries the `window.__tdGtagBooted` idempotency guard.
- `src/routes/__root.tsx:111` spreads `...gtagHeadScripts()` — the only place a Google tag is emitted.
- `src/router.tsx:25` calls `initAnalytics(router)` on the client only, so page views fire per resolved navigation.
- `src/lib/analytics.ts` `capture()` mirrors every product event to `gtagEvent`; PostHog stays page-view-free.
- Gap: `analytics.ts` and `analytics.server.ts` contain **no mint events at all**. Template events exist; nothing about the composer or the created dossier. That is why mints are absent from GA.

## What to add

Client helpers in `src/lib/analytics.ts` (one vocabulary, no inline `gtag`/`posthog` calls):

| Event | Fires when | Props |
| --- | --- | --- |
| `mint_composer_opened` | mint modal opens with a template chosen | `template_id`, `entry` |
| `mint_input_ready` | first moment the Mint button becomes enabled | `template_id`, `tab`, `input_length` |
| `mint_submitted` | Mint Dossier pressed | `template_id`, `tab`, `input_length`, `block_count` |
| `mint_login_required` | composer state saved and user sent to the login wall | `template_id`, `tab` |
| `mint_parse_failed` | parse/generate throws | `template_id`, `tab`, `reason` |
| `mint_completed` | dossier row created and slug returned | `template_id`, `trip_slug`, `block_count`, `day_count` |
| `mint_failed` | create call rejects | `template_id`, `reason` |

Wiring: `IngestionModal.tsx` (opened / input ready / submitted / login required / parse failed) and the three create call sites — `routes/index.tsx`, `routes/templates.tsx`, `routes/templates_.$id.tsx` — for completed / failed.

Also add a server-side `mint_completed` capture in `createTripFromIngestion` via `captureServer` (house rule: lifecycle transitions are captured server-side and never trusted from the client). The client event stays as the adblock-proof denominator, same pattern as `dossier_viewed`.

Content safety: lengths and counts only — never pasted itinerary text, prompts, block content, or emails.

Docs: add the seven events to `docs/analytics/tracking-plan.md` in the same change.

## Publishing and verification

1. `bun run test` and `npx tsc --noEmit` (the 15 live AI-parser network failures are pre-existing).
2. Publish, then fetch `https://traveldoss.com` and confirm exactly one `gtag/js?id=G-L84257MD4T` script plus one inline `send_page_view:false` block.
3. Drive a real mint against the preview and confirm `mint_submitted` and `mint_completed` land in `window.dataLayer`.

One thing I cannot do: **open the GA4 dashboard.** I have no Google account access from here, so Realtime confirmation is yours to click — Reports → Realtime on the `G-L84257MD4T` property, within a minute of loading traveldoss.com. Note the ID in your message read `G-L884257MD4T`; the tag in the code is `G-L84257MD4T`.

## Technical notes

- `gtag.ts`, `scrub.ts`, the analytics tests, and the privacy policy text are untouched.
- No new Google tag, snippet, or GTM container. PostHog unchanged.
- `mint_completed` server-side uses the Supabase auth UUID as distinct id.
