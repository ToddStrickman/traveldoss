# Directive 5 — Public Page Performance (attack the frontend-addressable gap)

## Objective
Raise `/t/<slug>` mobile Lighthouse performance to a stable ≥85 by shrinking
what we ship and caching what we serve — without touching the numbers that
are already perfect (TBT ≈0, CLS 0, a11y 100).

## Why (and what NOT to chase)
Live measurements (2026-07-06, mobile emulation, `t/cassian-87cq2u`): perf
64–83 across runs, TBT 0–15 ms, CLS 0. The run-to-run spread tracks Lovable's
SSR response (~0.6–2 s), which we cannot fix from this repo. **Do not spend
time on server response.** The frontend-addressable remainder is bundle size
and delivery. Measure before and after every change — the harness is in the
README (headless-shell + `lighthouse --port` attach; chrome-launcher is
broken on Windows).

## Work — in order of expected yield

### 1. Split the skin registry (likely the big one)
`src/lib/skins/registry.ts` statically imports all ten skins; `t.$slug.tsx`
resolves one via `getSkin(...)`. If that pulls every skin (plus their
`previewFixture` demo data) into the dossier route chunk, a visitor downloads
ten magazines to read one.
- Verify first: `npx vite build` and inspect the `registry-*` chunk size /
  composition (rollup-plugin-visualizer or read the manifest).
- If confirmed: convert the registry to per-skin dynamic imports
  (`() => import("./cassian")`), resolve the skin in the route loader (the
  slug prefix *is* the skin id), and keep the gallery working — it needs all
  metas cheaply, so split `meta` (static, tiny) from `Render`/fixture (lazy).
  Watch for SSR: the skin must be resolvable server-side too (await the
  import in the loader, not in an effect) so first paint stays server-rendered.

### 2. Keep three.js off the dossier path
`three` (~600 KB) serves only the landing sand hero (`SandHero.tsx`). Route
chunks should already isolate it — verify no `/t/` navigation loads a chunk
containing three. If it leaks (shared vendor chunk), add a manual chunk or
dynamic-import the sand engine inside `SandHero`. Also confirm
`MobileBubbles` and other landing-only motion never mount on `/t/` (there is
existing route-gating in `src/components/motion/MobileBubbles.tsx`).

### 3. CDN cache headers for anonymous dossier HTML
Public dossiers are read-heavy and change rarely.
- In `t.$slug.tsx`, use TanStack Start's route `headers`/response API: when
  the request carries **no Supabase auth cookie**, set
  `Cache-Control: public, s-maxage=60, stale-while-revalidate=3600`.
  Authenticated requests get `private, no-store` (the HTML embeds owner
  state — StudioBar, `isOwner`).
- **Gate on reality**: first confirm Lovable's CDN honors `s-maxage` (deploy
  a probe header and inspect response headers + timing from a cold edge). If
  the platform strips or ignores it, stop, note it in this file, and move on
  — do not build speculative caching layers.
- Correctness check: after an owner edit, a visitor must never see stale
  content past the SWR window — 60 s is the accepted ceiling.

### 4. Font delivery
Skins load display fonts via per-skin Google-Fonts CSS (`tokens.fontUrl`).
For the dossier route, emit a `<link rel="preload">` (or at minimum
`preconnect` — root preconnects exist, verify coverage) for the *active*
skin's font CSS in the route `head()` so text settles before LCP.

## Guardrails
- CLS must stay 0 and a11y 100 — re-run the full Lighthouse pair after each
  step, 3 runs each (the SSR variance means single runs lie).
- No skin `Render` edits; the registry refactor touches `registry.ts` and
  callers only (`t.$slug.tsx`, `templates.tsx`, `e2e.dossier.tsx`,
  `SkinPeek.tsx`).

## Definition of done
- [ ] Dossier route JS (excluding the platform runtime) measurably smaller —
      record before/after chunk sizes in the PR description.
- [ ] Three.js provably absent from `/t/` network waterfall.
- [ ] Cache-header behavior confirmed and documented either way.
- [ ] Perf ≥85 median of 3 mobile runs; TBT ≤50 ms; CLS 0; a11y 100.
- [ ] Gallery, peek swiper, and `/e2e/dossier` harness all still work
      (registry consumers), `vitest` + `tsc` green.
