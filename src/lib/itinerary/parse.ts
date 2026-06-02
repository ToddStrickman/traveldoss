/**
 * Drop-in parser. Turns pasted raw text, AI output, or a call transcript into
 * the app's Block[] — fully client-side, no AI key required. Splits on "Day N"
 * (line-start OR inline, since transcripts are often one long line), then breaks
 * each day into stops on sentence/comma boundaries.
 *
 * When an AI gateway is later wired in, swap `parseDropIn` for an AI call that
 * returns the same Block[] shape; the UI won't change.
 */
import type { Block } from "@/lib/skins/types";

export type IngestSource = "text" | "ai" | "transcript";

function titleCase(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

export function parseDropIn(text: string, _source: IngestSource = "text"): Block[] {
  const segments = text.split(/(?=\bday\s*\d+\b)/i).map((s) => s.trim()).filter(Boolean);
  const blocks: Block[] = [];
  for (const seg of segments) {
    const m = seg.match(/^day\s*(\d+)\s*[:.\-—]?\s*([\s\S]*)$/i);
    if (!m) {
      // Pre-amble before any "Day": keep as a paragraph.
      blocks.push({ kind: "paragraph", text: seg });
      continue;
    }
    const n = Number(m[1]);
    const rest = m[2].trim();
    const clauses = rest
      .split(/[.;\n]+|,(?=\s)/)
      .map((c) => c.replace(/^[-*•]\s*/, "").trim())
      .filter((c) => c.length > 1);
    // First clause becomes the day label if it reads like a title; otherwise generic.
    const label = clauses.length && clauses[0].length <= 48 ? titleCase(clauses[0]) : `Day ${n}`;
    const stops = label === `Day ${n}` ? clauses : clauses.slice(1);
    blocks.push({ kind: "day", n, label });
    for (const c of stops) {
      blocks.push({ kind: "place", name: titleCase(c), category: guessCategory(c) });
    }
  }
  return blocks;
}

function guessCategory(s: string): "stay" | "eat" | "see" | "do" | "drink" | "other" {
  const t = s.toLowerCase();
  if (/(hotel|hostel|airbnb|check.?in|stay|inn|resort)/.test(t)) return "stay";
  if (/(breakfast|lunch|dinner|eat|restaurant|cafe|café|food|tasting)/.test(t)) return "eat";
  if (/(drink|bar|wine|cocktail|aperiti|coffee)/.test(t)) return "drink";
  if (/(museum|gallery|see|view|temple|church|park|beach|tour|visit)/.test(t)) return "see";
  return "other";
}
