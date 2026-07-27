import { describe, expect, it } from "bun:test";
import { compareVersions } from "./versions";

describe("compareVersions", () => {
  it("orders simple versions", () => {
    expect(compareVersions("1.0", "1.0")).toBe(0);
    expect(compareVersions("1.0", "1.1")).toBeLessThan(0);
    expect(compareVersions("2.0", "1.9")).toBeGreaterThan(0);
  });

  it("compares numerically, not lexically", () => {
    // "1.10" must be newer than "1.9" — the classic string-compare trap.
    expect(compareVersions("1.10", "1.9")).toBeGreaterThan(0);
    expect(compareVersions("1.2", "1.10")).toBeLessThan(0);
  });

  it("treats missing segments as zero", () => {
    expect(compareVersions("1", "1.0")).toBe(0);
    expect(compareVersions("1.0.1", "1.0")).toBeGreaterThan(0);
  });

  it("survives malformed input without throwing", () => {
    expect(compareVersions("", "1.0")).toBeLessThan(0);
    expect(compareVersions("abc", "1.0")).toBeLessThan(0);
  });
});
