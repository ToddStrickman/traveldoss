import { describe, expect, it } from "bun:test";
import { GUIDES, GUIDES_BY_SLUG, getGuide, siblingGuides } from "@/content/guides";

describe("insider guides registry", () => {
  it("has ten guides with unique slugs", () => {
    expect(GUIDES).toHaveLength(10);
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(10);
  });

  it("albania and savannah are published with content and faq", () => {
    for (const slug of ["albania", "savannah"]) {
      const g = getGuide(slug)!;
      expect(g.published).toBe(true);
      expect(g.blocks.length).toBeGreaterThan(0);
      expect(g.faq.length).toBeGreaterThan(0);
      expect(g.seoTitle.length).toBeGreaterThan(10);
      expect(g.metaDescription.length).toBeGreaterThan(50);
    }
  });

  it("every guide carries SEO fields and coordinates", () => {
    for (const g of GUIDES) {
      expect(GUIDES_BY_SLUG[g.slug]).toBe(g);
      expect(Math.abs(g.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(g.lon)).toBeLessThanOrEqual(180);
      expect(g.metaDescription.length).toBeLessThanOrEqual(180);
    }
  });

  it("siblingGuides excludes the current guide", () => {
    const sibs = siblingGuides("albania", 3);
    expect(sibs.some((g) => g.slug === "albania")).toBe(false);
    expect(sibs.length).toBeLessThanOrEqual(3);
  });
});
