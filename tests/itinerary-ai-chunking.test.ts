import { describe, expect, test } from "bun:test";
import { splitItineraryForAi } from "../src/lib/itinerary/parse-ai.functions";

describe("long itinerary AI chunking", () => {
  test("keeps day sections intact and preserves all source text", () => {
    const days = Array.from({ length: 12 }, (_, index) => {
      const day = index + 1;
      return `Day ${day}: City ${day}\n${`Stop ${day} with reservation details. `.repeat(80)}`;
    });
    const source = days.join("\n");
    const chunks = splitItineraryForAi(source, 2_800);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 2_800)).toBe(true);
    expect(chunks.join("\n").replace(/\s/g, "")).toBe(source.replace(/\s/g, ""));
    for (let day = 1; day <= 12; day++) {
      expect(chunks.filter((chunk) => chunk.includes(`Day ${day}:`))).toHaveLength(1);
    }
  });

  test("splits an oversized single section without losing content", () => {
    const source = `Day 1: Arrival\n${"Detailed note. ".repeat(900)}`;
    const chunks = splitItineraryForAi(source, 2_000);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(source);
  });
});