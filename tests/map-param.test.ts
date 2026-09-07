import { afterEach, describe, expect, it } from "bun:test";
import { __resetMapRequestForTests, closeMap, openMap, parseMapParam, serializeMapParam } from "../src/lib/maps/use-map-param";

afterEach(() => __resetMapRequestForTests());

describe("?map= parameter", () => {
  it("round-trips the whole trip and a focused day", () => {
    expect(serializeMapParam(null)).toBe("trip");
    expect(serializeMapParam(2)).toBe("day-2");
    expect(parseMapParam("trip")).toEqual({ open: true, day: null });
    expect(parseMapParam("1")).toEqual({ open: true, day: null });
    expect(parseMapParam(1)).toEqual({ open: true, day: null });
    expect(parseMapParam("day-2")).toEqual({ open: true, day: 2 });
    expect(parseMapParam("day-12")).toEqual({ open: true, day: 12 });
  });

  it("treats anything else as closed or open-on-trip, never as a crash", () => {
    expect(parseMapParam(undefined)).toEqual({ open: false, day: null });
    expect(parseMapParam("")).toEqual({ open: false, day: null });
    expect(parseMapParam("day-")).toEqual({ open: true, day: null });
    expect(parseMapParam(42)).toEqual({ open: false, day: null });
  });
});

describe("open/close without a router", () => {
  it("opens and closes in memory when no navigator is registered", () => {
    // The store is read through useSyncExternalStore in components; here we
    // only need the calls not to throw and to be idempotent.
    expect(() => openMap(3, "day_header")).not.toThrow();
    expect(() => closeMap()).not.toThrow();
    expect(() => closeMap()).not.toThrow();
  });
});
