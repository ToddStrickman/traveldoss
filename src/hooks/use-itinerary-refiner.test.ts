import { describe, expect, it } from "bun:test";
import { refineSignature, type RefineSnapshot } from "./use-itinerary-refiner";
import type { Block } from "@/lib/skins/types";

function snap(blocks: Block[]): RefineSnapshot {
  return {
    blocks,
    destination: "Sicily",
    startDate: "2026-11-20",
    endDate: "2026-11-28",
    meta: {},
  };
}

const BASE: Block[] = [
  { kind: "day", n: 1, label: "Arrival" } as Block,
  { kind: "place", name: "Teatro Antico", time: "2:30 PM", category: "see" } as Block,
];

describe("refineSignature", () => {
  it("does NOT change when a place is renamed (renames must never trigger AI rewrites)", () => {
    const renamed = structuredClone(BASE);
    (renamed[1] as Block & { name: string }).name = "Teatro Antico di Taormina";
    expect(refineSignature(snap(renamed))).toBe(refineSignature(snap(BASE)));
  });

  it("does NOT change when a day label is renamed", () => {
    const renamed = structuredClone(BASE);
    (renamed[0] as Block & { label: string }).label = "Etna Summit & Taormina Night";
    expect(refineSignature(snap(renamed))).toBe(refineSignature(snap(BASE)));
  });

  it("changes on structural edits: time, category, add/remove, dates", () => {
    const base = refineSignature(snap(BASE));

    const retimed = structuredClone(BASE);
    (retimed[1] as Block & { time?: string }).time = "6:00 PM";
    expect(refineSignature(snap(retimed))).not.toBe(base);

    const recategorized = structuredClone(BASE);
    (recategorized[1] as Block & { category?: string }).category = "eat";
    expect(refineSignature(snap(recategorized))).not.toBe(base);

    const added = [...structuredClone(BASE), { kind: "place", name: "Isola Bella", category: "see" } as Block];
    expect(refineSignature(snap(added))).not.toBe(base);

    const datesMoved = { ...snap(BASE), endDate: "2026-11-29" };
    expect(refineSignature(datesMoved)).not.toBe(base);
  });
});
