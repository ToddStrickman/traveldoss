# Travel DOSS — Build Plan

## ⚠️ Critical: Google OAuth with Gmail/Drive/Docs scopes

The Lovable Cloud "Sign in with Google" broker only requests basic profile/email scopes. It **cannot** request `gmail.readonly`, `drive.file`, or `docs` scopes. To access the user's Gmail and create Docs in their Drive, we need a **custom OAuth flow** (not the broker).

This means **you** must:
1. Create an OAuth 2.0 Client ID in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Enable Gmail API, Drive API, Docs API
3. Add authorized redirect URI: `https://<your-app-domain>/api/auth/google/callback`
4. Provide me `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` as secrets

I'll build a custom OAuth handler that:
- Initiates auth with all 4 scopes (gmail.readonly, drive.file, documents, userinfo.email)
- Stores the user's Google access + refresh token in a `google_tokens` table (encrypted-at-rest by Supabase)
- Refreshes tokens on demand server-side

(Supabase Auth still handles the user identity layer — but the Google API tokens come from our custom flow, not from Supabase's OAuth provider.)

## Naming
Going with the dossier riff: tagline "Your trip, prepared like a dossier." No acronym lock-in, leans into the editorial/intelligence-folder feel that matches the design.

## Stack mapping (from your spec → this stack)

| Spec | This build |
|---|---|
| Next.js App Router | TanStack Start (file-based routes) |
| `/api/*` route handlers | TanStack server routes under `src/routes/api/` |
| Server actions | `createServerFn` |
| Vercel | Cloudflare Workers (Lovable's deploy target) |
| Supabase | Lovable Cloud (= Supabase) |
| Gemini direct API | Lovable AI Gateway → `google/gemini-3-flash-preview` |
| Tailwind | Tailwind v4 (already configured) |

## Build order (incremental, per your "confirm before polish" instruction)

### Phase 1 — Foundation (this turn)
1. Enable Lovable Cloud (Supabase)
2. DB migration: `trips` table per your schema + `google_tokens` table (user_id, access_token, refresh_token, expires_at, scope)
3. Design system in `src/styles.css`: warm off-white bg, deep navy text, burnt orange accent, Inter + Fraunces fonts
4. README scaffold (env vars, Google Cloud setup, redesign-template instructions)
5. Request secrets: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `UNSPLASH_ACCESS_KEY`, `TEMPLATE_DOC_ID` (will be empty until first run creates one)

### Phase 2 — Auth
6. Custom Google OAuth: `/api/auth/google/start` and `/api/auth/google/callback` server routes
7. Token-refresh helper (`google.server.ts`)
8. Sign-in page + auth gate

### Phase 3 — Trip CRUD + UI shell
9. Routes: `/` (sign-in), `/trips` (list), `/trips/new` (form), `/trips/$id` (detail with embedded Doc)
10. Editorial UI: Fraunces titles, single hero CTA per screen, animated 4-step loader

### Phase 4 — Pipeline server functions
11. `ingestBookings` — Gmail search + Gemini structured extraction (no hand parser, emails discarded after extraction)
12. `researchDestination` — Gemini with web grounding, structured day-by-day output
13. `generateDoc` — On first call: stub template Doc programmatically, save ID. Then: copy template via Drive, batchUpdate replaceAllText, fetch Unsplash hero, save trip.doc_id/doc_url
14. `refineDoc` — Scan doc for unfilled `{{...}}` tokens, Gemini smart-fill each, fallback to "Open block. Wander, recover…"

### Phase 5 — Polish
15. Drive embed preview (`https://docs.google.com/document/d/{id}/preview`)
16. Loading state with the 4 step messages
17. Error handling (token expiry → re-auth, Gemini 429/402)

## Out of scope (per your hard constraints)
No invites, no sharing UI, no mobile-specific design, no edit history, no payments, no AI-generated images, no hand-written email parser, no animations in the Doc.

## Technical notes section

- **Why custom OAuth instead of Supabase Google provider:** Supabase's Google provider can request additional scopes via `options.scopes`, but the access token it returns to the client is short-lived and not refreshable through Supabase. For a long-lived background-capable Gmail/Drive/Docs integration we need the refresh token, which means owning the OAuth flow.
- **Token storage:** `google_tokens` table with RLS so each user only sees their own. Service role key used server-side to read tokens for API calls.
- **Gemini grounding:** Lovable AI Gateway's Gemini 3 Flash supports Google Search grounding via tool config — I'll wire that for the research step.
- **Template Doc bootstrap:** First time `generateDoc` runs, if `TEMPLATE_DOC_ID` is empty, create a minimal template programmatically with all the `{{token}}` placeholders, save the ID to the `trips`-related config (or instruct user to add to env). README explains how to redesign it in Google Docs.
- **Doc embed:** `https://docs.google.com/document/d/{DOC_ID}/preview` in an iframe.

## What I need from you to start Phase 2
Once Phase 1 is done I'll request the 3 secrets. You'll need to:
1. Create the OAuth client in Google Cloud Console with the redirect URI I'll give you
2. Get an Unsplash access key from https://unsplash.com/developers
3. Paste them into the secret prompt

Ready to start with Phase 1?
