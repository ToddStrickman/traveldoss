import { describe, expect, test } from "bun:test";
import { GmailAdapter, decodeMessage, scanQuery } from "../src/lib/adaptive/gmail.server";
import { encrypt, decrypt } from "../src/lib/adaptive/crypto.server";
import type { EmailSyncState } from "../src/lib/adaptive/types";
import { ConservativeTravelExtractor } from "../src/lib/adaptive/extract";

const token = {
  access_token: "test-access",
  refresh_token: "test-refresh",
  expires_at: Date.now() + 3600_000,
};
function sync(patch: Partial<EmailSyncState> = {}): EmailSyncState {
  return {
    scope: "90",
    connectedAt: "2030-06-01T10:00:00Z",
    scanning: false,
    processed: 0,
    historyId: "100",
    ...patch,
  };
}
async function fakeFetch(responses: unknown[], callback: (calls: string[]) => Promise<void>) {
  const prior = globalThis.fetch,
    calls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    const next = responses.shift();
    return next instanceof Response ? next : Response.json(next);
  }) as typeof fetch;
  try {
    await callback(calls);
  } finally {
    globalThis.fetch = prior;
  }
}
describe("Gmail boundaries", () => {
  test("scan scopes use fixed connection boundaries, not a moving relative window", () => {
    expect(scanQuery("all", sync().connectedAt)).not.toContain("after:");
    const timestamp = Math.floor(Date.parse(sync().connectedAt) / 1000);
    expect(scanQuery("new", sync().connectedAt)).toContain("after:" + timestamp);
    expect(scanQuery("30", sync().connectedAt)).toContain("after:" + (timestamp - 30 * 86400));
    expect(scanQuery("90", sync().connectedAt)).toContain("after:" + (timestamp - 90 * 86400));
  });
  test("historical pages retain the original history baseline", async () => {
    await fakeFetch(
      [{ messages: [{ id: "m1" }], nextPageToken: "page-two" }, { messages: [{ id: "m2" }] }],
      async (calls) => {
        const adapter = new GmailAdapter(token, async () => {});
        const first = await adapter.scan(
          sync({ scanning: true, historyId: undefined, baselineHistoryId: "100" }),
        );
        expect(first.next.scanning).toBe(true);
        expect(first.next.pageToken).toBe("page-two");
        expect(first.next.historyId).toBeUndefined();
        const last = await adapter.scan(first.next);
        expect(last.next.scanning).toBe(false);
        expect(last.next.historyId).toBe("100");
        expect(last.ids).toEqual(["m2"]);
        expect(calls[1]).toContain("pageToken=page-two");
      },
    );
  });
  test("incremental pagination does not advance the cursor until the last page", async () => {
    await fakeFetch(
      [
        {
          history: [{ messagesAdded: [{ message: { id: "m1" } }, { message: { id: "m1" } }] }],
          historyId: "300",
          nextPageToken: "next",
        },
        { history: [{ messagesAdded: [{ message: { id: "m2" } }] }], historyId: "400" },
      ],
      async (calls) => {
        const adapter = new GmailAdapter(token, async () => {});
        const first = await adapter.scan(sync());
        expect(first.ids).toEqual(["m1"]);
        expect(first.next.historyId).toBe("100");
        const last = await adapter.scan(first.next);
        expect(last.next.historyId).toBe("400");
        expect(calls[1]).toContain("startHistoryId=100");
        expect(calls[1]).toContain("pageToken=next");
      },
    );
  });
  test("expired history recovery preserves new-only consent", async () => {
    await fakeFetch(
      [
        new Response("", { status: 404 }),
        { emailAddress: "traveler@example.test", historyId: "500" },
        { messages: [] },
      ],
      async (calls) => {
        const adapter = new GmailAdapter(token, async () => {});
        const result = await adapter.scan(sync({ scope: "new" }));
        expect(result.next.historyId).toBe("500");
        expect(decodeURIComponent(calls[2])).toContain(
          "after:" + Math.floor(Date.parse(sync().connectedAt) / 1000),
        );
      },
    );
  });
  test("rate limit never returns a successful next cursor", async () => {
    await fakeFetch([new Response("", { status: 429 })], async () => {
      await expect(new GmailAdapter(token, async () => {}).scan(sync())).rejects.toThrow(
        "rate limit",
      );
    });
  });
  test("MIME decoding minimizes evidence and rejects spoofed lower Authentication-Results", () => {
    const data = btoa("Provider: Air France\nConfirmation: XYZ\nYour flight was cancelled.");
    const raw = {
      id: "m1",
      internalDate: String(Date.parse("2030-06-01T10:00:00Z")),
      payload: {
        headers: [
          { name: "From", value: "Travel <confirm@airfrance.com>" },
          { name: "Subject", value: "Cancellation confirmed" },
          {
            name: "Authentication-Results",
            value: "mx.google.com; dmarc=fail header.from=airfrance.com",
          },
          {
            name: "Authentication-Results",
            value: "mx.google.com; dmarc=pass header.from=airfrance.com",
          },
        ],
        mimeType: "text/plain",
        body: { data },
      },
    };
    expect(decodeMessage(raw, "account").authenticatedSender).toBe(false);
    raw.payload.headers[2].value = "mx.google.com; dmarc=pass header.from=airfrance.com";
    const message = decodeMessage(raw, "account");
    expect(message.authenticatedSender).toBe(true);
    expect(message.text).toContain("XYZ");
    expect(new ConservativeTravelExtractor().extract(message)[0].reservation.status).toBe(
      "cancelled",
    );
  });
  test("structured schema.org reservation extracts real provider and aware schedule", () => {
    const raw = {
      id: "m2",
      internalDate: String(Date.now()),
      payload: {
        headers: [
          { name: "From", value: "tickets@airfrance.com" },
          { name: "Subject", value: "Flight confirmation" },
          {
            name: "Authentication-Results",
            value: "mx.google.com; dmarc=pass header.from=airfrance.com",
          },
        ],
        mimeType: "text/html",
        body: {
          data: btoa(
            '<script type="application/ld+json">' +
              JSON.stringify({
                "@type": "FlightReservation",
                reservationNumber: "P123",
                underName: { name: "Alex" },
                reservationFor: {
                  "@type": "Flight",
                  airline: { name: "Air France" },
                  flightNumber: "AF7",
                  departureTime: "2030-06-18T08:00:00-04:00",
                  arrivalTime: "2030-06-18T21:00:00+02:00",
                  departureAirport: { iataCode: "JFK" },
                  arrivalAirport: { iataCode: "CDG", address: { addressLocality: "Paris" } },
                },
              }) +
              "</script>",
          ),
        },
      },
    };
    const entity = new ConservativeTravelExtractor().extract(decodeMessage(raw, "account"))[0];
    expect(entity.reservation.provider).toBe("Air France");
    expect(entity.reservation.startAt).toBe("2030-06-18T12:00:00.000Z");
    expect(entity.confidence).toBeGreaterThanOrEqual(0.95);
  });
  test("encrypted OAuth tokens are bound to the correct owner", async () => {
    const prior = process.env.ADAPTIVE_TOKEN_KEY;
    process.env.ADAPTIVE_TOKEN_KEY = btoa("0123456789abcdef0123456789abcdef");
    try {
      const cipher = await encrypt({ refresh_token: "a-secret" }, "owner-a");
      expect(cipher).not.toContain("a-secret");
      expect(await decrypt(cipher, "owner-a")).toEqual({ refresh_token: "a-secret" });
      await expect(decrypt(cipher, "owner-b")).rejects.toThrow();
    } finally {
      if (prior) process.env.ADAPTIVE_TOKEN_KEY = prior;
      else delete process.env.ADAPTIVE_TOKEN_KEY;
    }
  });
});
