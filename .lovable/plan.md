# Google Analytics 4 for TravelDoss

Add the GA4 tag (`G-L84257MD4T`) so page visits, the walkthrough flow, and view/layout switches show up in the GA dashboard. PostHog stays exactly as it is — GA becomes a second, parallel destination fed by the same `capture()` calls, so there is only one event vocabulary to maintain.

## What lands

**1. The tag itself.** GA4's `gtag.js` loads from the site head on every page, configured with automatic page views turned off (a single-page app fires its own, otherwise GA misses every client-side navigation and double-counts the first one).

**2. Page views on every route change.** Each navigation sends a `page_view` with a cleaned path. Real trip slugs, guide slugs, and template ids are replaced with placeholders (`/t/:slug`, `/guides/:slug`, `/templates/:id`) so GA reports one row per page type instead of thousands of unique URLs — and so no trip identifier leaks into a third-party dashboard.

**3. Flows and view switches.** Every event already captured in the app (mint funnel steps, `flow_step_navigated`, `template_browse_mode_changed`, layout/view switches, guide interactions, failures) is mirrored to GA automatically. No new call sites, no duplicated event lists: the existing `capture()` fans out to PostHog and GA. Event names and properties keep their current snake_case shape, and the existing no-PII rules still hold — lengths and counts only, never itinerary text or emails.

**4. Graceful absence.** If the tag is unavailable (blocked, or a preview without the id), everything no-ops silently. Analytics never throws into the UI.

## What does not change

- PostHog (`src/lib/analytics.ts` capture behaviour, `src/lib/analytics.server.ts`) keeps working as the primary product-analytics store.
- No Google Tag Manager container, and exactly one `gtag.js` script on the page.
- No changes to skins, dossier rendering, layouts, or the mint flow.

## Technical notes

- New `src/lib/analytics/gtag.ts`: exports `GA_MEASUREMENT_ID = "G-L84257MD4T"` (overridable by `VITE_GA_MEASUREMENT_ID` / the Google Analytics connector variable when present), `gtagHeadScripts()` returning the two head script entries (the async loader plus the inline bootstrap with `send_page_view: false`), `gtagPageView(path)`, and `gtagEvent(name, props)`. All browser-guarded; server-side render emits the scripts but never calls into `window`.
- New `src/lib/analytics/scrub.ts`: path scrubbing for `/t/:slug`, `/guides/:slug`, `/templates/:id`, `/auth/*`, with unit tests next to it (`scrub.test.ts`, vitest).
- `src/routes/__root.tsx`: spread `...gtagHeadScripts()` at the top of the existing `head().scripts` array — the only place a Google tag appears in the codebase.
- `src/router.tsx`: after creating the router, call `initAnalytics(router)` inside `if (!import.meta.env.SSR)`; it subscribes to the router's navigation-resolved event and sends one scrubbed `page_view` per view, including the first.
- `src/lib/analytics.ts`: `capture()` gains a single forwarding line to `gtagEvent(event, props)`. PostHog init, event helpers, and the no-op behaviour are untouched.
- `docs/analytics/tracking-plan.md`: note that GA4 is a mirror destination, that page views are scrubbed, and that GA carries no PII.
- Verification: `npx vitest run` and a typecheck; then load `/`, `/templates`, and `/t/<slug>` in a browser and confirm exactly one `googletagmanager.com/gtag/js?id=G-L84257MD4T` request, one `send_page_view:false` bootstrap, a `collect` beacon per route change, and scrubbed paths in the payload.
