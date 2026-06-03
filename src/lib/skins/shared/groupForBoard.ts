import type { Block } from "../types";

/** A board item is either a Day-with-its-Places group, or a standalone block.
 *  Used by grid/horizontal views to keep day context together. */
export type BoardItem =
  | {
      type: "day";
      day: Extract<Block, { kind: "day" }>;
      places: Extract<Block, { kind: "place" }>[];
    }
  | { type: "block"; block: Block };

/** Group consecutive `place` blocks under their preceding `day` block.
 *  Non-place / non-day blocks always render standalone. */
export function groupForBoard(blocks: Block[]): BoardItem[] {
  const out: BoardItem[] = [];
  let current: Extract<BoardItem, { type: "day" }> | null = null;
  for (const b of blocks) {
    if (b.kind === "day") {
      current = { type: "day", day: b, places: [] };
      out.push(current);
    } else if (b.kind === "place" && current) {
      current.places.push(b);
    } else {
      current = null;
      out.push({ type: "block", block: b });
    }
  }
  return out;
}