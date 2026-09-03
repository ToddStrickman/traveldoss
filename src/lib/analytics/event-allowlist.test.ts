import { describe, expect, it } from "bun:test";
import { FIRST_PARTY_EVENTS, isAllowedEvent } from "./event-allowlist";

describe("first-party event allowlist", () => {
  it("accepts every declared event", () => {
    for (const e of FIRST_PARTY_EVENTS) expect(isAllowedEvent(e)).toBe(true);
  });

  it("rejects unknown names, so a public endpoint cannot be filled with junk", () => {
    expect(isAllowedEvent("drop table")).toBe(false);
    expect(isAllowedEvent("")).toBe(false);
    expect(isAllowedEvent("mint_completed_")).toBe(false);
  });

  it("covers the mint funnel the admin console charts", () => {
    for (const e of [
      "page_viewed",
      "compose_opened",
      "mint_input_ready",
      "mint_submitted",
      "mint_completed",
    ]) {
      expect(isAllowedEvent(e)).toBe(true);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(FIRST_PARTY_EVENTS).size).toBe(FIRST_PARTY_EVENTS.length);
  });
});
