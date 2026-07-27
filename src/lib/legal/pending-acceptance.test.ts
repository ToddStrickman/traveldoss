import { beforeEach, describe, expect, it } from "bun:test";
import {
  clearPendingAcceptance,
  readPendingAcceptance,
  stashPendingAcceptance,
} from "./pending-acceptance";

// Minimal localStorage for the bun test environment (same approach as
// mint-pending.test.ts — attach, don't replace, the shared test window).
function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => void map.clear(),
  };
}
(globalThis as unknown as { localStorage: ReturnType<typeof makeStorage> }).localStorage ??=
  makeStorage();

beforeEach(() => {
  localStorage.clear();
  clearPendingAcceptance();
});

describe("pending terms acceptance stash", () => {
  it("round-trips version and timestamp", () => {
    stashPendingAcceptance("1.0");
    const pending = readPendingAcceptance();
    expect(pending?.version).toBe("1.0");
    expect(Number.isNaN(Date.parse(pending!.acceptedAt))).toBe(false);
  });

  it("returns null when nothing is stashed", () => {
    expect(readPendingAcceptance()).toBeNull();
  });

  it("rejects corrupted payloads instead of throwing", () => {
    localStorage.setItem("td.pending-terms-acceptance", "{not json");
    expect(readPendingAcceptance()).toBeNull();
    localStorage.setItem("td.pending-terms-acceptance", JSON.stringify({ version: 1 }));
    expect(readPendingAcceptance()).toBeNull();
  });

  it("clear removes the stash", () => {
    stashPendingAcceptance("1.0");
    clearPendingAcceptance();
    expect(readPendingAcceptance()).toBeNull();
  });
});
