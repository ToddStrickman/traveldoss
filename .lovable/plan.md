# Adaptive Trip Dossier — integration plan

The code you sent is a real, finished feature, not a sketch. So this plan replaces the earlier "rebuild from scratch" plan: we merge your package into this app, adapt the handful of places where it disagrees with the current code, and switch it on one capability at a time.

## What I confirmed

- Your package carries 43 feature files: the private dossier screen, reservation and preference forms, a map panel, the whole adaptive engine (extract, normalize, reconcile, live trip, Gmail, push, privacy), two HTTP routes, tests, a database migration and the docs.
- None of it exists in this project yet. Nothing to undo, nothing to delete.
- It was built from an older copy of the app, so three shared files in the package are **stale** and must not be copied over. Compared line by line, their only genuinely new content is:
  - your trips list: one "Open Adaptive Dossier" link on each trip card,
  - the dossier page `/t/<slug>`: one owner-only banner linking to the private workspace,
  - analytics: private paths and redirect parameters stripped before anything is sent, and session replay switched off.
  Everything else in those three files is your older version and gets left alone (it would otherwise roll back the trusted-viewer masking, flight blocks, hotels and calendar panels shipped since).
- No new package dependencies are needed. The two extra entries in the package's dependency list belong to an unrelated markdown change.

## How the two halves relate

Your trips keep working exactly as they do now: `trips.content` blocks, skins, sharing, `/t/<slug>`. The adaptive workspace is a **separate private record per owner** — canonical bookings, the email evidence behind them, version history, a Review queue and live-trip state. Collaborators and public viewers never see it. The shared dossier only ever changes through the sync rule below.

**The traveler-best sync rule** (unchanged from the approved plan, still my recommendation):

- A booking already in the dossier that *changes* updates in place, with an "updated from your confirmation" marker and one-tap undo.
- A booking *not yet* in the dossier is offered, never inserted.
- Anything uncertain goes to Review and never touches the shared dossier.
- Every automatic edit is recorded and reversible; hand edits are never overwritten.

## Build order

**Step 1 — foundation and private workspace (no outside accounts)**

Apply the migration; merge the adaptive engine, components, styles, the owner route `/app/dossier/<trip-id>`, both test files and the docs; add the three small shared-file edits above. Outcome: you can open a trip's private workspace, enter reservations by hand, promote existing dossier items into canonical records, see version history and restore. Manual-entry path only — no inbox, no scheduler.

**Step 2 — the sync bridge**

Wire the traveler-best rule in both directions, with the update marker, undo and an audit entry. This is where the feature starts paying off.

**Step 3 — Gmail, per user**

Per-user consent with PKCE and one-time state, read-only scope, refresh tokens encrypted with a new server key, scoped scan (30 / 90 days / all / new only), incremental cursors, pause / disconnect / erase. Extraction stays conservative — prose and missing timezones go to Review rather than being guessed. Needs from you: an encryption key (I generate it) and permission to add the Gmail read-only scope plus the callback address to the Google sign-in credentials already configured here. Privacy and consent wording gets a new version through the existing legal-document process before this goes live.

**Step 4 — live trip, weather and the scheduler**

Automatic activation before the first item, manual pause / end / extend, disruption and dependency assessment, weather via Open-Meteo (no key, opt-in). The unattended job endpoint goes behind a bearer secret; I confirm how recurring jobs are actually scheduled in this project before committing to a mechanism.

**Step 5 — vendor feeds** (only when you have one) and **Step 6 — push** (needs a Web Push relay and key pair). Both are contract-only until you supply the service; until then updates surface in the workspace itself.

I'd stop after Step 2 for your review — together they are the whole feature minus the inbox.

## Technical notes

- Two HTTP routes in the package sit at `/api/adaptive/jobs` and `/api/adaptive/gmail/callback`. On a published site only `/api/public/*` bypasses site auth, so both move under `src/routes/api/public/adaptive/` and keep their own checks: constant-time bearer comparison on the job route, one-time state and PKCE verifier on the callback.
- `store.server.ts` builds its own service-role client; it is rewired to this project's generated admin client, imported inside handlers so it never reaches the browser. Server functions keep `requireSupabaseAuth` and return `private, no-store`.
- Migration reviewed and kept as written: owner-only read on the workspace row, no client write policies anywhere, explicit grants, all mutations through service-role-only functions, compare-and-swap so reservation + evidence + history + outbox commit together, leases so a sync and a privacy operation cannot race, and a size ceiling well below the row limit. The email cursor advances only after reconciliation persists.
- Service-worker config from the package is merged rather than replaced: the private dossier path and auth paths excluded from HTML caching, push script imported only once push exists.
- The package's environment names are aligned to what this project already holds (Google client id/secret) so nothing is duplicated; new secrets are only the token-encryption key and the job secret.
- Rule 9 analytics ship with each step — inbox connected, first reservation imported, review resolved, dossier synced, disruption surfaced, notification suppressed — counts and ids only, never content, documented in `docs/analytics/tracking-plan.md` in the same change.
- House rules hold: no per-skin file edits, mobile-first, accessibility and zero layout shift on `/t/<slug>` unchanged, `bun test` and `npx tsgo --noEmit` clean before each step closes. The package's own two test files and the migration/service-worker check scripts come along.
- The development demo route in the package is optional. Say the word and I include it (disabled outside development); otherwise I leave it out.

## What I need from you

- Go-ahead for Step 1 and 2.
- Later, at Step 3: permission to add the Gmail read-only scope to the existing Google credentials.
