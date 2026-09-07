import { describe, expect, it } from "bun:test";
import { buildMapModel, distanceKm, indexDayLookup } from "../src/lib/maps/build-map-places";
import type { Block, TripView } from "../src/lib/skins/types";

const TRIP: TripView = { destination: "Lisbon", slug: "test" };

const BLOCKS: Block[] = [
  { kind: "place", name: "Memmo Príncipe Real", category: "accommodation", lat: 38.716, lng: -9.1476 }, // 0 preface base
  { kind: "day", n: 1, label: "Arrival", date: "2026-10-01" }, // 1
  { kind: "section", title: "Morning", partOfDay: "morning" }, // 2
  { kind: "place", name: "Hello, Kristof", category: "restaurant", lat: 38.7095, lng: -9.1524, time: "10:30" }, // 3
  { kind: "place", name: "Museu de São Roque", category: "culture", lat: 38.7137, lng: -9.1434, time: "09:00" }, // 4 earlier
  { kind: "section", title: "Evening", partOfDay: "evening" }, // 5
  { kind: "place", name: "Belcanto", category: "restaurant", lat: 38.709, lng: -9.142, time: "20:00", placeId: "pid-belcanto", reservation: "Conf #L-882" }, // 6
  { kind: "place", name: "Backup bistro", category: "restaurant", lat: 38.708, lng: -9.141, tier: "shadow" }, // 7
  { kind: "place", name: "Somewhere unknown", category: "walk" }, // 8 unlocated
  { kind: "day", n: 2, label: "Sintra" }, // 9
  { kind: "place", name: "Belcanto", category: "restaurant", lat: 38.709, lng: -9.142, time: "13:00", placeId: "pid-belcanto" }, // 10 repeat visit
  { kind: "place", name: "Pena Palace", category: "culture", lat: 38.7876, lng: -9.3904, time: "15:00" }, // 11 ~25 km
  { kind: "day", n: 3, label: "Porto day" }, // 12
  { kind: "place", name: "Livraria Lello", category: "culture", lat: 41.1469, lng: -8.6149, time: "11:00" }, // 13
  { kind: "place", name: "Back in Lisbon", category: "walk", lat: 38.72, lng: -9.14, time: "19:00" }, // 14 > 150 km
];

