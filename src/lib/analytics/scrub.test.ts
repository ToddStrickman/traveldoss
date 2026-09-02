import { describe, expect, it } from "bun:test";
import { scrubPath, scrubUrl } from "./scrub";

describe("scrubPath", () => {
  it("keeps static paths", () => {
    expect(scrubPath("/")).toBe("/");
    expect(scrubPath("/templates")).toBe("/templates");
    expect(scrubPath("/contact")).toBe("/contact");
  });

  it("collapses trip slugs", () => {
    expect(scrubPath("/t/lisbon-spring-2026")).toBe("/t/:slug");
    expect(scrubPath("/t/lisbon-spring-2026/map")).toBe("/t/:slug/map");
  });

  it("collapses guide and template ids", () => {
    expect(scrubPath("/guides/albania-slow-roads")).toBe("/guides/:slug");
    expect(scrubPath("/templates/cassian")).toBe("/templates/:id");
  });

  it("collapses auth subpaths", () => {
    expect(scrubPath("/auth/callback")).toBe("/auth/*");
    expect(scrubPath("/auth")).toBe("/auth");
  });

  it("drops query and hash", () => {
    expect(scrubPath("/t/abc?ref=share#day-2")).toBe("/t/:slug");
    expect(scrubPath("/templates?view=grid")).toBe("/templates");
  });
});

describe("scrubUrl", () => {
  it("redacts the slug in an absolute referrer", () => {
    expect(scrubUrl("https://traveldoss.com/t/cassian-k7m2xq")).toBe(
      "https://traveldoss.com/t/:slug",
    );
  });

  it("redacts auth material in the query and drops the fragment", () => {
    const out = scrubUrl("https://traveldoss.com/login?code=abc123&next=%2Fplan#access_token=xyz");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("xyz");
    expect(out).toContain("next=");
  });

  it("falls back to a path scrub for a relative or malformed input", () => {
    expect(scrubUrl("/t/cassian-k7m2xq")).toBe("/t/:slug");
    expect(scrubUrl("")).toBe("");
  });
});
