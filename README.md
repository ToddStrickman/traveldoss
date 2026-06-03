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

### Unsplash

1. Create a developer app at [unsplash.com/developers](https://unsplash.com/developers)
2. Copy the **Access Key** — paste into the secret prompt.

## Secrets used

| Secret | Purpose |
|---|---|
| `UNSPLASH_ACCESS_KEY` | Hero images |
| `LOVABLE_API_KEY` | (auto-injected) AI Gateway calls |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc. | (auto-injected) Database access |

All secrets are server-side only and read from `process.env` inside server functions.

## Output modes

Every trip can be consumed in three equivalent ways:

- **Live URL** — `/t/<slug>`, always current.
- **PDF export** — the print button uses `window.print()`, which preserves every `<a href>` as a clickable link in the saved PDF.
- **Offline** — once a trip URL has been opened online, the app shell and that dossier remain available with no connection.

## Hard constraints (built-in)

- No AI-generated images (Unsplash only for hero).
- Out of scope for v1: invites, sharing UI, edit history, payments.