describe("buildMapModel", () => {
  const model = buildMapModel(TRIP, BLOCKS);

  it("groups located stops into places, one per placeId, with every visit", () => {
    const names = model.places.map((p) => p.name);
    expect(names).toContain("Belcanto");
    expect(names.filter((n) => n === "Belcanto")).toHaveLength(1);
    const belcanto = model.places.find((p) => p.name === "Belcanto")!;
    expect(belcanto.visits).toHaveLength(2);
    expect(belcanto.visits.map((v) => v.day)).toEqual([1, 2]);
    expect(belcanto.placeId).toBe("pid-belcanto");
    expect(belcanto.reservation).toBe("Conf #L-882");
    expect(model.places).toHaveLength(8);
  });

  it("orders a day's route by part of day, then clock time, then block order", () => {
    const day1 = model.places
      .flatMap((p) => p.visits.filter((v) => v.day === 1 && v.order > 0).map((v) => ({ name: p.name, order: v.order })))
      .sort((a, b) => a.order - b.order)
      .map((x) => x.name);
    expect(day1).toEqual(["Museu de São Roque", "Hello, Kristof", "Belcanto"]);
  });

  it("marks the hotel as the base and the preface stop as day-less", () => {
    const hotel = model.places.find((p) => p.name === "Memmo Príncipe Real")!;
    expect(hotel.isBase).toBe(true);
    expect(hotel.kind).toBe("stay");
    expect(hotel.visits[0].day).toBeNull();
    expect(hotel.visits[0].order).toBe(0);
  });

  it("keeps Plan B stops off the route as ghost pins", () => {
    const backup = model.places.find((p) => p.name === "Backup bistro")!;
    expect(backup.tier).toBe("shadow");
    expect(backup.visits[0].order).toBe(0);
    expect(model.segments.some((s) => s.toKey === backup.key || s.fromKey === backup.key)).toBe(false);
  });

  it("lists stops without coordinates instead of guessing", () => {
    expect(model.unlocated).toEqual([{ blockIndex: 8, name: "Somewhere unknown", status: "none" }]);
  });

  it("draws walk segments within a city and flags long hops", () => {
    const day1 = model.segments.filter((s) => s.day === 1);
    expect(day1).toHaveLength(2);
    expect(day1.every((s) => s.kind === "walk")).toBe(true);
    const day2 = model.segments.filter((s) => s.day === 2);
    expect(day2).toHaveLength(1);
    expect(day2[0].kind).toBe("walk");
    const day3 = model.segments.filter((s) => s.day === 3);
    expect(day3).toHaveLength(1);
    expect(day3[0].kind).toBe("hop");
    expect(distanceKm([-8.6149, 41.1469], [-9.14, 38.72])).toBeGreaterThan(150);
  });

  it("reports the days that have pins and the bounds to fit", () => {
    expect(model.days).toEqual([1, 2, 3]);
    expect(model.bounds).not.toBeNull();
    const [[w, s], [e, n]] = model.bounds!;
    expect(w).toBeLessThan(-9.39);
    expect(e).toBeGreaterThan(-8.62);
    expect(s).toBeLessThan(38.71);
    expect(n).toBeGreaterThan(41.14);
  });

  it("honours the on-screen snapshot but always includes the opened day", () => {
    const partial = buildMapModel(TRIP, BLOCKS, { onlyVisible: new Set([3]), forceDay: 2 });
    const names = partial.places.map((p) => p.name).sort();
    expect(names).toEqual(["Belcanto", "Hello, Kristof", "Pena Palace"]);
    expect(partial.unlocated).toHaveLength(0);
  });

  it("skips stops the owner hid from the map", () => {
    const hidden = buildMapModel(TRIP, [
      { kind: "day", n: 1, label: "Day" },
      { kind: "place", name: "Private address", category: "accommodation", lat: 1, lng: 1, mapHidden: true },
      { kind: "place", name: "Public stop", category: "culture", lat: 1.001, lng: 1.001 },
    ]);
    expect(hidden.places.map((p) => p.name)).toEqual(["Public stop"]);
    expect(hidden.unlocated).toHaveLength(0);
  });

  it("dedupes by rounded coordinates and name when there is no placeId", () => {
    const m = buildMapModel(TRIP, [
      { kind: "day", n: 1, label: "Day" },
      // Two sightings of one market, a couple of metres apart (same 4-decimal cell).
      { kind: "place", name: "Time Out Market", category: "restaurant", lat: 38.70703, lng: -9.14582 },
      { kind: "day", n: 2, label: "Day" },
      { kind: "place", name: "Time Out Market", category: "restaurant", lat: 38.70701, lng: -9.14584 },
    ]);
    expect(m.places).toHaveLength(1);
    expect(m.places[0].visits).toHaveLength(2);
  });

  it("returns an empty model for a trip with nothing located", () => {
    const m = buildMapModel(TRIP, [{ kind: "day", n: 1, label: "Day" }, { kind: "place", name: "X", address: "Somewhere" }]);
    expect(m.places).toHaveLength(0);
    expect(m.bounds).toBeNull();
    expect(m.days).toEqual([]);
    expect(m.unlocated).toHaveLength(1);
  });
});

describe("indexDayLookup", () => {
  it("maps every activity index to its day, preface to null", () => {
    const lookup = indexDayLookup(BLOCKS);
    expect(lookup.get(0)).toBeNull();
    expect(lookup.get(3)).toBe(1);
    expect(lookup.get(7)).toBe(1);
    expect(lookup.get(11)).toBe(2);
    expect(lookup.get(14)).toBe(3);
  });
});
