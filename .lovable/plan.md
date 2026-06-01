## Goal

Replace the default `*.lovable.app` preview URL with `traveldoss.com` so shareable trip URLs read like `traveldoss.com/t/your-trip-slug`.

## Note on hosting

Your project is hosted on **Lovable Cloud** (not Vercel). Custom domains are attached through Lovable's publish settings — no DNS changes inside the app code are required, and nothing in the codebase needs to change for the domain itself to work.

## Steps

1. **Purchase `traveldoss.com`**
   - Register the domain with any registrar (Namecheap, Cloudflare Registrar, Google Domains/Squarespace, Porkbun, etc.). Cloudflare Registrar is typically cheapest with no markup.
   - You do this outside Lovable; I can't purchase domains on your behalf.

2. **Publish the project**
   - Publish TravelDoss so it gets a live `*.lovable.app` URL. A custom domain can only be attached to a published project.
   - Visibility: public (so shared trip links work for anyone with the URL).

3. **Connect the custom domain in Lovable**
   - In the project: **Share → Publish → Settings → Domains → Connect domain**, enter `traveldoss.com` (and `www.traveldoss.com`).
   - Lovable shows the DNS records to add.

4. **Add DNS records at your registrar**
   - Typically an A/ALIAS record on the apex (`traveldoss.com`) and a CNAME on `www`, plus a verification TXT record. Lovable provides the exact values.
   - Propagation: usually minutes, up to 24–48h. SSL certificate is auto-issued.

5. **Verify**
   - Confirm `https://traveldoss.com` loads the app and that a trip URL like `https://traveldoss.com/t/<slug>` resolves correctly.
   - Optional: redirect `www` → apex (or vice versa) — configurable in Lovable's domain settings.

## What I'll do vs. what you'll do

- **You**: purchase the domain, add the DNS records the Lovable UI shows you.
- **Me (after you approve and switch to build mode)**: publish the project and walk you through the Connect-domain dialog. I can't add DNS records at your registrar for you.

## Out of scope

- No code changes are needed. App routes (`/t/$slug`, etc.) will work identically under the new domain.
- Email-sending domain (for transactional/auth emails from `@traveldoss.com`) is a separate setup — happy to do that next if you want.
