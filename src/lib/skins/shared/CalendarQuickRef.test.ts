import { describe, expect, test } from "bun:test";
import type { Block } from "../types";
import { buildCalendarDays, stripLabel } from "./CalendarQuickRef";

const day = (n: number, date?: string): Block => ({
  kind: "day",
  n,
  label: `Day ${n}`,
  date,
});
const place = (name: string, extra: Partial<Extract<Block, { kind: "place" }>> = {}): Block =>
  ({ kind: "place", name, category: "do", ...extra }) as Block;

describe("buildCalendarDays", () => {
  test("groups stops under their day and keeps flights on the day they happen", () => {
    const days = buildCalendarDays([
      day(1, "2026-10-14"),
      { kind: "flight", direction: "outbound", from: "JFK", to: "FCO", departTime: "18:30" },
      place("Colosseum", { time: "10:00" }),
      day(2, "2026-10-15"),
      place("Vatican", { time: "09:00" }),
    ]);
    expect(days).toHaveLength(2);
    expect(days[0]!.flights).toHaveLength(1);
    expect(days[0]!.timed.map((s) => s.place.name)).toEqual(["Colosseum"]);
    expect(days[1]!.flights).toHaveLength(0);
  });

  test("flights before any day header attach to the first day", () => {
    const days = buildCalendarDays([
      { kind: "flight", from: "JFK", to: "FCO" },
      day(1, "2026-10-14"),
      place("Gelato"),
    ]);
    expect(days[0]!.flights).toHaveLength(1);
  });

  test("timed stops sort by time; untimed follow without a fabricated time", () => {
    const days = buildCalendarDays([
      day(1),
      place("Dinner", { time: "20:00" }),
      place("Wander"),
      place("Coffee", { time: "8:30 AM" }),
    ]);
    expect(days[0]!.timed.map((s) => s.place.name)).toEqual(["Coffee", "Dinner"]);
    expect(days[0]!.untimed.map((s) => s.place.name)).toEqual(["Wander"]);
  });

  test("Plan-B (shadow) blocks are excluded", () => {
    const days = buildCalendarDays([
      day(1),
      place("Main", { time: "10:00" }),
      place("Backup", { tier: "shadow" }),
    ]);
    expect(days[0]!.timed).toHaveLength(1);
    expect(days[0]!.untimed).toHaveLength(0);
  });

  test("the night's hotel is lifted out of the stop list", () => {
    const days = buildCalendarDays([
      day(1),
      place("Hotel Eden", { category: "accommodation" }),
      place("Colosseum"),
    ]);
    expect(days[0]!.hotel?.name).toBe("Hotel Eden");
    expect(days[0]!.untimed.map((s) => s.place.name)).toEqual(["Colosseum"]);
  });

  test("undated days still appear, labelled by day number", () => {
    const days = buildCalendarDays([day(1), place("Wander"), day(2)]);
    expect(days).toHaveLength(2);
    expect(stripLabel(days[1]!)).toEqual({ top: "Day", bottom: "2" });
  });

  test("ISO dates read as weekday + date in the strip", () => {
    expect(stripLabel(buildCalendarDays([day(1, "2026-10-14")])[0]!)).toEqual({
      top: "Wed",
      bottom: "14",
    });
  });
});
