import { describe, expect, it, vi } from "vitest";
import { dossierOfflineUrls, keepDossierOffline } from "../src/lib/pwa/offline";

describe("offline dossier warming", () => {
  it("warms only the three public views and strips private UI parameters", () => {
    expect(dossierOfflineUrls("https://example.com/t/capability?mode=edit&map=day-2#stop")).toEqual([
      "https://example.com/t/capability?view=vertical",
      "https://example.com/t/capability?view=horizontal",
      "https://example.com/t/capability?view=grid",
    ]);
  });

  it("reports partial failures without sending credentials", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
      new Response(null, { status: String(url).includes("horizontal") ? 503 : 200 }),
    );
    await expect(keepDossierOffline("https://example.com/t/demo", fetcher as typeof fetch))
      .resolves.toEqual({ saved: 2, failed: 1 });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.every(([, init]) => init?.credentials === "omit")).toBe(true);
  });
});