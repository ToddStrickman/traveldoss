import { describe, expect, it } from "bun:test";
import { extractToc, headingSlug } from "./toc";

describe("headingSlug", () => {
  it("drops section numbers and slugifies", () => {
    expect(headingSlug("19. Limitation of Liability")).toBe("limitation-of-liability");
    expect(headingSlug("1. Acceptance of these Terms")).toBe("acceptance-of-these-terms");
    expect(headingSlug("27. Contact")).toBe("contact");
  });

  it("handles headings without numbers and with punctuation", () => {
    expect(headingSlug("AI and Information Accuracy")).toBe("ai-and-information-accuracy");
    expect(headingSlug("Third-Party Services")).toBe("third-party-services");
    expect(headingSlug("Use at Your Own Risk")).toBe("use-at-your-own-risk");
  });
});

describe("extractToc", () => {
  it("collects ## headings only, stripping bold markers", () => {
    const md = [
      "# Title",
      "",
      "## **1. First Section**",
      "body",
      "### sub",
      "## 2. Second Section",
    ].join("\n");
    expect(extractToc(md)).toEqual([
      { id: "first-section", title: "1. First Section" },
      { id: "second-section", title: "2. Second Section" },
    ]);
  });

  it("returns an empty list for heading-free documents", () => {
    expect(extractToc("just a paragraph")).toEqual([]);
  });
});
