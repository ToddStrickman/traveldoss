# Google Analytics

GA4 data stream **TravelDoss Home**, measurement ID `G-L84257MD4T` (overridable
by a well-formed `VITE_GA_MEASUREMENT_ID`). Read this
before changing anything under `src/lib/analytics/`, the `scripts` array in
`src/routes/__root.tsx`, or the `initAnalytics` call in `src/router.tsx`.

**Status: ON.** `ANALYTICS_ENABLED` in `src/lib/analytics/gtag.ts` is `true`,
unblocked by Privacy Policy **v1.1** §5 "Cookies and Analytics". Reports begin
at the first production deploy of that policy — see "Disclosure is the
precondition" below.

## Two analytics systems, on purpose

| System             | Module                                                | Job                                                                                                       | Sends page views?                                    |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Google Analytics 4 | `src/lib/analytics/gtag.ts`                           | Marketing / acquisition: page views, sources, landing pages, plus a mirror of every PostHog product event | **Yes** — the only one                               |
| PostHog            | `src/lib/analytics.ts`, `src/lib/analytics.server.ts` | In-product events (guide views, compose flow, contact form) and the future B2B/admin dashboard            | No (`capture_pageview: false`, `autocapture: false`) |

GA4 owns page views. Product events are captured once, through `capture()` in
`src/lib/analytics.ts`, which fans out to PostHog and to `gtagEvent` — one event
vocabulary (`docs/analytics/tracking-plan.md`), no inline `gtag(...)` calls
anywhere else. Do not add page-view capture to PostHog: GA4 is the only
page-view sender, so nothing is double-counted.

Lovable's hosting also injects its own `/~flock.js` platform analytics at the
edge. It is not in this repo and is not a Google tag.

**There is exactly one Google tag per page.** It is emitted once, from the root
route's `head.scripts`. Never add a `gtag/js` script or a `gtag('config')` call
anywhere else — a second tag double-counts every session.

## Why the pasted snippet was not used verbatim

Google's install instructions say to paste the snippet immediately after `<head>`
on every page. Two things make that wrong here.

**There is no `index.html`.** TanStack Start renders the document shell from
`RootShell` in `src/routes/__root.tsx`; `<HeadContent />` emits whatever the root
route's `head()` returns. `gtagHeadScripts()` is spread into that `scripts`
array, which is the framework's equivalent of "first thing in `<head>`" and the
one place that covers every route.

**It is a single-page app.** `gtag('config')` sends exactly one `page_view`, at
document load. Every client-side navigation after that is invisible to GA. The
snippet on its own would have recorded one page view per session and attributed
the whole visit to the entry URL — `/templates`, `/plan`, `/login` and every
dossier view would simply not exist in the reports. `initAnalytics(router)`
subscribes to the router's `onResolved` event and sends the rest.

## No duplicate page views

Three guards, and all three are needed:

1. `send_page_view: false` on the `config` call — gtag's own automatic hit is
   off, so our code is the only sender.
2. `trackPageview` dedupes consecutive identical paths, so the entry page view
   and the router's `onResolved` for the entry route count once.
3. The `onResolved` subscriber ignores events where `pathChanged` is false
   (search-param or hash changes on the same path).
