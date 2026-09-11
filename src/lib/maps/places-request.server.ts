/**
 * Single server-side door to Google Places Text Search.
 *
 * Why this exists: `GOOGLE_MAPS_API_KEY` in this project is NOT a Google API
 * key — it is the Lovable connector connection key for the managed Google Maps
 * Platform connection. Sending it straight to `places.googleapis.com` as
 * `X-Goog-Api-Key` is rejected by Google, and every caller here turned that
 * rejection into a silent "no result". So all Places traffic goes through the
 * Lovable connector gateway, which injects the real Google key.
 *
 * Callers keep their own field masks, bodies, timeouts and error handling; this
 * module only owns the URL and the authorization/connection headers. Nothing
 * here logs, returns or embeds a secret value.
 */

/** Gateway endpoint for Places API (New) Text Search. */
export const PLACES_SEARCH_TEXT_URL =
  "https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText";

/**
 * Build the outgoing headers for a gateway Places call.
 *
 * Caller headers (`Content-Type`, `X-Goog-FieldMask`, …) are preserved; the
 * legacy direct-to-Google `X-Goog-Api-Key` header is dropped because the
 * gateway supplies Google's key itself.
 */
export function buildPlacesHeaders(
  apiKey: string,
  lovableApiKey: string,
  init?: HeadersInit,
): Headers {
  const headers = new Headers(init);
  headers.delete("X-Goog-Api-Key");
  headers.set("Authorization", `Bearer ${lovableApiKey}`);
  headers.set("X-Connection-Api-Key", apiKey);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return headers;
}

/**
 * POST a Places Text Search request through the connector gateway.
 *
 * `apiKey` is the connector connection key (`GOOGLE_MAPS_API_KEY`). Throws when
 * `LOVABLE_API_KEY` is absent, so a misconfigured runtime is distinguishable
 * from a genuine zero-result answer instead of being cached as a miss.
 */
export async function placesRequest(apiKey: string, init: RequestInit): Promise<Response> {
  const lovableApiKey = process.env.LOVABLE_API_KEY;
  if (!lovableApiKey) {
    throw new Error(
      "Google Maps lookups are not configured on the server (missing Lovable gateway credentials).",
    );
  }
  return fetch(PLACES_SEARCH_TEXT_URL, {
    ...init,
    method: init.method ?? "POST",
    headers: buildPlacesHeaders(apiKey, lovableApiKey, init.headers),
  });
}
