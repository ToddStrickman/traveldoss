import { describe, expect, test } from "bun:test";
import type { Block } from "@/lib/skins/types";
import {
  RECONSTRUCTED_CONFIDENCE,
  flagReconstructedPlaces,
  identityWords,
  isReconstructedName,
} from "./reconstructed";

const SOURCE = `
  Three days in Rome. Day 1: arrive, Hotel Eden. Day 2: morning sightseeing,
  nice dinner. Day 3: museum, fly out.
`;

const place = (name: string, confidence?: number): Block =>
  ({ kind: "place", name, category: "do", confidence }) as Block;

describe("identityWords", () => {
  test("keeps distinctive words and drops travel filler", () => {
    expect(identityWords("Dinner at Armando al Pantheon")).toEqual(["armando", "pantheon"]);
    expect(identityWords("Morning sightseeing")).toEqual([]);
  });
});

describe("isReconstructedName", () => {
  test("a stop the traveler named is not reconstructed", () => {
    expect(isReconstructedName("Hotel Eden, Dorchester Collection", SOURCE)).toBe(false);
  });

  test("accents and casing still match", () => {
    expect(isReconstructedName("Hôtel EDEN", SOURCE)).toBe(false);
  });

  test("a stop the model invented is reconstructed", () => {
    expect(isReconstructedName("Lunch near Vatican City", SOURCE)).toBe(true);
    expect(isReconstructedName("Colosseum and Roman Forum Exploration", SOURCE)).toBe(true);
  });

  test("a purely generic name counts as reconstructed", () => {
    expect(isReconstructedName("Nice dinner", SOURCE)).toBe(true);
  });
});

describe("flagReconstructedPlaces", () => {
  test("caps invented stops and leaves the traveler's own alone", () => {
    const blocks = [
      place("Hotel Eden, Dorchester Collection", 0.95),
      place("Lunch near Vatican City", 0.85),
      place("Colosseum and Roman Forum Exploration", 0.9),
      { kind: "day", n: 1, label: "Day 1" } as Block,
    ];
    expect(flagReconstructedPlaces(blocks, SOURCE)).toBe(2);
    expect((blocks[0] as { confidence?: number }).confidence).toBe(0.95);
    expect((blocks[1] as { confidence?: number }).confidence).toBe(RECONSTRUCTED_CONFIDENCE);
    expect((blocks[2] as { confidence?: number }).confidence).toBe(RECONSTRUCTED_CONFIDENCE);
  });

  test("an unrated invented stop is capped too, and a lower rating is kept", () => {
    const blocks = [place("Secret rooftop bar"), place("Hidden trattoria", 0.3)];
    flagReconstructedPlaces(blocks, SOURCE);
    expect((blocks[0] as { confidence?: number }).confidence).toBe(RECONSTRUCTED_CONFIDENCE);
    expect((blocks[1] as { confidence?: number }).confidence).toBe(0.3);
  });
});
