import { describe, expect, test } from "vitest";
import { getTripLogistics, timeFraction } from "../src/lib/skins/shared/logistics";
import type { Block, TripView } from "../src/lib/skins/types";

const trip: TripView = { destination: "Test", slug: "test", start_date: "2026-06-12", end_date: "2026-06-14" };
const days: Block[] = [
  { kind: "day", n: 1, label: "One", date: "2026-06-12" },
  { kind: "day", n: 2, label: "Two", date: "2026-06-13" },
  { kind: "day", n: 3, label: "Three", date: "2026-06-14" },
];

describe("trip logistics geometry", () => {
  test("parses local times and uses stable positioning defaults", () => {
    expect(timeFraction("15:00", 0)).toBeCloseTo(0.625);
    expect(timeFraction("11:00", 0)).toBeCloseTo(11 / 24);
    expect(timeFraction(undefined, 0.25)).toBe(0.25);
  });

  test("an overnight flight crosses a day boundary", () => {
    const blocks: Block[] = [
      { kind: "flight", from: "JFK", to: "LIS", date: "2026-06-12", arriveDate: "2026-06-13", departTime: "20:00", arriveTime: "08:00" },
      ...days,
    ];
    const flight = getTripLogistics(trip, blocks).flights[0];
    expect(flight.departureDay).toBe(0);
    expect(flight.arrivalDay).toBe(1);
    expect(flight.end).toBeGreaterThan(1);
    expect(flight.fallback).toBe(false);
  });

  test("same-day westbound and date-line geometry use a departure-anchored fallback", () => {
    const blocks: Block[] = [
      { kind: "flight", from: "JFK", to: "LAX", date: "2026-06-12", departTime: "18:00", arriveTime: "20:00" },
      { kind: "flight", from: "NRT", to: "LAX", date: "2026-06-13", arriveDate: "2026-06-12", departTime: "17:00", arriveTime: "10:00" },
      ...days,
    ];
    const [westbound, dateLine] = getTripLogistics(trip, blocks).flights;
    expect(westbound.fallback).toBe(false);
    expect(dateLine.fallback).toBe(true);
    expect(dateLine.end).toBeGreaterThan(dateLine.start);
  });

  test("alternates stay shades and supports a same-day handoff", () => {
    const blocks: Block[] = [
      days[0],
      { kind: "place", name: "Hotel A", category: "hotel", checkIn: "15:00", checkOut: "10:00", address: "1 Way, Lisbon, Portugal" },
      days[1],
      { kind: "place", name: "Hotel B", category: "hotel", checkIn: "16:00", checkOut: "11:00", address: "2 Way, Porto, Portugal" },
      days[2],
    ];
    const result = getTripLogistics(trip, blocks);
    expect(result.stays).toHaveLength(2);
    expect(result.stays.map((stay) => stay.shadeIndex)).toEqual([0, 1]);
    expect(result.stays[0].toDay).toBe(result.stays[1].fromDay);
    expect(result.days.map((day) => day.city)).toEqual(["Lisbon", "Porto", "Porto"]);
  });

  test("marks an uncovered night without exposing content", () => {
    const result = getTripLogistics(trip, days);
    expect(result.gaps.map((gap) => gap.night)).toEqual([0, 1]);
  });
});