/**
 * The Places helper must talk to the Lovable connector gateway, not Google
 * directly: `GOOGLE_MAPS_API_KEY` is a connector connection key, and Google
 * rejects it. These tests pin the URL and the header contract.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const realFetch = globalThis.fetch;
import {
  PLACES_SEARCH_TEXT_URL,
  buildPlacesHeaders,
  placesRequest,
} from "@/lib/maps/places-request.server";

describe("buildPlacesHeaders", () => {
  it("sets gateway authorization and the connection key", () => {
    const h = buildPlacesHeaders("conn-key", "lovable-key");
    expect(h.get("Authorization")).toBe("Bearer lovable-key");
    expect(h.get("X-Connection-Api-Key")).toBe("conn-key");
    expect(h.get("Content-Type")).toBe("application/json");
  });

  it("keeps the caller's field mask and drops the direct-to-Google key header", () => {
    const h = buildPlacesHeaders("conn-key", "lovable-key", {
      "X-Goog-FieldMask": "places.id,places.location",
      "X-Goog-Api-Key": "should-not-survive",
    });
    expect(h.get("X-Goog-FieldMask")).toBe("places.id,places.location");
    expect(h.has("X-Goog-Api-Key")).toBe(false);
  });
});

describe("placesRequest", () => {
  const original = process.env.LOVABLE_API_KEY;
  beforeEach(() => {
    process.env.LOVABLE_API_KEY = "lovable-key";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.LOVABLE_API_KEY;
    else process.env.LOVABLE_API_KEY = original;
    globalThis.fetch = realFetch;
  });

  it("posts to the gateway text-search endpoint with both credentials", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await placesRequest("conn-key", {
      method: "POST",
      headers: { "X-Goog-FieldMask": "places.id" },
      body: JSON.stringify({ textQuery: "Pantheon, Rome, Italy", pageSize: 1 }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(PLACES_SEARCH_TEXT_URL);
    expect(url).not.toContain("places.googleapis.com");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer lovable-key");
    expect(headers.get("X-Connection-Api-Key")).toBe("conn-key");
    expect(headers.get("X-Goog-FieldMask")).toBe("places.id");
  });

  it("throws instead of silently missing when gateway credentials are absent", async () => {
    delete process.env.LOVABLE_API_KEY;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(placesRequest("conn-key", { method: "POST" })).rejects.toThrow(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
