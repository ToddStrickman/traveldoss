export interface TocEntry {
  id: string;
  title: string;
}

/**
 * Slug for a section heading. Leading section numbers are dropped so
 * anchors stay stable across renumbering and read cleanly:
 * "19. Limitation of Liability" → "limitation-of-liability".
 */
export function headingSlug(heading: string): string {
  return heading
    .replace(/^\d+(\.\d+)*\.?\s*/, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Extract the `##` section headings of a legal markdown document as a
 * table of contents. The single `#` title and deeper levels are skipped —
 * the TOC mirrors the document's major sections only.
 */
export function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const title = match[1].replace(/\*\*/g, "").trim();
    entries.push({ id: headingSlug(title), title });
  }
  return entries;
}
