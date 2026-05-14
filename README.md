# Travel DOSS

> Your trip, prepared like a dossier.

Travel DOSS reads your Gmail booking confirmations and assembles a beautifully designed Google Doc itinerary — flights, hotels, day-by-day plans grounded in real local research — so you land in a new city with everything ready to go.

## Stack

- **TanStack Start** (React 19 + Vite, file-based routes, server functions)
- **Lovable Cloud** (Supabase: Postgres, Auth, Storage)
- **Lovable AI Gateway** → `google/gemini-3-flash-preview` for email parsing, destination research (web grounding), and smart-fill refinement
- **Google APIs**: Gmail (readonly), Drive (drive.file), Docs
- **Unsplash** for hero imagery
- **Cloudflare Workers** for deployment

## Required setup

### 1. Google Cloud OAuth (you must create this)

The Lovable Cloud "Sign in with Google" broker only requests basic profile scopes. To read Gmail and write Docs, this app uses a **custom OAuth 2.0 flow** with your own credentials.

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Enable these APIs (APIs & Services → Library):
   - **Gmail API**
   - **Google Drive API**
   - **Google Docs API**
3. Configure the OAuth consent screen (External, add yourself as a test user)
4. Create credentials → **OAuth Client ID** → **Web application**
5. Add Authorized redirect URI:
   - `https://<your-deployed-domain>/api/auth/google/callback`
   - For local dev, also add: `http://localhost:5173/api/auth/google/callback`
6. Copy the **Client ID** and **Client Secret** — paste into the secret prompt when Lovable asks.

Scopes requested by the app:
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/userinfo.email`

### 2. Unsplash

1. Create a developer app at [unsplash.com/developers](https://unsplash.com/developers)
2. Copy the **Access Key** — paste into the secret prompt.

### 3. Template Doc (auto-bootstrapped)

On first trip generation, the app programmatically creates a minimal stub template Doc in your Drive containing all `{{token}}` placeholders, and stores its ID in the `app_config` table.

**To get the bespoke editorial look you want, redesign that template manually in Google Docs after first run:**

1. Open `https://docs.google.com/document/d/<TEMPLATE_DOC_ID>/edit` (the ID is logged in the server console after first generation, or readable in the `app_config` table under key `template_doc_id`)
2. Lay out the cover, sections, typography, dividers, etc. — keep all `{{double_curly_brace_tokens}}` exactly as they are; the app uses `replaceAllText` to fill them.
3. Save. Future trip generations copy this template via the Drive API.

#### Token reference

| Section | Tokens |
|---|---|
| Hero | `{{destination_name}}`, `{{trip_dates}}`, `{{hero_image_url}}` |
| Flight out | `{{flight_out_airline}}`, `{{flight_out_number}}`, `{{flight_out_depart}}`, `{{flight_out_arrive}}`, `{{flight_out_conf}}` |
| Hotel | `{{hotel_name}}`, `{{hotel_address}}`, `{{hotel_checkin}}`, `{{hotel_checkout}}`, `{{hotel_conf}}`, `{{hotel_image_url}}` |
| Day N | `{{day_N_date}}`, `{{day_N_morning}}`, `{{day_N_afternoon}}`, `{{day_N_evening}}` |
| Flight back | `{{flight_back_airline}}`, `{{flight_back_number}}`, `{{flight_back_depart}}`, `{{flight_back_arrive}}`, `{{flight_back_conf}}` |
| Footer | `{{emergency_contacts}}`, `{{currency_note}}`, `{{local_phrases}}` |

## Secrets used

| Secret | Purpose |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth flow |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth flow |
| `UNSPLASH_ACCESS_KEY` | Hero images |
| `LOVABLE_API_KEY` | (auto-injected) Gemini calls via Lovable AI Gateway |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc. | (auto-injected) Database access |

All secrets are server-side only and read from `process.env` inside server functions.

## Architecture

```
src/
├── routes/
│   ├── __root.tsx              # shell, providers, header
│   ├── index.tsx                # sign-in landing
│   ├── trips.tsx                # trip list (auth-gated)
│   ├── trips.new.tsx            # new trip form
│   ├── trips.$tripId.tsx        # trip detail + embedded Doc + refine
│   └── api/
│       └── auth/
│           └── google/
│               ├── start.ts     # OAuth initiate
│               └── callback.ts  # OAuth callback, store tokens
├── lib/
│   ├── google.server.ts         # Google API helpers (token refresh, Gmail, Drive, Docs)
│   ├── gemini.server.ts         # Lovable AI Gateway helpers
│   ├── unsplash.server.ts       # Hero image lookup
│   ├── trips.functions.ts       # CRUD server functions
│   ├── ingest.functions.ts      # Gmail → Gemini extraction
│   ├── research.functions.ts    # Gemini destination research with grounding
│   ├── generate.functions.ts    # Template copy + replaceAllText
│   └── refine.functions.ts      # Smart-fill remaining tokens
└── components/                  # UI
```

## Hard constraints (built-in)

- No hand-written email parsing — Gemini extracts structured JSON from raw bodies.
- No web scraping — Gemini's web-search grounding handles destination research.
- Email contents are processed and discarded; never stored in the database.
- Only the four listed Google scopes are requested.
- No AI-generated images (Unsplash only for hero).
- No animations in the generated Doc; subtle micro-animations only on the web app loader.
- Out of scope for v1: invites, sharing UI, mobile-specific design, edit history, payments.
