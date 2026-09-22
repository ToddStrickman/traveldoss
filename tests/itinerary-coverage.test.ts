import { describe, expect, it } from "bun:test";
import { buildCoverageLedger } from "@/lib/itinerary/coverage";
import { toBlockPreservingSource } from "@/lib/itinerary/parse-ai.functions";
import type { Block } from "@/lib/skins/types";

describe("source coverage ledger", () => {
  it("reports full coverage when every source line is represented", () => {
    const source = ["Day 1 — Arrival in Rome", "Dinner at Roscioli, EUR 90", "Hotel Locarno check-in"].join("\n");
    const blocks: Block[] = [
      { kind: "day", n: 1, label: "Arrival in Rome" },
      { kind: "place", name: "Roscioli", category: "restaurant", note: "EUR 90 dinner" },
      { kind: "place", name: "Hotel Locarno", category: "accommodation", note: "check-in" },
    ] as Block[];
    const ledger = buildCoverageLedger(source, blocks);
    expect(ledger.missing).toEqual([]);
    expect(ledger.ratio).toBe(1);
  });

  it("names the unplaced source lines instead of hiding the loss", () => {
    const source = [
      "Day 1 — Rome",
      "Lunch at Armando al Pantheon",
      "Ferry to Palermo, confirmation XK4472",
    ].join("\n");
    const blocks: Block[] = [
      { kind: "day", n: 1, label: "Rome" },
      { kind: "place", name: "Armando al Pantheon", category: "restaurant" },
    ] as Block[];
    const ledger = buildCoverageLedger(source, blocks);
    expect(ledger.sourceLines).toBe(3);
    expect(ledger.coveredLines).toBe(2);
    expect(ledger.missing).toHaveLength(1);
    expect(ledger.missing[0].text).toContain("XK4472");
    expect(ledger.ratio).toBeLessThan(1);
  });

  it("ignores markdown table furniture", () => {
    const source = ["| Time | Activity |", "| --- | --- |", "| Morning | Uffizi Gallery |"].join("\n");
    const blocks: Block[] = [
      { kind: "place", name: "Uffizi Gallery", category: "culture", time: "09:00" },
    ] as Block[];
    const ledger = buildCoverageLedger(source, blocks);
    expect(ledger.sourceLines).toBe(1);
    expect(ledger.missing).toEqual([]);
  });
});

describe("untypeable model blocks are preserved, not filtered", () => {
  it("salvages a nameless place into a visible note", () => {
    const block = toBlockPreservingSource({
      kind: "place",
      name: null,
      note: "Paid EUR 240 deposit, reference AB-9931",
    } as never);
    expect(block).not.toBeNull();
    expect(block!.kind).toBe("note");
    expect((block as { text: string }).text).toContain("AB-9931");
  });

  it("salvages a day marker with no number", () => {
    const block = toBlockPreservingSource({ kind: "day", n: null, label: "Travel home" } as never);
    expect(block).not.toBeNull();
    expect((block as { text: string }).text).toContain("Travel home");
  });

  it("returns null only when there is genuinely nothing to keep", () => {
    expect(toBlockPreservingSource({ kind: "paragraph", text: null } as never)).toBeNull();
  });
});
