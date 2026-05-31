## What’s most likely happening

The app is no longer failing on the template server function: that request returns `needsGoogle: true` with `/api/public/google/start`. The recurring 403 is happening after the browser leaves TravelDoss and enters Google’s OAuth flow.

Two problems remain likely:

1. The current `/api/public/google/start` flow computes the callback from the current preview origin, so the exact callback may differ from the URL you added.
2. The flow uses a browser “bouncer” to pull the app session from local storage, which is fragile in preview/OAuth handoffs.

Do I know what the issue is? Yes: the app’s Google connection flow is too dependent on preview-domain routing and should be converted to a server-generated OAuth URL tied to the authenticated TravelDoss user.

## Plan

1. **Replace the bouncer-based Google start flow**
   - Add a protected server function that generates the Google OAuth URL after verifying the logged-in TravelDoss user.
   - Encode the user id, return path, expiry, and callback origin into a signed OAuth `state` value.
   - Do not pass the app session token through query params.

2. **Update the Google callback handler**
   - Verify the signed `state` instead of relying on preview-domain cookies.
   - Exchange the Google code server-side only.
   - Save/refresh Google tokens server-side only.
   - Redirect the user back to `/app?drive=connected` or `/app?drive=error&msg=...`.

3. **Wire both entry points to the new flow**
   - “Use This Template” should return a direct Google authorization URL when Drive is not connected.
   - “Connect Google Drive” in `/app` should request the same server-generated auth URL.
   - Keep `/api/public/google/callback` as the callback URL because it bypasses preview protection.

4. **Keep a compatibility route**
   - Leave `/api/public/google/start` available, but make it redirect through the safer server-side flow or show a clear error rather than using localStorage token extraction.
   - Remove duplicated legacy callback logic from `/api/google/callback` or route it through the shared callback helper to prevent inconsistent behavior.

5. **Add exact diagnostic feedback**
   - If Google still rejects the OAuth attempt, the app will expose the exact callback URI it is using so you can verify it in Google Cloud.
   - Expected current callback will be:
     ```text
     https://id-preview--096f9178-141f-473d-bf14-38fc2445783f.lovable.app/api/public/google/callback
     ```
   - If you later publish, the published callback should also be added:
     ```text
     https://project--096f9178-141f-473d-bf14-38fc2445783f.lovable.app/api/public/google/callback
     ```

## What you may still need to check in Google Cloud

Even after the code is made more robust, Google can still show this exact generic 403 if:

- OAuth consent screen is in **Testing** and your Google account is not listed as a test user.
- Google Docs API or Google Drive API is not enabled on the same Google Cloud project as the OAuth client.
- The OAuth app is requesting Docs/Drive scopes but the app is restricted by Google Workspace/admin policy or unverified-app policy.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
  <presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>