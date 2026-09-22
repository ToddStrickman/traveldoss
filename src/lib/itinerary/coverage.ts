import type { Block } from "@/lib/skins/types";

/**
 * Source coverage ledger.
 *
 * The import is only trustworthy if we can say, line by line, that what the
 * traveler pasted made it into the dossier. This compares the source text
 * against the text carried by the produced blocks and reports the lines that
 * are not represented, so the product can show "needs review" with the exact
 * unplaced lines instead of announcing success on a lossy parse.
 *
 * Deliberately conservative: it never mutates blocks and never blocks a save.
 */

export type CoverageLedger = {
  /** Meaningful source lines considered (formatting rows excluded). */
  sourceLines: number;
  /** How many of those are represented in the produced blocks. */
  coveredLines: number;
  /** 0–1. 1 when every meaningful source line is represented. */
  ratio: number;
  /** The unrepresented lines, in source order, capped for display. */
  missing: Array<{ line: number; text: string }>;
};

const MISSING_CAP = 40;

/** Markdown/ASCII table furniture and rules carry no traveler content. */
function isFormattingLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^[|\-\s:+=_*#·•>]+$/.test(t)) return true;
  if (/^\|?\s*(time|activity|day|date|notes?|place|details?)\s*\|/i.test(t) && /\|/.test(t)) return true;
  return false;
}

function tokens(value: string): string[] {
  return (value.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []) as string[];
}

function blockText(block: Block): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(block as Record<string, unknown>)) {
    if (key === "kind") continue;
    if (typeof value === "string") parts.push(value);
    else if (typeof value === "number") parts.push(String(value));
  }
  return parts.join(" ");
}

/**
 * A line counts as covered when at least 60% of its distinctive words (4+
 * characters) appear somewhere in the produced blocks. Short lines with no
 * distinctive words are treated as covered — there is nothing to lose.
 */
export function buildCoverageLedger(sourceText: string, blocks: Block[]): CoverageLedger {
  const haystack = new Set(tokens(blocks.map(blockText).join(" \n ")));
  const missing: CoverageLedger["missing"] = [];
  let sourceLines = 0;
  let coveredLines = 0;

  const lines = sourceText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isFormattingLine(line)) continue;
    const words = tokens(line);
    sourceLines++;
    if (!words.length) {
      coveredLines++;
      continue;
    }
    const hits = words.filter((w) => haystack.has(w)).length;
    if (hits / words.length >= 0.6) {
      coveredLines++;
      continue;
    }
    if (missing.length < MISSING_CAP) missing.push({ line: i + 1, text: line.trim().slice(0, 200) });
  }

  return {
    sourceLines,
    coveredLines,
    ratio: sourceLines === 0 ? 1 : coveredLines / sourceLines,
    missing,
  };
}
