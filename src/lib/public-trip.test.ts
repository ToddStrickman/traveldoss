import { describe, expect, it } from "bun:test";
import { projectPublicTrip, type PublicTripRow } from "./public-trip";

const NOW = new Date("2026-07-11T12:00:00Z").getTime();

function row(overrides: Partial<PublicTripRow> = {}): PublicTripRow {
  return {
    id: "t1",
    slug: "marguerite-abc123",
    destination: "Roma & Sicilia",
    subtitle: "Two nights bookending Rome",
    template_id: "marguerite",
    hero_image_url: "https://example.com/hero.jpg",
    start_date: "2026-11-20",
    end_date: "2026-11-28",
    content: { blocks: [{ kind: "day", n: 1 }], skin: "marguerite" },
    expires_at: "2026-12-28T00:00:00Z",
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("projectPublicTrip", () => {
  it("returns live trips untouched", () => {
    const r = row();
    const out = projectPublicTrip(r, NOW);
    expect(out.expired).toBe(false);
    expect(out.trip).toBe(r);
    expect(out.trip.content).not.toBeNull();
  });

  it("strips content and dates from expired trips — the $1 gate is server-side", () => {
    const out = projectPublicTrip(row({ expires_at: "2026-07-01T00:00:00Z" }), NOW);
    expect(out.expired).toBe(true);
    expect(out.trip.content).toBeNull();
    expect(out.trip.start_date).toBeNull();
    expect(out.trip.end_date).toBeNull();
    // The expired page + social head still work:
    expect(out.trip.destination).toBe("Roma & Sicilia");
    expect(out.trip.slug).toBe("marguerite-abc123");
    expect(out.trip.hero_image_url).toContain("hero.jpg");
  });

  it("treats a missing expires_at as never-expiring", () => {
    const out = projectPublicTrip(row({ expires_at: null }), NOW);
    expect(out.expired).toBe(false);
  });

  it("expiry boundary: exactly-now is not yet expired", () => {
    const out = projectPublicTrip(row({ expires_at: new Date(NOW).toISOString() }), NOW);
    expect(out.expired).toBe(false);
  });
});
