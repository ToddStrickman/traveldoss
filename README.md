# Travel DOSS

> Your trip, prepared like a dossier.

Travel DOSS turns a pasted itinerary into a beautifully designed dossier — flights, hotels, day-by-day plans pinned on a live map — viewable at a live URL, exportable as a PDF (with clickable links), and usable fully offline once opened.

## Stack

- **TanStack Start** (React 19 + Vite, file-based routes, server functions)
- **Lovable Cloud** (Supabase: Postgres, Auth, Storage)
- **Lovable AI Gateway** for refining pasted itineraries
- **Unsplash** for hero imagery
- **Cloudflare Workers** for deployment
- **vite-plugin-pwa** for installable / offline-first behaviour

## Required setup

Copy [`.env.example`](.env.example) to `.env` and fill in the values. That file
is the complete, maintained list of every key the app reads, grouped by
purpose, with a note on which are injected by Lovable in production.

Keys prefixed `VITE_` ship to the browser and are public by design. Every
other key is server-only and read from `process.env` inside server functions.

The database schema, storage bucket, and scheduled jobs are all declared in
`supabase/migrations/`; a fresh Supabase project needs nothing created by
hand.

## Output modes

Every trip can be consumed in three equivalent ways:

- **Live URL** — `/t/<slug>`, always current.
- **PDF export** — the print button uses `window.print()`, which preserves every `<a href>` as a clickable link in the saved PDF.
- **Offline** — once a trip URL has been opened online, the app shell and that dossier remain available with no connection.

## Hard constraints (built-in)

- No AI-generated images (Unsplash only for hero).
- Out of scope for v1: invites, sharing UI, edit history, payments.