4. The inline bootstrap is guarded by `window.__tdGtagBooted`. TanStack Router
   removes and re-appends route-managed inline head scripts on every
   client-side navigation (`Script` in `@tanstack/react-router`'s `Asset.js`),
   which re-executes them; without the guard each navigation would push
   another `js` + `config` onto the dataLayer. The external `gtag.js` tag is
   deduplicated by `src` by that same code, so a second Google tag is never
   inserted. Verified locally 2026-09-01: one document load, three in-app
   navigations, one `config`, three `page_view`s.

## Redaction is a security control, not formatting

`/t/<slug>` is a capability URL: the slug is the only thing gating read access to
a dossier (the reasoning is in `src/lib/analytics/scrub.ts`). A slug that reaches
Google hands trip access to everyone who can read the Analytics property, and
Google retains it on its own terms. Every path and referrer sent to GA therefore
goes through `scrubPath` / `scrubUrl`.

Two details make that hold, and both are load-bearing:

- **`send_page_view: false` on the `config` call.** At GA4's default, `config`
  fires a page*view built from `document.location` \_before any of our code runs*.
  A visitor landing directly on a share link would hand Google the raw slug, and
  scrubbing later navigations could not undo it. With it off, every page view —
  including the first — is one we construct and scrub.
- **`page_location` is set explicitly.** GA4 treats the full URL as canonical and
  falls back to `document.location` when the field is absent, so setting only
  `page_path` would leave the unscrubbed slug in the hit.

`tests/analytics-gtag.test.ts` asserts both. Those are security assertions — do
not relax them to make an unrelated change pass.

## Hosts that do not report

`localhost`, `127.0.0.1`, `id-preview--*.lovable.app`, and anything under
`.lovable.app` (`traveldoss.lovable.app` 302s to traveldoss.com, so counting it
double-counts). The rules live once as data in `gtag.ts` and are inlined into the
bootstrap snippet from that same source so the two cannot drift.

On a skipped host `gtag.js` still loads — it is `async` and CDN-cached — but
without a `config` call it sets no cookie and sends no hit.

## The `sideEffects: false` trap

`package.json` declares `"sideEffects": false`, so Rollup deletes any import whose
exports are never referenced. `initAnalytics` is therefore an exported function
that `src/router.tsx` calls, never a bare `import "@/lib/analytics/gtag"` — that
form is silently dropped from the client bundle with no build error.

## Disclosure is the precondition

Privacy Policy v1.0 had **no cookies, analytics, or tracking section at all** —
§4 covered only "cloud hosting, database and authentication services, and AI
model providers". GA4's `_ga` cookie is a materially different processing
activity, so analytics ships together with the policy that discloses it.

**v1.1 (2026-08-28)** closed that gap:

- new §5 "Cookies and Analytics" — names Google Analytics, the `_ga` cookie, the
  fields collected, the dossier-slug redaction, no-advertising commitment, and
  the opt-out;
- §1 gains a "Usage and analytics information" category;
- §4 now lists analytics and error-monitoring providers;
- §8 cross-references the opt-out.

Section anchors are renumbering-stable (`headingSlug` strips leading numbers),
so inserting §5 did not break any deep link. Bumping `privacy` only updates the
public page; unlike `terms`, it does not re-prompt signed-in users.

If the policy is ever revised back to text that does not describe analytics,
`ANALYTICS_ENABLED` goes to `false` in the same commit.

### Still owed

- **GA property settings are not in this repo.** Confirm in the GA4 admin that
  Google Signals and ad personalization are **off**, and set data retention
  deliberately — the policy's "no advertising" sentence is a promise the code
  cannot enforce.
- **No consent banner.** Reasonable if traffic is US-only; GDPR/UK visitors need
  prior consent for analytics cookies, which means Google Consent Mode v2 and a
  banner. Decide before marketing into the EU.
- **Attorney review.** The policy still carries its draft notice.

## Verifying

Dev stays clean even with the flag on: `gtagHeadScripts()` also requires
`import.meta.env.PROD`, and `localhost` is a non-measurable host — so a local
dev server renders no GA tags and sends no hits. That is correct, not a failure.

To exercise the real path locally, temporarily (a) drop the
`import.meta.env.PROD` check in `gtagHeadScripts()`, (b) empty
`NON_MEASURABLE_EXACT`, and (c) **replace `GA_MEASUREMENT_ID` with a throwaway
id** so local traffic never lands in the production property. Then, after a
client-side navigation:

```js
performance.getEntriesByType("navigation").length; // 1 — no hard reload
window.dataLayer.filter((a) => a[1] === "page_view").map((a) => a[2].page_path);
```

Two or more page views from a single document load is the SPA fix working.
Navigate to a `/t/<slug>` URL and confirm the hit reads `/t/:slug` in both
`page_path` and `page_location`. Revert all three edits afterwards.

In production:

1. `curl -s https://traveldoss.com | grep -c "gtag/js?id=G-L84257MD4T"` must
   print `1` — exactly one tag.
2. GA4 → Reports → Realtime: your own visit appears within a minute.
3. Navigate in-app to `/templates` or `/plan` without reloading; each shows as
   a distinct page in Realtime. If only the landing path ever shows, the router
   subscription is not running.
4. In DevTools → Network, filter `collect?v=2`: one request per navigation,
   never two for the same path.
