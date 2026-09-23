import { describe, expect, it } from "bun:test";
import { buildDossierProgressPreview } from "@/lib/itinerary/progress-preview";
import type { Block } from "@/lib/skins/types";

describe("dossier progress preview", () => {
  it("summarizes destination, dates, stops, stays and flights without content loss", () => {
    const blocks: Block[] = [
      { kind: "day", n: 1, label: "Rome", date: "2026-05-01" },
      { kind: "place", name: "Hotel Locarno", category: "accommodation" },
      { kind: "place", name: "Roscioli", category: "restaurant" },
      { kind: "flight", airline: "ITA", from: "JFK", to: "FCO", date: "2026-05-01" },
      { kind: "day", n: 2, label: "Orvieto", date: "2026-05-02" },
    ];

    const preview = buildDossierProgressPreview({ blocks, destination: "Italy Tasting Tour" });

    expect(preview.title).toBe("Italy Tasting Tour");
    expect(preview.dateLine).toBe("2026-05-01 – 2026-05-02");
    expect(preview.counts).toEqual({ days: 2, stops: 2, flights: 1, hotels: 1 });
    expect(preview.highlights).toEqual(["Rome", "Orvieto", "Hotel Locarno", "Roscioli"]);
  });

  it("uses explicit resolved dates ahead of block dates", () => {
    const preview = buildDossierProgressPreview({
      blocks: [{ kind: "day", n: 1, label: "Arrival", date: "May 1" }],
      destination: "Lisbon",
      dates: { startDate: "2026-06-10", endDate: "2026-06-14" },
    });

    expect(preview.dateLine).toBe("2026-06-10 – 2026-06-14");
  });
});