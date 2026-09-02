# GA4 wiring: already in the tree — verify, then publish

The hardening work is now present in this project. All five checks pass, and
`initAnalytics` is already wired into `src/router.tsx`, so no analytics code
needs to be written or changed.

## Check results

1. `src/lib/analytics/gtag.ts` — exports `GA_MEASUREMENT_ID` (default
   `"G-L84257MD4T"`), `initAnalytics`, `gtagEvent`, and contains the
   `window.__tdGtagBooted` idempotency guard. PASS
2. `src/routes/__root.tsx:111` spreads `...gtagHeadScripts()`; the only file
   referencing `googletagmanager.com` or `gtag('config')` is `gtag.ts` itself.
   One tag per page. PASS
3. `src/router.tsx:24-26` calls `initAnalytics(router)` inside
   `if (!import.meta.env.SSR)`. PASS
4. `src/lib/analytics.ts:51` calls `gtagEvent(event, props)` at the top of
   `capture()`; the PostHog lazy-init block is unchanged. PASS
5. `src/lib/legal/registry.ts` lists privacy at version `1.1` with
   `contentHash: "fnv1a64-2dcf0c2315affce0"`, and
   `src/content/legal/privacy-v1.1.md` exists. PASS

## What this plan does

1. No source changes. Nothing in `gtag.ts`, `scrub.ts`, the analytics tests, or
   the privacy policy text is touched, and PostHog stays as is.
2. Run the gate: unit tests and typecheck.
3. Publish the project.
4. Post-publish verification against `https://traveldoss.com`:
   - exactly one script whose `src` starts with
     `https://www.googletagmanager.com/gtag/js?id=G-L84257MD4T`
   - exactly one inline script containing `send_page_view:false`
   Report both counts back.

## One gap worth flagging (not fixed in this plan)

Page views will flow, and product events mirror to GA through
`capture()` → `gtagEvent()`. But there is currently **no mint funnel event** in
the vocabulary: `src/lib/analytics.ts` exposes guide, contact, access-trail,
compose and template events only, and `src/lib/analytics.server.ts` has just the
generic `captureServer` helper with no `mint_*` call site. So "mints reaching
G-L84257MD4T" will not be true until a `mint_completed` event is captured
server-side (Stripe webhook / mint completion) plus the client-side funnel steps.

Say the word and I'll spec that as a follow-up plan; it is a code change, so it
stays out of this publish-only pass.

## Technical notes

- Local dev renders no GA tags by design: `gtagHeadScripts()` also requires
  `import.meta.env.PROD`, and `localhost` is a non-measurable host. Verification
  therefore happens against the published domain, not the preview.
- `traveldoss.lovable.app` and `id-preview--*` are excluded hosts, so the
  published check must use `traveldoss.com`.
