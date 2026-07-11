import { beforeEach, describe, expect, it } from "bun:test";

// Minimal localStorage for the bun test environment.
function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => void map.clear(),
  };
}
(globalThis as Record<string, unknown>).window = { localStorage: makeStorage() };

const { savePendingComposer, peekPendingComposer, clearPendingComposer } =
  await import("./mint-pending");

const DRAFT = {
  templateId: "marguerite",
  tab: "paste" as const,
  text: "Day 1 — Rome. Day 2 — Palermo.",
  genPrompt: "",
};

beforeEach(() => {
  clearPendingComposer();
});

describe("mint-pending", () => {
  it("round-trips a composer draft", () => {
    savePendingComposer(DRAFT);
    const got = peekPendingComposer();
    expect(got?.templateId).toBe("marguerite");
    expect(got?.tab).toBe("paste");
    expect(got?.text).toContain("Palermo");
  });

  it("peek does not consume; clear does", () => {
    savePendingComposer(DRAFT);
    expect(peekPendingComposer()).not.toBeNull();
    expect(peekPendingComposer()).not.toBeNull();
    clearPendingComposer();
    expect(peekPendingComposer()).toBeNull();
  });

  it("expires drafts older than the TTL", () => {
    savePendingComposer(DRAFT);
    const raw = JSON.parse(window.localStorage.getItem("td_pending_composer_v1")!);
    raw.savedAt = Date.now() - 25 * 3600 * 1000;
    window.localStorage.setItem("td_pending_composer_v1", JSON.stringify(raw));
    expect(peekPendingComposer()).toBeNull();
    // and the stale entry is gone
    expect(window.localStorage.getItem("td_pending_composer_v1")).toBeNull();
  });

  it("rejects malformed payloads without throwing", () => {
    window.localStorage.setItem("td_pending_composer_v1", "not json{");
    expect(peekPendingComposer()).toBeNull();
    window.localStorage.setItem("td_pending_composer_v1", JSON.stringify({ v: 2 }));
    expect(peekPendingComposer()).toBeNull();
  });

  it("caps enormous pastes instead of failing", () => {
    savePendingComposer({ ...DRAFT, text: "x".repeat(500_000) });
    const got = peekPendingComposer();
    expect(got!.text.length).toBe(200_000);
  });
});
