import { describe, expect, it } from "bun:test";
import { isCreditsMessage, isRateLimitMessage } from "./ai-errors";

describe("isCreditsMessage", () => {
  it("matches every shape the gateway uses for the credits condition", () => {
    // The exact message from the 2026-07-11 prod debug report that retried
    // 4x and fell back to the local parser instead of surfacing billing.
    expect(isCreditsMessage("Payment Required")).toBe(true);
    expect(isCreditsMessage("payment required")).toBe(true);
    expect(isCreditsMessage("Request failed with status 402")).toBe(true);
    expect(isCreditsMessage("Insufficient credits for this request")).toBe(true);
  });

  it("does not match unrelated failures", () => {
    expect(isCreditsMessage("Too Many Requests")).toBe(false);
    expect(isCreditsMessage("fetch failed")).toBe(false);
    expect(isCreditsMessage("Request failed with status 500")).toBe(false);
    // \b402\b must not fire inside longer numbers
    expect(isCreditsMessage("order 14020 not found")).toBe(false);
  });
});

describe("isRateLimitMessage", () => {
  it("matches 429 shapes", () => {
    expect(isRateLimitMessage("Too Many Requests")).toBe(true);
    expect(isRateLimitMessage("429 rate limit exceeded")).toBe(true);
    expect(isRateLimitMessage("rate-limited, retry later")).toBe(true);
  });

  it("does not match credits or generic errors", () => {
    expect(isRateLimitMessage("Payment Required")).toBe(false);
    expect(isRateLimitMessage("status 5429x")).toBe(false);
  });
});
