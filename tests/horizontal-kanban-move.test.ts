import { describe, expect, test } from "bun:test";
import { buildItinerary, moveActivity } from "../src/lib/skins/shared/itinerary";
import type { Block } from "../src/lib/skins/types";
import { DEMO_BLOCKS } from "../src/lib/skins/demo";

/**
 * Regression tests for the horizontal kanban drag-and-drop reducer.
 *
 * The kanban view dispatches `moveActivity(blocks, srcIndex, dayIndex, part, beforeIndex?)`
 * on every drop. These tests cover the three scenarios the user can perform:
 *   1. Insert before a specific card inside a bucket
 *   2. Append to the end of a bucket (drop on the bucket itself)
 *   3. Move across days (and/or into a bucket that has no section yet)
 *
 * We exercise each scenario against multiple "template shapes" — the same
 * abstract content, laid out in the variations real user trips produce:
 *   - `full`        : every day has all three part-of-day sections (DEMO_BLOCKS)
 *   - `sparse`      : some days are missing part-of-day sections entirely
 *   - `unsectioned` : a day with activities but no section markers at all
 *
 * The reducer must add/remove section markers correctly so that re-running
 * buildItinerary() sees the activity in the expected bucket.
 */

type Move = {
  fromName: string;
  toDay: number; // 1-based day number, matches Block { kind: "day", n }
  toPart: "morning" | "afternoon" | "evening";
  /** Optional: name of the activity to insert BEFORE. Append if omitted. */
  beforeName?: string;
};

function findActivityIndex(blocks: Block[], name: string): number {
  const i = blocks.findIndex((b) => b.kind === "place" && b.name === name);
  if (i === -1) throw new Error(`No activity named "${name}"`);
  return i;
}

function findDayIndex(blocks: Block[], n: number): number {
  const i = blocks.findIndex((b) => b.kind === "day" && b.n === n);
  if (i === -1) throw new Error(`No day ${n}`);
  return i;
}

function applyMove(blocks: Block[], move: Move): Block[] {
  const src = findActivityIndex(blocks, move.fromName);
  const day = findDayIndex(blocks, move.toDay);
  const before =
    move.beforeName != null ? findActivityIndex(blocks, move.beforeName) : undefined;
  return moveActivity(blocks, src, day, move.toPart, before);
}

function bucket(
  blocks: Block[],
  dayN: number,
  part: "morning" | "afternoon" | "evening",
): string[] {
  const it = buildItinerary(blocks);
  const d = it.days.find((x) => x.day.n === dayN);
  if (!d) throw new Error(`Day ${dayN} not found`);
  return d[part].map((e) => e.activity.name);
}

/* ------------------------------------------------------------------ */
/* Template fixtures                                                   */
/* ------------------------------------------------------------------ */

/** Minimal three-day trip; every day has all three sections populated. */
const FULL: Block[] = JSON.parse(JSON.stringify(DEMO_BLOCKS));

/** Day 2 has no morning section; Day 3 has no afternoon section. */
const SPARSE: Block[] = [
  { kind: "day", n: 1, label: "Arrival" },
  { kind: "section", title: "Morning", partOfDay: "morning" },
  { kind: "place", name: "Coffee", category: "eat" },
  { kind: "section", title: "Afternoon", partOfDay: "afternoon" },
  { kind: "place", name: "Lunch", category: "eat" },
  { kind: "section", title: "Evening", partOfDay: "evening" },
  { kind: "place", name: "Dinner", category: "eat" },

  { kind: "day", n: 2, label: "Wander" },
  // no morning section
  { kind: "section", title: "Afternoon", partOfDay: "afternoon" },
  { kind: "place", name: "Museum", category: "see" },
  { kind: "place", name: "Park", category: "see" },
  { kind: "section", title: "Evening", partOfDay: "evening" },
  { kind: "place", name: "Fado", category: "do" },

  { kind: "day", n: 3, label: "Depart" },
  { kind: "section", title: "Morning", partOfDay: "morning" },
  { kind: "place", name: "Pastel", category: "eat" },
  // no afternoon section
  { kind: "section", title: "Evening", partOfDay: "evening" },
  { kind: "place", name: "Airport", category: "do" },
];

/** Day 1 has activities but zero section markers (free-floating "unassigned"). */
const UNSECTIONED: Block[] = [
  { kind: "day", n: 1, label: "Open" },
  { kind: "place", name: "Float A", category: "see" },
  { kind: "place", name: "Float B", category: "see" },
  { kind: "day", n: 2, label: "Structured" },
  { kind: "section", title: "Morning", partOfDay: "morning" },
  { kind: "place", name: "Brunch", category: "eat" },
];

/* ------------------------------------------------------------------ */
/* Scenario 1: INSERT BEFORE                                           */
/* ------------------------------------------------------------------ */

