import { describe, expect, it } from "bun:test";
import { collectHotelStays } from "./HotelsQuickRef";
import type { Block } from "../types";

const day = (n: number, date?: string): Block => ({ kind: "day", n, date } as Block);
const hotel = (name: string): Block =>
  ({ kind: "place", name, category: "accommodation" } as Block);
const dinner = (name: string): Block =>
  ({ kind: "place", name, category: "restaurant" } as Block);

describe("collectHotelStays", () => {
  it("returns nothing when the trip has no accommodation", () => {
    expect(collectHotelStays([day(1), dinner("Da Enzo")])).toEqual([]);
  });

  it("collapses the same hotel repeated across nights into one stay", () => {
    const stays = collectHotelStays([
      day(1, "2026-05-01"),
      hotel("Hotel de Russie"),
      day(2, "2026-05-02"),
      hotel("Hotel de Russie"),
      day(3, "2026-05-03"),
    ]);
    expect(stays).toHaveLength(1);
    expect(stays[0].nights).toBe(2);
    expect(stays[0].checkInDate).toBe("2026-05-01");
    expect(stays[0].checkOutDate).toBe("2026-05-03");
  });

  it("ends a stay where the next hotel begins", () => {
    const stays = collectHotelStays([
      day(1, "2026-05-01"),
      hotel("Hotel de Russie"),
      day(2, "2026-05-02"),
      dinner("Roscioli"),
      day(3, "2026-05-03"),
      hotel("Villa Igiea"),
      day(4, "2026-05-06"),
    ]);
    expect(stays.map((s) => s.hotel.kind === "place" && s.hotel.name)).toEqual([
      "Hotel de Russie",
      "Villa Igiea",
    ]);
    expect(stays[0].nights).toBe(2);
    expect(stays[1].nights).toBe(3);
  });

  it("falls back to day numbers when the dates are free-form text", () => {
    const stays = collectHotelStays([
      day(1, "first weekend of May"),
      hotel("Villa Igiea"),
      day(4, "later"),
    ]);
    expect(stays[0].nights).toBe(3);
  });

  it("leaves nights undefined when there is nothing to measure", () => {
    const stays = collectHotelStays([day(1), hotel("Villa Igiea")]);
    expect(stays[0].nights).toBeUndefined();
  });

  it("recognises the legacy stay and hotel aliases", () => {
    const stays = collectHotelStays([
      day(1),
      { kind: "place", name: "Pensione A", category: "stay" } as Block,
      day(2),
      { kind: "place", name: "Pensione B", category: "hotel" } as Block,
    ]);
    expect(stays).toHaveLength(2);
  });
});
