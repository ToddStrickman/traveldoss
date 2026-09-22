# Trustworthy itinerary imports and invitation acceptance

**Status:** Implementation plan only. Preserve the completed collaboration, layouts, print/offline work, and the separate Adaptive Trip Dossier plan.

## Verified baseline

- The deployed member table is unique on `(trip_id, lower(email))`, while invitation creation and acceptance upsert on `(trip_id,email)`. Creation ignores the roster error; acceptance performs roster activation and invite consumption separately.
- The current database has 8 member rows, no invitations, no noncanonical or blank member emails, and no canonical-email collisions. The migration must still preflight and fail safely on other environments.
- The import prompt contains both additive reconstruction and reductive preservation rules. The parser can truncate, normalize/drop entries, filter failed conversions, fall back twice, and report ordinary success without proving completeness.
- Later refine/harden passes serialize only selected fields and replace the whole block array. Shared itinerary projection retains only one outbound and one inbound flight.
- `parse-markdown.ts`, block source provenance, and the earlier lossless Markdown implementation are absent from this tree. Commit `644f41e` is not locally available, so equivalent behavior must be implemented from the reviewed requirements unless that exact source is supplied separately.
- Current focused deterministic parser/carry-over/token tests pass, but several tests explicitly preserve known lossy quirks; they are not evidence of trustworthy importing.

## Work package 1 — Define the import contract and preserve evidence

- Add a shared, versioned Zod schema for every supported block kind and import metadata. Use it at AI output, deterministic parser output, create, autosave, refine/harden patch, reload, and restore boundaries; remove `z.any()` from itinerary write inputs.
- Give blocks stable IDs. Backfill existing blocks without changing their display order or content.
- Add private, owner-scoped import records for raw source, source type, parser/schema version, input hash, state, and retention timestamps. Store the source coverage ledger privately with stable segment IDs, exact spans/order, mapped block IDs, and unresolved status.
- Keep raw source and private provenance out of public/unlisted dossier responses, public loaders, print/PDF, offline caches, analytics, console logs, and ordinary debug reports. Define owner deletion and trip-cascade behavior.
- Treat imported text as untrusted data. Preserve meaningful text, table cells, lists, URLs, costs, currencies, reservations, alternatives, narrative, and every transport leg. Sanitize rendered text/URLs; never render source HTML.
- Define acceptance separately for: source preserved, structure correct, save committed, reload equivalent, and all screen/export projections faithful. Block count and model confidence are not coverage proof.

## Work package 2 — Build a deterministic, source-first parser

- Add a deterministic parser for recognizable CommonMark/GFM structures and a separate tested segmenter for plain text/transcripts. Do not broaden supported uploads beyond the current text formats.
- Segment first, preserving source order and exact spans. Parse explicit day headings, dates, tables, lists, prose, alternatives, costs, URLs, hotels, and flights without deleting residual content.
- Use AI only to interpret ambiguous segments and propose typed mappings. It must not invent bookings, venues, dates, costs, transport, times, or reorder the supplied plan.
- Keep uncertain or unsupported source visible as narrative/residual blocks with a focused review issue. Never silently `filter(Boolean)` or drop unknown objects.
- Distinguish day number, stated calendar date, local time, timezone, and overnight arrival. Preserve incomplete/conflicting dates as supplied and request correction; never invent a year or midnight.
- Repeated venues on different days remain separate occurrences. Merge chunks by source identity and ordinal, never normalized venue name.
- Remove the documented legacy-parser quirks as accepted behavior: the first stop cannot become only a day label, “dinner” cannot match “inn,” and unspecific stops cannot disappear.

## Work package 3 — Replace whole-document generation with bounded Responses parsing

- First run a minimal server-side capability probe against the documented Lovable AI Gateway Responses endpoint using `openai/gpt-6-astra`. Verify the exact auth header, streaming events, required reasoning settings, strict structured output, stateless `store:false`, encrypted reasoning round-trip where applicable, run-ID capture, and installed AI SDK compatibility. Record the contract before changing production parsing.
- Add the official Responses provider only after compatibility is proven. Build it inside each request and reuse a corrected shared gateway helper with `name: "lovable"`, `X-Lovable-AIG-SDK`, and run-ID propagation.
- Use `streamText` for parsing and optional note synthesis. Require a completed terminal response and strict, runtime-validated output. Do not expose reasoning or credentials to the browser.
- Replace the fixed 8,192-token whole-document strategy with preflight sizing and stable section/day chunks. Carry only bounded global context needed for destination/date continuity and lodging/overnight-flight links. Use bounded concurrency plus total time/request/cost budgets.
- Chunk recovery must reduce the unit of work. Never concatenate partial attempts or retry unchanged malformed/truncated output.
- Retry only `429` and transient `5xx`, honoring `Retry-After` with bounded exponential backoff and jitter. Treat `400/401/402/403/404`, provider refusals, schema failures, and deterministic truncation as terminal according to gateway semantics.
- Remove raw model/source snippets and field values from routine logs. Record only stage, parser/model/schema version, input/output sizes, duration, retry count, terminal state, incomplete reason, coverage counts, and gateway run ID.
- Editorial notes are optional, additive, field-scoped, and reversible. They never replace source notes and their failure never blocks a valid import.

## Work package 4 — Prevent downstream loss and false success

