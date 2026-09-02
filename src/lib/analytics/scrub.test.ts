import { describe, expect, it } from "bun:test";
import { scrubPath } from "./scrub";

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
