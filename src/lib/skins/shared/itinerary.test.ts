import { describe, expect, it } from "bun:test";
import { buildItinerary } from "./itinerary";
import type { Block } from "../types";

const flight = (note: string, direction?: "outbound" | "inbound"): Block =>
  ({ kind: "flight", note, ...(direction ? { direction } : {}) }) as Block;

describe("buildItinerary flights", () => {
  it("treats the last undirected flight as the return leg", () => {
    const it0 = buildItinerary([flight("out"), flight("back")]);
    expect(it0.flights.outbound?.note).toBe("out");
    expect(it0.flights.inbound?.note).toBe("back");
    expect(it0.flights.outboundIndex).toBe(0);
    expect(it0.flights.inboundIndex).toBe(1);
  });

  it("leaves a single undirected flight as the departure only", () => {
    const it0 = buildItinerary([flight("one way")]);
    expect(it0.flights.outbound?.note).toBe("one way");
    expect(it0.flights.inbound).toBeUndefined();
  });

  it("honours explicit directions over position", () => {
    const it0 = buildItinerary([
      flight("home", "inbound"),
      flight("away", "outbound"),
    ]);
    expect(it0.flights.inbound?.note).toBe("home");
    expect(it0.flights.outbound?.note).toBe("away");
  });
});
