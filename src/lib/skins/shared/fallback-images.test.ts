import { describe, expect, it } from "bun:test";
import { buildDayImageQueries } from "./fallback-images";

describe("buildDayImageQueries", () => {
  it("ranks specific stops before city before bare destination", () => {
    const q = buildDayImageQueries({
      destination: "Ravello",
      dayLabel: "Gardens above the sea",
      placeNames: ["Villa Cimbrone", "Villa Rufolo"],
    });
    expect(q[0]).toBe("Villa Cimbrone Ravello");
    expect(q[1]).toBe("Villa Rufolo Ravello");
    expect(q[2]).toBe("Ravello Gardens above the sea");
    expect(q[q.length - 1]).toBe("Ravello");
  });

  it("extracts the venue from the Kind · Venue convention", () => {
    const q = buildDayImageQueries({
      destination: "Lisbon",
      dayLabel: null,
      placeNames: ["Dinner · Belcanto"],
    });
    expect(q[0]).toBe("Belcanto Lisbon");
  });

  it("skips transit legs and generic labels", () => {
    const q = buildDayImageQueries({
      destination: "Lisbon",
      dayLabel: null,
      placeNames: [
        "Taxi · Lisbon Airport → Príncipe Real",
        "Check-in",
        "Lunch",
        "Jerónimos Monastery",
      ],
    });
    expect(q[0]).toBe("Jerónimos Monastery Lisbon");
    expect(q.join("|")).not.toContain("Taxi");
    expect(q.join("|")).not.toContain("Check-in");
  });

  it("drops generic 'Day N' labels and dedupes", () => {
    const q = buildDayImageQueries({
      destination: "Rome",
      dayLabel: "Day 2",
      placeNames: [],
    });
    expect(q).toEqual(["Rome"]);
  });
});
