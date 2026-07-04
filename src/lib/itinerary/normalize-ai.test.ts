import { describe, expect, test } from "bun:test";
import { normalizeParsedShape } from "./normalize-ai";

/**
 * Fixtures condensed from a real production failure
 * (traveldoss-debug-parse-ai-2026-07-04T19-43-21-571Z.json): three
 * consecutive Gemini responses, each rejected by Zod for a different
 * shape deviation. After normalization all three must validate.
 */

type Rec = Record<string, unknown>;
const blocksOf = (v: unknown) => (v as { blocks: Rec[] }).blocks;

describe("normalizeParsedShape", () => {
  test("attempt-1 shape: nested days[].blocks with kind:accommodation/transit", () => {
    const out = normalizeParsedShape({
      destination: "Emilia-Romagna, Italy",
      overview: "Eat your way through the greatest food region in Italy.",
      days: [
        {
          kind: "day", n: 1, label: "Arrive in Modena",
          blocks: [
            { kind: "accommodation", time: "15:00", category: "accommodation",
              name: "Hotel Rua Frati 48", checkIn: "15:00", checkOut: "11:00", confidence: 0.95 },
            { kind: "place", time: "16:00", category: "walk", name: "Piazza Grande", confidence: 0.95 },
          ],
        },
        {
          kind: "day", n: 2, label: "Move to Bologna",
          blocks: [
            { kind: "transit", time: "10:00", category: "transit", name: "Travel to Bologna", confidence: 0.8 },
          ],
        },
      ],
      notes: [{ kind: "note", text: "Hire a private driver for the countryside days." }],
    });

    const blocks = blocksOf(out);
    expect((out as Rec).days).toBeUndefined();
    expect(blocks[0]).toEqual({ kind: "paragraph", text: "Eat your way through the greatest food region in Italy." });
    expect(blocks[1]).toMatchObject({ kind: "day", n: 1, label: "Arrive in Modena" });
    // kind:accommodation → place + category preserved
    expect(blocks[2]).toMatchObject({ kind: "place", category: "accommodation", name: "Hotel Rua Frati 48" });
    // kind:transit → place + category transit
    const transit = blocks.find((b) => b.name === "Travel to Bologna");
    expect(transit).toMatchObject({ kind: "place", category: "transit" });
    // trailing root notes flattened
    expect(blocks[blocks.length - 1]).toMatchObject({ kind: "note" });
  });

  test("attempt-2 shape: flat blocks with kind:transit entries", () => {
    const out = normalizeParsedShape({
      destination: "Emilia-Romagna, Italy",
      blocks: [
        { kind: "day", n: 2, label: "November 23" },
        { kind: "transit", name: "Return to Modena", time: "18:00", confidence: 0.8 },
        { kind: "place", name: "Light Dinner in Modena", category: "restaurant", time: "20:00" },
      ],
    });
    const blocks = blocksOf(out);
    expect(blocks[1]).toMatchObject({ kind: "place", category: "transit", name: "Return to Modena" });
    expect(blocks[2]).toMatchObject({ kind: "place", category: "restaurant" });
  });

  test("attempt-3 shape: kind:accommodation with free-text category 'Luxury Hotel'", () => {
    const out = normalizeParsedShape({
      blocks: [
        { kind: "accommodation", name: "Grand Hotel Majestic", category: "Luxury Hotel",
          checkIn: "14:00", checkOut: "12:00", confidence: 0.95 },
      ],
    });
    expect(blocksOf(out)[0]).toMatchObject({
      kind: "place",
      category: "accommodation",
      checkIn: "14:00",
    });
  });

  test("free-text category on a valid place block is canonicalized", () => {
    const out = normalizeParsedShape({
      blocks: [
        { kind: "place", name: "Somewhere", category: "Boutique Hotel" },
        { kind: "place", name: "Cafe Stop", category: "Café" },
        { kind: "place", name: "Mystery", category: "totally-unknown" },
      ],
    });
    const blocks = blocksOf(out);
    expect(blocks[0].category).toBe("accommodation");
    expect(blocks[1].category).toBe("restaurant");
    expect(blocks[2].category).toBe(""); // unknown → ambiguous, never invalid
  });

  test("day blocks with missing n get sequential numbers", () => {
    const out = normalizeParsedShape({
      blocks: [
        { kind: "day", label: "First" },
        { kind: "place", name: "X" },
        { kind: "day", label: "Second" },
      ],
    });
    const blocks = blocksOf(out);
    expect(blocks[0].n).toBe(1);
    expect(blocks[2].n).toBe(2);
  });

  test("string confidence is coerced to number", () => {
    const out = normalizeParsedShape({
      blocks: [{ kind: "place", name: "X", confidence: "0.9" }],
    });
    expect(blocksOf(out)[0].confidence).toBe(0.9);
  });

  test("unsalvageable junk blocks are dropped, not fatal", () => {
    const out = normalizeParsedShape({
      blocks: [
        { kind: "banana" },
        { kind: "place", name: "Keeper" },
      ],
    });
    const blocks = blocksOf(out);
    expect(blocks.length).toBe(1);
    expect(blocks[0].name).toBe("Keeper");
  });

  test("non-object input passes through untouched for Zod to reject", () => {
    expect(normalizeParsedShape(null)).toBe(null);
    expect(normalizeParsedShape("nope")).toBe("nope");
    expect(normalizeParsedShape([1, 2])).toEqual([1, 2]);
  });
});