describe("kanban DnD · insert before another card", () => {
  test("FULL template: drop Belcanto before Hello, Kristof (cross-day + cross-part)", () => {
    const next = applyMove(FULL, {
      fromName: "Dinner · Belcanto",
      toDay: 2,
      toPart: "morning",
      beforeName: "Museu Nacional do Azulejo",
    });
    expect(bucket(next, 2, "morning")).toEqual([
      "Dinner · Belcanto",
      "Museu Nacional do Azulejo",
    ]);
    expect(bucket(next, 1, "evening")).toEqual(["Aperitivo · Pensão Amor"]);
  });

  test("FULL template: drop within same bucket reorders", () => {
    const next = applyMove(FULL, {
      fromName: "Walk · Príncipe Real → Bairro Alto",
      toDay: 1,
      toPart: "afternoon",
      beforeName: "Lunch · Time Out Market",
    });
    expect(bucket(next, 1, "afternoon")).toEqual([
      "Walk · Príncipe Real → Bairro Alto",
      "Lunch · Time Out Market",
    ]);
  });

  test("SPARSE template: insert before card in an existing bucket", () => {
    const next = applyMove(SPARSE, {
      fromName: "Coffee",
      toDay: 2,
      toPart: "afternoon",
      beforeName: "Park",
    });
    expect(bucket(next, 2, "afternoon")).toEqual(["Museum", "Coffee", "Park"]);
    expect(bucket(next, 1, "morning")).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Scenario 2: APPEND to bucket                                        */
/* ------------------------------------------------------------------ */

describe("kanban DnD · append to bucket end", () => {
  test("FULL template: append to a populated bucket", () => {
    const next = applyMove(FULL, {
      fromName: "Pastéis · Manteigaria",
      toDay: 1,
      toPart: "morning",
    });
    expect(bucket(next, 1, "morning")).toEqual([
      "Taxi · Lisbon Airport → Príncipe Real",
      "Hello, Kristof",
      "Pastéis · Manteigaria",
    ]);
  });

  test("SPARSE template: append into a bucket whose section does not exist yet (auto-creates section in correct order)", () => {
    // Day 2 has no morning section; moving "Coffee" into it must create one
    // ABOVE the existing afternoon section.
    const next = applyMove(SPARSE, {
      fromName: "Coffee",
      toDay: 2,
      toPart: "morning",
    });
    expect(bucket(next, 2, "morning")).toEqual(["Coffee"]);
    // Other buckets untouched.
    expect(bucket(next, 2, "afternoon")).toEqual(["Museum", "Park"]);
    expect(bucket(next, 2, "evening")).toEqual(["Fado"]);

    // The new morning section must be ordered BEFORE the afternoon section.
    const day2Start = next.findIndex((b) => b.kind === "day" && b.n === 2);
    const day3Start = next.findIndex((b) => b.kind === "day" && b.n === 3);
    const slice = next.slice(day2Start, day3Start);
    const partsInOrder = slice
      .filter((b) => b.kind === "section" && b.partOfDay)
      .map((b) => (b as { partOfDay: string }).partOfDay);
    expect(partsInOrder).toEqual(["morning", "afternoon", "evening"]);
  });

  test("SPARSE template: append into missing afternoon on day 3 creates section between morning and evening", () => {
    const next = applyMove(SPARSE, {
      fromName: "Lunch",
      toDay: 3,
      toPart: "afternoon",
    });
    expect(bucket(next, 3, "afternoon")).toEqual(["Lunch"]);
    const day3Start = next.findIndex((b) => b.kind === "day" && b.n === 3);
    const partsInOrder = next
      .slice(day3Start)
      .filter((b) => b.kind === "section" && b.partOfDay)
      .map((b) => (b as { partOfDay: string }).partOfDay);
    expect(partsInOrder).toEqual(["morning", "afternoon", "evening"]);
  });
});

/* ------------------------------------------------------------------ */
/* Scenario 3: CROSS-DAY moves                                         */
/* ------------------------------------------------------------------ */

describe("kanban DnD · cross-day moves", () => {
  test("FULL template: move evening activity from day 1 → day 3 morning", () => {
    const before = bucket(FULL, 1, "evening").length;
    const next = applyMove(FULL, {
      fromName: "Dinner · Belcanto",
      toDay: 3,
      toPart: "morning",
    });
    expect(bucket(next, 1, "evening").length).toBe(before - 1);
    expect(bucket(next, 3, "morning")).toContain("Dinner · Belcanto");
    // Belcanto goes to the END of day 3 morning (append).
    expect(bucket(next, 3, "morning").at(-1)).toBe("Dinner · Belcanto");
  });

  test("UNSECTIONED template: pull free-floating activity into a structured bucket", () => {
    const next = applyMove(UNSECTIONED, {
      fromName: "Float A",
      toDay: 2,
      toPart: "morning",
    });
    expect(bucket(next, 2, "morning")).toEqual(["Brunch", "Float A"]);
    // Float B stays on day 1. Since the auto-bucketing change, sectionless
    // untimed activities default into the morning rail (bucketFor's
    // "never silently dropped" contract) instead of an unassigned pile.
    const it = buildItinerary(next);
    const d1 = it.days.find((x) => x.day.n === 1)!;
    expect(d1.unassigned).toEqual([]);
    expect(d1.morning.map((e) => e.activity.name)).toEqual(["Float B"]);
  });

  test("UNSECTIONED template: move free-floating activity into a new bucket on its own day creates section", () => {
    const next = applyMove(UNSECTIONED, {
      fromName: "Float B",
      toDay: 1,
      toPart: "evening",
    });
    expect(bucket(next, 1, "evening")).toEqual(["Float B"]);
  });

  test("reducer is a no-op for non-place source blocks", () => {
    const flightIdx = FULL.findIndex((b) => b.kind === "flight");
    const dayIdx = findDayIndex(FULL, 2);
    const next = moveActivity(FULL, flightIdx, dayIdx, "morning");
    expect(next).toBe(FULL);
  });

  test("reducer is a no-op for an invalid destination day", () => {
    const src = findActivityIndex(FULL, "Dinner · Belcanto");
    const next = moveActivity(FULL, src, 9999, "morning");
    expect(next).toBe(FULL);
  });
});