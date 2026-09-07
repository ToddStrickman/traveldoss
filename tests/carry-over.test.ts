import { describe, expect, it } from "bun:test";
import { carryOverBlockFields } from "../src/lib/itinerary/carry-over";
import type { Block } from "../src/lib/skins/types";

type PlaceBlock = Extract<Block, { kind: "place" }>;
type DayBlock = Extract<Block, { kind: "day" }>;

describe("carryOverBlockFields (refine/harden round-trip)", () => {
  const before: Block[] = [
    { kind: "day", n: 1, label: "Arrival", images: [{ src: "day.jpg", alt: "Day" }] },
    {
      kind: "place",
      name: "Belcanto",
      category: "restaurant",
      lat: 38.709,
      lng: -9.142,
      placeId: "pid-belcanto",
      geocode: { status: "resolved", provider: "google-places", attempts: 1 },
      images: [{ src: "belcanto.jpg", alt: "Belcanto" }],
      mapsUrl: "https://maps.example/belcanto",
      websiteTitle: "Belcanto — José Avillez",
    },
    {
      kind: "place",
      name: "Grandma's flat",
      category: "accommodation",
      lat: 38.7,
      lng: -9.15,
      geocode: { status: "manual", provider: "manual", attempts: 0 },
      mapHidden: true,
    },
    { kind: "place", name: "Belcanto", category: "restaurant", lat: 38.709, lng: -9.142, placeId: "pid-belcanto" },
  ];

  // What the AI hands back: same stops, none of the fields it cannot express,
  // and a fresh (wrong) guess for the manually pinned flat.
  const after: Block[] = [
    { kind: "day", n: 1, label: "Arrival in Lisbon" },
    { kind: "place", name: "Belcanto", category: "restaurant", note: "Two stars." },
    { kind: "place", name: "Grandma’s Flat", category: "accommodation", lat: 40, lng: -8 },
    { kind: "place", name: "belcanto", category: "restaurant", lat: 1, lng: 1 },
  ];

  const out = carryOverBlockFields(before, after);

  it("restores coordinates, ids, status, photos and titles the model never saw", () => {
    const b = out[1] as PlaceBlock;
    expect(b.lat).toBe(38.709);
    expect(b.lng).toBe(-9.142);
    expect(b.placeId).toBe("pid-belcanto");
    expect(b.geocode?.status).toBe("resolved");
    expect(b.images?.[0].src).toBe("belcanto.jpg");
    expect(b.mapsUrl).toBe("https://maps.example/belcanto");
    expect(b.websiteTitle).toBe("Belcanto — José Avillez");
    // The model's own output is untouched.
    expect(b.note).toBe("Two stars.");
  });

  it("lets a manual pin win over a fresh model guess, and keeps the hide flag", () => {
    const flat = out[2] as PlaceBlock;
    expect(flat.lat).toBe(38.7);
    expect(flat.lng).toBe(-9.15);
    expect(flat.geocode?.status).toBe("manual");
    expect(flat.mapHidden).toBe(true);
  });

  it("does not overwrite values the model produced when there was no manual fix", () => {
    const second = out[3] as PlaceBlock;
    expect(second.lat).toBe(1);
    expect(second.lng).toBe(1);
    expect(second.placeId).toBe("pid-belcanto");
  });

  it("matches repeated names in order and restores day photos", () => {
    expect((out[0] as DayBlock).images?.[0].src).toBe("day.jpg");
    expect((out[0] as DayBlock).label).toBe("Arrival in Lisbon");
  });

  it("returns the same objects when nothing is carried", () => {
    const untouched: Block[] = [{ kind: "note", text: "hi" }, { kind: "place", name: "New stop" }];
    const res = carryOverBlockFields([], untouched);
    expect(res[0]).toBe(untouched[0]);
    expect(res[1]).toBe(untouched[1]);
  });
});
