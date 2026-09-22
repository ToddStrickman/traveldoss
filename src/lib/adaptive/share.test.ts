import { describe, expect, it } from "bun:test";
import { mergeConfirmedIntoBlocks } from "./share";
import type { CanonicalItineraryItem, Reservation } from "./types";
import type { Block } from "@/lib/skins/types";

const TRIP = "11111111-1111-4111-8111-111111111111";

function item(id: string, reservation: Partial<Reservation>, tripId = TRIP): CanonicalItineraryItem {
  const r: Reservation = {
    type: "lodging",
    title: "Stay",
    provider: "Hotel",
    timezone: "Europe/Rome",
    status: "confirmed",
    details: {},
    ...reservation,
  } as Reservation;
  return {
    id,
    tripId,
    reservation: r,
    original: r,
    sourceKind: "user",
    sourceIds: [],
    confidence: 1,
    userEditedFields: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("mergeConfirmedIntoBlocks", () => {
  it("adds a confirmed flight as a flight block", () => {
    const flight = item("f1", {
      type: "flight",
      title: "Rome",
      provider: "ITA Airways",
      confirmation: "ABC123",
      origin: "JFK",
      destination: "FCO",
      startAt: "2026-10-14T20:30:00.000Z",
      endAt: "2026-10-15T08:10:00.000Z",
      details: { flightNumber: "AZ611" },
      timezone: "America/New_York",
    });
    const result = mergeConfirmedIntoBlocks([], [flight], TRIP);
    expect(result.added).toBe(1);
    const block = result.blocks[0] as Extract<Block, { kind: "flight" }>;
    expect(block.kind).toBe("flight");
    expect(block.flightNumber).toBe("AZ611");
    expect(block.date).toBe("2026-10-14");
    expect(block.departTime).toBe("16:30");
  });

  it("never copies a cancelled reservation", () => {
    const cancelled = item("c1", { status: "cancelled", startAt: "2026-10-14T13:00:00.000Z" });
    expect(mergeConfirmedIntoBlocks([], [cancelled], TRIP)).toMatchObject({
      added: 0,
      updated: 0,
      blocks: [],
    });
  });

  it("ignores reservations belonging to another trip", () => {
    const other = item("o1", { startAt: "2026-10-14T13:00:00.000Z" }, "22222222-2222-4222-8222-222222222222");
    expect(mergeConfirmedIntoBlocks([], [other], TRIP).added).toBe(0);
  });

  it("updates a matching flight in place instead of duplicating it", () => {
    const blocks: Block[] = [
      { kind: "flight", flightNumber: "AZ611", confirmation: "ABC123", departTime: "15:00" },
    ];
    const flight = item("f1", {
      type: "flight",
      confirmation: "ABC123",
      details: { flightNumber: "AZ611" },
      startAt: "2026-10-14T20:30:00.000Z",
      timezone: "America/New_York",
    });
    const result = mergeConfirmedIntoBlocks(blocks, [flight], TRIP);
    expect(result.blocks).toHaveLength(1);
    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
    expect((result.blocks[0] as Extract<Block, { kind: "flight" }>).departTime).toBe("16:30");
  });

  it("matches an existing stop by name and leaves the count of blocks alone", () => {
    const blocks: Block[] = [{ kind: "place", name: "Hotel de Russie" }];
    const stay = item("s1", {
      title: "Hotel de Russie",
      address: "Via del Babuino 9",
      startAt: "2026-10-15T13:00:00.000Z",
    });
    const result = mergeConfirmedIntoBlocks(blocks, [stay], TRIP);
    expect(result.blocks).toHaveLength(1);
    expect(result.updated).toBe(1);
    expect((result.blocks[0] as Extract<Block, { kind: "place" }>).address).toBe(
      "Via del Babuino 9",
    );
  });

  it("inserts a new stop inside the day that matches its local date", () => {
    const blocks: Block[] = [
      { kind: "day", n: 1, label: "Day 1", date: "2026-10-15" },
      { kind: "place", name: "Pantheon" },
      { kind: "day", n: 2, label: "Day 2", date: "2026-10-16" },
      { kind: "place", name: "Vatican" },
    ];
    const dinner = item("d1", {
      type: "dining",
      title: "Roscioli",
      provider: "Roscioli",
      startAt: "2026-10-15T18:30:00.000Z",
    });
    const result = mergeConfirmedIntoBlocks(blocks, [dinner], TRIP);
    expect(result.added).toBe(1);
    expect(result.blocks.map((b) => (b.kind === "place" ? b.name : b.kind))).toEqual([
      "day",
      "Pantheon",
      "Roscioli",
      "day",
      "Vatican",
    ]);
    expect((result.blocks[2] as Extract<Block, { kind: "place" }>).category).toBe("restaurant");
  });

  it("appends a stop whose date is not in the dossier", () => {
    const blocks: Block[] = [{ kind: "day", n: 1, label: "Day 1", date: "2026-10-15" }];
    const stay = item("s2", { title: "Masseria", startAt: "2026-11-02T13:00:00.000Z" });
    const result = mergeConfirmedIntoBlocks(blocks, [stay], TRIP);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[1].kind).toBe("place");
  });

  it("does not mutate the blocks it was given", () => {
    const blocks: Block[] = [{ kind: "place", name: "Hotel de Russie" }];
    const stay = item("s1", { title: "Hotel de Russie", address: "Via del Babuino 9" });
    mergeConfirmedIntoBlocks(blocks, [stay], TRIP);
    expect((blocks[0] as Extract<Block, { kind: "place" }>).address).toBeUndefined();
  });

  it("is idempotent across repeated shares", () => {
    const stay = item("s1", { title: "Hotel de Russie", startAt: "2026-10-15T13:00:00.000Z" });
    const first = mergeConfirmedIntoBlocks([], [stay], TRIP);
    const second = mergeConfirmedIntoBlocks(first.blocks, [stay], TRIP);
    expect(second.added).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.blocks).toHaveLength(1);
  });
});
