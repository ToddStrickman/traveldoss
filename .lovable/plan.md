# Adaptive Trip Dossier — how it lands in this app

## What's actually here today

I checked: none of it exists in this project. No adaptive files, no adaptive tables, no private dossier route, and `http://localhost:8080/e2e/adaptive` returns 404 — that page is running in the other copy of the app, not this one. The old Gmail import was deliberately removed in the 2026-08-31 hardening pass because it read one shared workspace inbox for every user.

So this is a rebuild here, against this codebase, in the order that gets value soonest with the fewest outside accounts. No demo route.

### About the folders on your Drive

`G:\My Drive\TravelDOSS\traveldoss-repository\src\components\adaptive` and `...\src\lib\adaptive` are on your own computer — I have no way to read them from here. Two ways forward:

- **Fastest: send them to me.** Zip those two folders (plus the migration file and any adaptive tests) and attach the zip in chat. I'll merge the files in, adapt them to this project's conventions, apply the migration here, and get the suite and typecheck clean. That skips most of Slices 1 and 4 below.
- **Or I rebuild.** The plan below stands on its own if you'd rather not move files around.

Either way the build order and the sync rule below are the same.

## How it fits the app you have

- Your trips already store their design in `trips.content` as blocks. That stays exactly as it is — a designed, shareable document.
- The adaptive side is a **separate private workspace per owner**: canonical bookings, the email evidence behind them, version history, and a Review queue for anything uncertain. Collaborators and public viewers never see it.
- Existing pieces get reused rather than duplicated: the MapLibre canvas, `CategoryIcon`, the flights and hotels logic, `getTemporalPhase` for trip phase, the versioned legal documents for the privacy disclosure, and the existing analytics modules.
- Everything server-side runs as server functions plus two HTTP routes (scheduler, OAuth callback). No edge functions.

## Shared dossier: the traveler-best rule

Neither extreme is right. What serves the traveler:

- A booking already in the dossier that **changes** (flight time, gate, hotel check-in) updates in place, automatically, with a small "updated from your confirmation" marker and one-tap undo. That is the whole point of an adaptive dossier — a stale time in a shared document is the failure everyone remembers.
- A booking **not yet** in the dossier is offered, never inserted: "Add this flight to your dossier?" You keep authorship of the document.
- Nothing uncertain ever touches the shared dossier. It goes to Review first.
- Every automatic edit is recorded and reversible, and edits you made by hand are never overwritten.

## Build order

**Slice 1 — the private workspace (no outside accounts needed)**
Migration for `adaptive_workspaces` (owner-scoped, revisioned, RLS + grants, compare-and-swap writes through service-only functions). Domain types, conservative normaliser, identity matching, reconciliation with cancellation and rebooking links, Review queue, version history and restore. Owner route `/_authenticated/app_.dossier.$tripId`, opened from a trip card and the owner banner. Manual reservation entry, plus "review existing dossier items" to promote current place blocks into canonical records with explicit dates and timezones.

**Slice 2 — the sync bridge**
The traveler-best rule above, both directions: canonical record → dossier block, with markers, undo and an audit entry. This is where the feature starts paying off, so it comes before any email plumbing.

**Slice 3 — Gmail, per user**
Per-user OAuth with PKCE and one-time state, read-only scope, refresh tokens encrypted with a new server key, scoped historical scan (30 / 90 days / all / new only), incremental history with retry-safe cursors, pause / disconnect / erase. Extraction stays conservative: recognised providers and clearly labelled fields only; prose, PDFs and missing timezones go to Review rather than being guessed. The Google client id and secret are already configured; I'll need one new token-encryption key.

**Slice 4 — live trip and weather**
Automatic activation before the first item, manual pause / end / extend, operational values kept separate from the original booking, impact and dependency assessment, history and restore. Weather via Open-Meteo (no key, opt-in). A scheduler route at `/api/public/adaptive/jobs` behind a bearer secret, driven by the database scheduler this project already uses for the doc-export sweep — so it runs unattended without you configuring anything external.

**Slice 5 — vendor feeds (only when you have one)**
The flight / transit / local gateway contract, validated, HTTPS-only, sending no traveller names or booking references. Built and tested against the contract; switched on when you supply a gateway.

**Slice 6 — push (optional, last)**
Browser subscription, preferences, quiet hours, outbox with idempotency keys. Requires a Web Push relay and a VAPID key pair; until then updates surface in the dossier itself.

## Technical notes

- Every new table: RLS plus explicit grants, owner-only reads, no client-side mutation of adaptive state; service-role writes only. Reservation, evidence, history and outbox changes commit together; the email cursor advances only after reconciliation persists.
- The aggregate-JSON model is bounded — writes stop safely below the row ceiling and the plan notes the move to per-item tables before that matters.
- Private routes excluded from service-worker HTML caching; server functions return `no-store`; the private path scrubbed in analytics; no email bodies rendered as HTML.
- Rule 9 analytics ship with each slice (import connected, first reservation imported, review resolved, dossier synced, disruption surfaced, notification suppressed — counts and ids only, never content), documented in `docs/analytics/tracking-plan.md` in the same change.
- Per house rules: no per-skin file edits, mobile-first, CLS 0 and accessibility unchanged on `/t/<slug>`, `bun test` and `npx tsgo --noEmit` clean before each slice closes.
- Before Gmail goes live: the privacy and consent disclosures get a new version through the existing versioned legal-document process.

## What I need from you

- One new secret, a 32-byte random key for encrypting stored email tokens — I can generate it.
- Confirmation that the Google OAuth client already configured here may add the Gmail read-only scope and the callback URL, when we reach Slice 3.

I'd start with Slice 1 and 2 and stop there for your review, since together they are the whole feature minus the inbox.
