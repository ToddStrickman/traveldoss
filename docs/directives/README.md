# TravelDoss Engineering Directives

Six self-contained work orders, each implementable independently unless a
dependency is called out. Written 2026-07-06 against `main` @ `ebb1d5c`.

| # | Directive | Traveler value | Size | Depends on |
|---|-----------|----------------|------|------------|
| 1 | [Offline dossiers](01-offline-dossiers.md) | Dossier works in airplane mode | M (2–3 d) | — |
| 2 | [Calendar & PDF export](02-calendar-and-pdf-export.md) | Trip escapes into calendars & paper | S–M (1–2 d) | — |
| 3 | [Parse trust UI](03-parse-trust-ui.md) | Visible confidence + one-tap correction | M (2–3 d) | — |
| 4 | [Dossier update loop](04-dossier-update-loop.md) | Re-ingest changed bookings with a diff | L (3–5 d) | — |
| 5 | [Public page performance](05-public-page-performance.md) | Faster first paint on shared links | M (2–3 d) | — |
| 6 | [High-yield follow-ups](06-high-yield-followups.md) | Auto-ingest, weather/flight status, suggestions | L (5–8 d total, split into 3 shippable slices) | 6a benefits from #4 |

Recommended order: **2 → 1 → 3 → 5 → 4 → 6** (quickest wins first; #4 and #6a
share the ingestion-merge machinery, so do #4 before #6a).

## Shared context (read before starting any directive)

**Stack.** TanStack Start (`@tanstack/react-start`) + Vite 7 + React 19 +
Tailwind v4 + Nitro, deployed on Lovable. Supabase for auth + data
(`@lovable.dev/cloud-auth-js`, `requireSupabaseAuth` middleware,
`supabaseAdmin` for privileged writes).

**Data model.** A trip lives in the Supabase `trips` table; the itinerary is a
JSON column `content: { blocks, skin }`. The `Block` discriminated union is
defined in `src/lib/skins/types.ts` — kinds: `hero`, `section`, `paragraph`,
`day`, `place`, `flight`, `quote`, `note`. Public dossiers render at
`/t/<slug>` (`src/routes/t.$slug.tsx`); slugs are `<skinId>-<random6>` minted
in `src/lib/trips.functions.ts`.

**Server functions.** Pattern: `createServerFn` + zod `inputValidator` +
`requireSupabaseAuth` middleware, in `src/lib/**/*.functions.ts`. AI calls go
through `src/lib/ai-gateway.server.ts`. The parse pipeline is
`parse-ai.functions.ts` → `normalize-ai.ts` (unit-tested) → zod. A background
hardening pipeline (`harden.functions.ts`) re-verifies blocks after first
render; `refine.functions.ts` re-runs the parser with updated trip meta.
Google Mail/Docs are reached through the Lovable connector gateway
(`connector-gateway.lovable.dev`, see `gmail-import.functions.ts`).

**Commands.**
- `npm install --legacy-peer-deps` (a transitive zod-v3 peer conflict;
  `bun.lock` is authoritative for cloud builds — if you change deps, sync it)
- `npm run dev` → localhost:8080
- `npx vitest run` (136 tests green as of this writing) and
  `./node_modules/.bin/tsc --noEmit` — both must pass before every push
- Visual verification: `node scripts/design-review-shots.mjs` (Playwright
  screenshot harness, 375/768/1280) and the dev-only fixture route
  `/e2e/dossier?skin=<id>&view=<v>`
- Lighthouse on Windows: chrome-launcher is broken (`spawn UNKNOWN`) — launch
  `chrome-headless-shell.exe` with `--remote-debugging-port=92XX` and attach
  `npx lighthouse@12 <url> --port=92XX`

**Deploy.** Push to `main` → Lovable syncs → trigger a deploy from the Lovable
project. Verify against `https://traveldoss.com` (the `.lovable.app` domain
302s with an empty body — never poll it). Note: `skin.css` bundles into
`assets/registry-*.css`, not the root `styles-*.css`.

## House rules (apply to every directive)

1. **Skins are content.** Never edit a skin's `Render` file
   (`src/lib/skins/<name>.tsx`). All shared UI changes go in
   `src/lib/skins/shared/` (views, `skin.css`) or route chrome.
2. **Don't regress the audits.** The live dossier currently scores
   Lighthouse accessibility **100** and CLS **0**. Any new text uses the
   contrast pattern `color-mix(in oklab, var(--tds-X) 78%, var(--tds-ink))`
   so it self-adapts to every skin's polarity; any new tap target is ≥24px
   (44px preferred, `.tap` utility); visible text must appear in accessible
   names (WCAG 2.5.3).
3. **Mobile-first.** Base styles are the mobile composition; desktop layers
   behind `md:`. Verify at 375 px and confirm 1280 px unchanged.
4. `src/routeTree.gen.ts` is generated — never hand-edit; stop the dev server
   before rebases and `git checkout -- src/routeTree.gen.ts` if it churns.