- Replace automatic whole-trip refine/harden rewrites with typed, field-scoped patches carrying block ID, expected revision, changed fields, provenance, and confidence. Reject stale patches and never overwrite source-authored or newer manually edited fields.
- Keep geocoding, link-title lookup, and note synthesis bounded and optional. Restrict URL fetching to safe public HTTP(S) destinations; block loopback, link-local, private-network, metadata, and redirect escapes.
- Align limits across parse, create, autosave, refine/harden, request bodies, and persistence. Publish concrete supported character/day/block limits and preserve the draft with an actionable message above them.
- Return explicit import states: `reading`, `structuring`, `validating`, `ready`, `needs_review`, `failed`, `cancelled`. A local deterministic result may be `ready`; incomplete coverage must be `needs_review`, never ordinary success.
- Preserve input across error, cancellation, retry, double-submit, and late responses. Use an import idempotency key and compare-and-swap/revision check so no duplicate dossier or stale overwrite is possible. Keep the last good saved version.
- Update shared itinerary projection from one outbound/inbound slot to an ordered flight-leg collection with day/appendix placement. Verify every leg in Vertical, Horizontal, Grid, A5 print/PDF, reload, and offline reading while keeping old trips compatible.
- Add privacy-safe import failure/completion telemetry through the existing analytics modules and tracking plan. Capture counts, sizes, states, and timings only—never itinerary content, URLs, names, emails, or raw model output.

## Work package 5 — Make invitations canonical and transactional

- Add one forward migration; do not edit deployed migrations. Before constraint changes, lock the affected writes and preflight `lower(trim(email))` collisions, blanks/invalid values, conflicting users, owner rows, active/removed members, and pending invites. Abort with a diagnostic rather than silently merging different accounts.
- Canonicalize email at the database boundary and application boundary. Safely backfill member/invite emails, add nonblank canonical checks, replace the expression index with a real nondeferrable `UNIQUE (trip_id,email)` constraint, add a partial unique index allowing only one live invite per trip/address, and verify API schema-cache compatibility.
- Implement invitation creation as one authenticated transactional database function: authorize the trip owner, protect owner/active memberships, create or refresh only the intended pending editor row, invalidate older pending tokens for that address, and insert the new hashed invite. Return a committed invitation identity. Send email only after commit and report delivery separately.
- Implement acceptance as one authenticated transactional database function: derive user ID and verified email from trusted auth context, hash/locate and lock the invite, recheck trip, email, expiry, revocation, and current membership, activate the intended row, consume the invite, and return the destination together. Roll back all state on any failure.
- Make repeat acceptance idempotent only for the same recipient while membership remains active. It must not resurrect a removed member. Coordinate accept/accept, accept/revoke, and accept/remove races.
- Reinviting must never demote an owner, downgrade an active member, replace a bound account, or reset `joined_at`. A removed member requires a fresh owner-authorized invite. Multiple-recipient requests return per-address committed and delivery outcomes.
- Restrict `SECURITY DEFINER` search paths and EXECUTE grants; authorize inside each function and test using ordinary authenticated roles. Keep tokens hashed, single-use, address-bound, expiring, and absent from logs.
- Update the client/server invitation flow to call the transactional functions, remove incompatible upserts, fail visibly on database errors, and preserve safe login return navigation, view-only links, owner-only controls, and locked/expired rules.

## Work package 6 — Verification, evidence, and staged release

### Import matrix

- Authored goldens: short/long Markdown, plain text, transcripts; 1/9/14/30-day plans; supported boundary sizes; tables, URLs, currencies, long notes, alternatives, Unicode, repeated places, contradictory/missing dates, missing years, timezone/DST, midnight and overnight/multi-leg flights.
- Use a redacted/access-controlled 9-day Rome/Sicily repro and the earlier Italy fixture only if legitimately available. Never commit private user itineraries.
- Assert exact source facts, order/day/date assignment, zero silent loss, zero invented logistics, full coverage ledger, stable IDs, typed persistence, save/reload equivalence, and every flight in all views/print/offline.
- Transport/fault tests: fragmented streams, incomplete/failed/error/refusal/disconnect/empty output, cancellation, malformed schema, `400/401/402/403/404/429/5xx`, retry budgets, chunk omission/duplication, enrichment unavailable, save failure, concurrent edits, and double-submit. A true >8,192-output-token fixture is required; an 8,192-character fixture is insufficient.

### Invitation matrix

- Apply old plus new migrations to a disposable real database and exercise functions through normal authenticated application/API calls, not regex or service-role-only mocks.
- Cover canonical mixed-case/whitespace email, collisions, first invite, resend, delivery failure, active/owner protection, removed-member reinvite, wrong account, invalid/expired/revoked/replayed token, idempotent repeat, concurrent accept/accept and accept/revoke/remove, forced mid-transition failure, cross-trip access, and RLS denial.
- Browser flow: signed out/login return, mismatched account/switch, join, repeat click/reload, member edit, owner attribution/history, view-only sharing, and denied owner-only actions.

### Required checks and evidence

- Run focused unit/integration suites, `bun test src tests`, applicable Vitest suites, `bunx tsgo --noEmit`, the project build, and relevant browser tests. Record pre-existing failures and skips without weakening tests.
- Run one authenticated test-environment request through the real server implementation and gateway, then save/reload and inspect all three layouts on mobile/desktop plus print/PDF/offline. Record redacted fixture assertions, terminal state, timings, run ID, exact code SHA, migration version, and environment. One live request is smoke evidence, not the correctness proof.
- Maintain separate invite and import release gates. Stage the backward-compatible database migration before application code; verify generated types and deployed artifacts. Define rollback/kill switches that preserve raw source, drafts, existing memberships, and last good saves.
- Resolve each monitoring finding only after its own automated regression and relevant deployed/browser verification pass. If authenticated browser accounts or deployment access are unavailable, mark that gate **NOT VERIFIED** and leave the finding open.

## Primary references

- https://developers.openai.com/api/docs/guides/streaming-responses
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/models/gpt-6-astra
- https://www.postgresql.org/docs/current/sql-insert.html
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/reference/javascript/upsert
