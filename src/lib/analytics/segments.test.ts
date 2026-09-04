import { describe, expect, it } from "vitest";
import { browserLabel, deviceLabel, sourceLabel } from "./segments";

describe("sourceLabel", () => {
  it("treats no referrer as direct", () => {
    expect(sourceLabel("", null, "traveldoss.com")).toBe("direct");
  });

  it("treats our own host as direct, never as a referral", () => {
    expect(sourceLabel("https://traveldoss.com/templates", null, "traveldoss.com")).toBe("direct");
  });

  it("buckets search engines", () => {
    expect(sourceLabel("https://www.google.com/search?q=x", null, "traveldoss.com")).toBe("search");
    expect(sourceLabel("https://duckduckgo.com/", null, "traveldoss.com")).toBe("search");
  });

  it("names social platforms", () => {
    expect(sourceLabel("https://l.instagram.com/", null, "traveldoss.com")).toBe("instagram");
    expect(sourceLabel("https://x.com/someone", null, "traveldoss.com")).toBe("x");
  });

  it("keeps an unknown referrer as a host-only referral label", () => {
    expect(sourceLabel("https://www.blog.example.org/post", null, "traveldoss.com")).toBe(
      "referral: blog.example.org",
    );
  });

  it("prefers an explicit campaign source", () => {
    expect(sourceLabel("https://www.google.com/", "newsletter", "traveldoss.com")).toBe("newsletter");
  });

  it("never leaks a path or query from the referrer", () => {
    const label = sourceLabel("https://mail.example.com/x?access_token=abc", null, "traveldoss.com");
    expect(label).not.toContain("access_token");
    expect(label).not.toContain("/x");
  });

  it("falls back to direct for an unparseable referrer", () => {
    expect(sourceLabel("not a url", null, "traveldoss.com")).toBe("direct");
  });
});

describe("deviceLabel", () => {
  it("detects phones", () => {
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Safari")).toBe("mobile");
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 14; Pixel) Mobile Safari")).toBe("mobile");
  });

  it("detects tablets", () => {
    expect(deviceLabel("Mozilla/5.0 (iPad; CPU OS 17_0) AppleWebKit Safari")).toBe("tablet");
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 13; SM-X200) Safari")).toBe("tablet");
  });

  it("defaults to desktop", () => {
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari")).toBe("desktop");
  });
});

describe("browserLabel", () => {
  it("reports a family, never a version", () => {
    expect(browserLabel("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36")).toBe("Chrome");
    expect(browserLabel("Mozilla/5.0 Version/17.0 Safari/605.1.15")).toBe("Safari");
    expect(browserLabel("Mozilla/5.0 Firefox/121.0")).toBe("Firefox");
    expect(browserLabel("Mozilla/5.0 Chrome/120 Edg/120.0")).toBe("Edge");
    expect(browserLabel("Mozilla/5.0 CriOS/120 Safari")).toBe("Chrome");
    expect(browserLabel("something else")).toBe("other");
  });
});
