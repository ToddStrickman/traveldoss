
# TravelDoss — Revised Plan (Design-Skin Templates + Paywall)

## What changes vs. the prior build

The templates page is no longer a gallery of *trip types* (weekend break, road trip, honeymoon). It is a gallery of **named visual designs** — each one a distinct editorial skin for the HTML dossier. Picking a skin is a paid action ($1) that mints a time-boxed trip website.

Content (where you're going, what you booked, day-by-day) is filled **after** the skin is chosen, via three input paths inside the dossier editor: manual editing, Gmail import, or AI paste-in (paste output from ChatGPT/Claude/Gemini and we parse it into the skin's block structure).

---

## 1. The Skin Gallery (Epic B, rewritten)

**Route:** `/templates` (existing, redesigned)

A grid of 6–8 named design skins. Each tile shows:
- **Codename** above the preview — proper-noun, fun, premium (Epictetus, Shishu, Marcello, Calliope, Vesper, Halcyon, Orsino, Marguerite).
- **Personality hook** under the name — a short, provocative line describing the *person* this skin is built for, not the design vocabulary. Fun, cheeky, premium. Examples:
  - "Straight chilling on the beach"
  - "Life is close to death adventure"
  - "Eats at the place locals won't tell tourists about"
  - "Has opinions about hotel lobbies"
  - "Books the red-eye on purpose"
  - "Brought one carry-on for three weeks"
- **Live preview** rendered with the same demo-content fixture across all skins, so the user is comparing chrome, not content.
- **CTA**: "Use this skin — $1".

Clicking CTA → Stripe Checkout (one-time $1) → on success, mint a trip with this `template_id` and redirect to the editor at `/t/{slug}/edit`.

The 6–8 skins live as a typed registry in code (`src/lib/skins/registry.ts`) — each skin is a self-contained module exporting:
- `id`, `codename`, `personality` (the hook line)
- Token overrides (palette, typography pair, ornamentation, hero treatment)
- A `render(blocks)` component that knows how to lay out the dossier blocks in its style
- A `previewFixture` of demo blocks for the gallery tile

This separation means content (`trip.content.blocks`) is decoupled from presentation — the same blocks render through any skin's `render()`.

---

## 2. Monetization & Lifecycle

**Per-trip purchase:** $1 unlocks a `(trip, skin)` pair. Stored as an entitlement row.

**Re-skinning:** Changing skin on an existing trip costs another $1. The new entitlement supersedes the old.

**Time-box:** Trip's public URL is live until `expires_at = min(end_date + 1 day, created_at + 30 days)`. After expiry, `/t/{slug}` returns a graceful "This dossier has expired" page; the owner can re-purchase to extend.

**Provider:** Stripe seamless payments (one-time $1 charges, no subscriptions). Requires payment provider eligibility check first.

---

## 3. Editor & Content Population (post-purchase)

**Route:** `/t/{slug}/edit` (owner-only)

The editor renders the dossier in the chosen skin, with three content-input paths surfaced as a top toolbar:

1. **Manual** — inline-edit blocks (title, subtitle, day cards, places, notes).
2. **Gmail import** — existing flow; scan inbox, extract flight/hotel confirmations, append as blocks.
3. **AI paste-in** — modal with a large textarea. User pastes raw output from any LLM. We send it to Lovable AI Gateway (Gemini 2.5 Flash) with a structured prompt that converts free text → our block schema, then merges into `trip.content.blocks`.

The public view at `/t/{slug}` stays read-only and uses the same skin renderer.

---

## 4. Database changes

Single migration:

- `trips`: add `expires_at TIMESTAMPTZ`, `original_template_id TEXT` (audit trail).
- `trip_entitlements` (new): `trip_id`, `user_id`, `template_id`, `stripe_session_id`, `amount_cents`, `purchased_at`. RLS: owner-read, service-role-write. The `/t/{slug}` view checks for an active entitlement matching `trip.template_id`.
- Public `/t/{slug}` access gated on `expires_at IS NULL OR expires_at > now()`.

Skin definitions are **not** in the DB — they live in code so design polish ships atomically.

---

## 5. The 8 skins (v1 shortlist) — codename + personality hook

| Codename | Personality hook |
|---|---|
| **Epictetus** | "Reads philosophy on the train" |
| **Shishu** | "Plans the trip in a single Notes file" |
| **Marcello** | "Eats dinner at 10pm, never before" |
| **Calliope** | "Honeymoon, anniversary, just because" |
| **Vesper** | "Books the red-eye on purpose" |
| **Halcyon** | "Straight chilling on the beach" |
| **Orsino** | "Life is close to death adventure" |
| **Marguerite** | "Brings a journal and a film camera" |

Final hooks subject to copy pass — the slots and vibes are the commitment.

---

## 6. Routes affected

- `/templates` — rebuilt as skin gallery
- `/t/{slug}` — public dossier, expiry-aware
- `/t/{slug}/edit` — new owner editor with 3 input paths
- `/api/public/stripe/webhook` — entitlement provisioning
- `/api/checkout/skin` (serverFn) — create Stripe session for `(trip_draft, template_id)`

---

## Technical details

- **Skin registry**: `src/lib/skins/` — one folder per skin (`epictetus/`, `shishu/`, ...) each exporting `{ meta, tokens, Render, previewFixture }`. Central `registry.ts` re-exports an array. `meta` includes `codename` and `personality`.
- **Block schema**: extend `trip.content.blocks` to a typed discriminated union: `hero | meta | section | day | place | gallery | quote | note`. Every skin's `Render` handles all block types.
- **AI paste-in**: serverFn `parseFreeformItinerary({ text, currentBlocks })` → calls `google/gemini-2.5-flash` with a JSON-schema-constrained prompt, returns merged `blocks`.
- **Payments**: run `recommend_payment_provider` → expect Stripe. Use `enable_stripe_payments`. One product (`Skin Unlock`), $1, one-time. Checkout session metadata carries `trip_id` + `template_id`; webhook writes `trip_entitlements`.
- **Expiry**: compute `expires_at` at trip creation. Public route loader checks expiry; expired → render expired-state component with a "Re-publish ($1)" CTA.
- **Demo fixture**: a single `demoTrip` (e.g. "3 days in Lisbon") used across every gallery tile so users compare design, not content.

---

## What we keep

- `trips` table with `slug`, `visibility`, `content` JSONB
- `/t/{slug}` public route shell (rebuilt to use skin renderer)
- Gmail OAuth + scan flow (Epic C, unchanged)
- Auth, profiles, places infrastructure
- Editorial design language already in `styles.css`

## What we remove

- The current `/templates` content (trip-archetype framing)
- The single hard-coded dossier layout in `t.$slug.tsx` — replaced by per-skin renderers

---

## Build order

1. Migration: `expires_at` on trips + `trip_entitlements` table
2. Skin registry scaffold + 2 reference skins (Epictetus, Orsino) to prove the pattern
3. Rebuild `/templates` as skin gallery with codenames + personality hooks + demo fixture
4. Enable Stripe payments + checkout serverFn + webhook
5. Rebuild `/t/{slug}` public view to use skin renderer + expiry handling
6. `/t/{slug}/edit` owner editor with manual + Gmail + AI paste-in
7. Remaining 6 skins

Confirm and I'll start at step 1.
