import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LEGAL_DOCS, CURRENT_TERMS_VERSION, type LegalDocSlug } from "./registry";
import { contentHash } from "./hash";
import { extractToc } from "./toc";

const CONTENT_DIR = join(import.meta.dir, "../../content/legal");

function readDoc(slug: LegalDocSlug): string {
  const { version } = LEGAL_DOCS[slug];
  return readFileSync(join(CONTENT_DIR, `${slug}-v${version}.md`), "utf8");
}

describe("legal document registry", () => {
  it("every registered document has a markdown file for its version", () => {
    for (const slug of Object.keys(LEGAL_DOCS) as LegalDocSlug[]) {
      expect(readDoc(slug).length).toBeGreaterThan(100);
    }
  });

  it("pinned content hashes match the published text (edit ⇒ bump the version)", () => {
    for (const slug of Object.keys(LEGAL_DOCS) as LegalDocSlug[]) {
      const actual = contentHash(readDoc(slug));
      // If this fails you edited a published legal document in place.
      // Publish it as a new version instead — see src/content/legal/README.md.
      // Expected hash for the new content is printed below.
      expect(`${slug}: ${actual}`).toBe(`${slug}: ${LEGAL_DOCS[slug].contentHash}`);
    }
  });

  it("metadata is well-formed", () => {
    for (const meta of Object.values(LEGAL_DOCS)) {
      expect(meta.version).toMatch(/^\d+(\.\d+)+$/);
      expect(Number.isNaN(Date.parse(meta.publishedAt))).toBe(false);
      expect(Number.isNaN(Date.parse(meta.effectiveAt))).toBe(false);
      expect(meta.contentHash).toMatch(/^fnv1a64-[0-9a-f]{16}$/);
    }
    expect(CURRENT_TERMS_VERSION).toBe(LEGAL_DOCS.terms.version);
  });

  it("terms document exposes the documented deep-link anchors", () => {
    const ids = extractToc(readDoc("terms")).map((e) => e.id);
    // Anchors referenced from other documents / external links.
    for (const required of [
      "acceptance-of-these-terms",
      "eligibility",
      "limitation-of-liability",
      "contact",
    ]) {
      expect(ids).toContain(required);
    }
    // 27 numbered sections, no duplicate anchors.
    expect(ids.length).toBe(27);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
