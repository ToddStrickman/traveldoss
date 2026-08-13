import { describe, expect, it } from "bun:test";
import { GUIDES, GUIDES_BY_SLUG, PUBLISHED_GUIDES, getGuide, siblingGuides } from "@/content/guides";
import { getSkin } from "@/lib/skins/registry";

describe("insider guides registry", () => {
  it("has ten guides with unique slugs", () => {
    expect(GUIDES).toHaveLength(10);
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(10);
  });

  it("every guide is published with content, faq and SEO fields", () => {
    expect(PUBLISHED_GUIDES).toHaveLength(10);
    for (const g of GUIDES) {
      expect(g.published).toBe(true);
      expect(g.blocks.length).toBeGreaterThan(10);
      expect(g.blocks[0].kind).toBe("hero");
      expect(g.faq).toHaveLength(3);
      for (const f of g.faq) {
        // FAQ answers are the AEO snippet candidates: ≤50 words, spec §5.
        expect(f.a.split(/\s+/).length).toBeLessThanOrEqual(50);
      }
      expect(g.seoTitle).toContain("The Insider Guide | TravelDoss");
      expect(g.metaDescription.length).toBeGreaterThan(50);
      expect(g.metaDescription.length).toBeLessThanOrEqual(180);
      expect(g.sources.startsWith("Sources:")).toBe(true);
      // Verification notes never ship in rendered content (spec §1).
      expect(g.sources).not.toContain("Verify before publish");
    }
  });

  it("every guide wears a real skin and valid coordinates", () => {
    for (const g of GUIDES) {
      expect(GUIDES_BY_SLUG[g.slug]).toBe(g);
      expect(getSkin(g.skinId)).toBeTruthy();
      expect(Math.abs(g.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(g.lon)).toBeLessThanOrEqual(180);
    }
  });

  it("siblingGuides returns published non-self guides", () => {
    const sibs = siblingGuides("albania", 3);
    expect(sibs).toHaveLength(3);
    expect(sibs.some((g) => g.slug === "albania")).toBe(false);
    expect(sibs.every((g) => g.published)).toBe(true);
  });
});
