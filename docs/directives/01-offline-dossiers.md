# Directive 1 — Offline Dossiers (close the PWA gaps)

## Objective
A traveler who has opened their dossier once can reload it in airplane mode
and get the full experience: all three views, skin fonts, no broken chrome.
The app is installable with real icons.

## Why
The dossier's whole job is to be there mid-trip — exactly when connectivity
isn't. This is the largest single trust gap in the product.

## Current state (most of the plumbing exists)
- `vite.config.ts` already configures **VitePWA**: `sw.js`, an app manifest,
  workbox precache of built assets, and runtime caching — `NetworkFirst`
  (4 s timeout) for HTML navigations in cache `td-html`, plus Google Fonts
  CSS/file caches.
- Registration is deliberately indirect: `src/lib/pwa/register-sw.ts` is a
  guarded wrapper (refuses dev, iframes, Lovable preview hosts, `?sw=off`)
  called from `src/routes/__root.tsx`. **Keep this wrapper** — the guards
  exist because Lovable's preview embeds the app in an iframe and a stale SW
  once poisoned previews.
- Because TanStack Start SSRs the dossier, the cached navigation HTML in
  `td-html` already contains the trip data — a previously-visited dossier
  mostly works offline today via that route.

## Gaps to close
1. **Real icons.** The manifest ships `favicon.png` as both 192 and 512 —
   fails maskable requirements and looks wrong on a home screen. Produce
   proper 192/512 PNGs (+ a true maskable variant with safe-zone padding)
   from the seal mark; put them in `public/`, update the `manifest` block in
   `vite.config.ts`.
2. **Client-side navigations aren't covered.** Only full navigations hit
   `td-html`. In-app route transitions fetch loader data from TanStack
   Start's server-function endpoints, which have no runtime cache. Add a
   `runtimeCaching` entry for those data requests (confirm the real URL
   prefix in the network tab — TSS versions differ; it's the path serving
   `createServerFn` calls) with `NetworkFirst`, short timeout, its own cache
   name, and **exclude anything authenticated/owner-only** (match only GET,
   deny `/api/`, keep the existing OAuth denylist behavior).
3. **No offline UX.** Add a small offline banner component (listen to
   `online`/`offline` events; render a quiet strip under the masthead bar:
   "Offline — showing your saved dossier"). Mount it in `t.$slug.tsx` only.
   Follow the house contrast/tap rules.
4. **No explicit "save for offline".** v1: a "Keep offline" row in the
   dossier's Days/View sheet that simply re-fetches the current URL plus the
   other two `?view=` variants to warm `td-html`, then confirms with a toast
   (sonner is installed). No SW messaging protocol needed for v1.

## Implementation notes
- Test the SW **only on production builds** (`npm run build` + preview or the
  deployed site) — `devOptions.enabled` is intentionally false.
- Playwright verification: `context.setOffline(true)` after a first visit;
  assert the dossier renders and fonts apply (check a `.tds` computed
  font-family, not just DOM presence).
- Mind cache staleness: `registerType: "autoUpdate"` + NetworkFirst is the
  right combination; do not switch dossier HTML to CacheFirst.
- The 30-day trip expiry (`expiresAt` in `trips.functions.ts`) matches the
  existing `td-html` maxAge — keep them aligned if you change either.

## Definition of done
- [ ] Airplane-mode reload of a previously-visited `/t/<slug>` renders all
      three views with correct skin typography.
- [ ] Lighthouse installability passes (manifest + icons + SW).
- [ ] Offline banner appears/disappears with connectivity, passes contrast.
- [ ] Owner/studio responses are never served from a shared cache.
- [ ] `?sw=off` kill switch still unregisters everything.
- [ ] `vitest` + `tsc` green; design-review shots show no visual regression.
