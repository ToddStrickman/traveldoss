import { toast } from "sonner";
import type { Block } from "@/lib/skins/types";

export type DayDateAutofill = {
  /** New blocks array when at least one TBD day was filled; null otherwise. */
  blocks: Block[] | null;
  /** How many TBD days received a date. */
  filled: number;
  /** Number of day blocks in the itinerary. */
  dayCount: number;
  /** Days spanned by the trip range (inclusive), or null without a valid range. */
  rangeDays: number | null;
};

/** Parse ISO yyyy-mm-dd in LOCAL time — `new Date("yyyy-mm-dd")` is UTC and
 *  shifts a day for every negative-offset timezone. */
function parseISOLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatShortDate(iso: string): string {
  const d = parseISOLocal(iso);
  return d
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : iso;
}

/**
 * Fill TBD per-day dates from the trip's date range: day i gets start + i.
 * Dates a user already set (ISO or free-form prose) are never overwritten.
 * Returns enough shape for the caller to guide the user when the range
 * length and the day count disagree.
 */
export function autofillDayDates(
  blocks: Block[],
  startISO: string,
  endISO: string,
): DayDateAutofill {
  const start = parseISOLocal(startISO);
  const end = parseISOLocal(endISO);
  const rangeDays =
    start && end && end.getTime() >= start.getTime()
      ? Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
      : null;

  let dayCount = 0;
  let filled = 0;
  let next: Block[] | null = null;
  if (start) {
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.kind !== "day") continue;
      const position = dayCount;
      dayCount += 1;
      if (b.date && b.date.trim()) continue;
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + position);
      if (!next) next = blocks.slice();
      next[i] = { ...b, date: toISO(date) };
      filled += 1;
    }
  } else {
    dayCount = blocks.filter((b) => b.kind === "day").length;
  }

  return { blocks: next, filled, dayCount, rangeDays };
}

/** User feedback for a dates change: confirm what auto-filled, and guide
 *  when the range length disagrees with the itinerary's day count. */
export function notifyDayDateAutofill(
  fill: DayDateAutofill | null,
  startISO: string,
): void {
  if (!fill) return;
  const { filled, dayCount, rangeDays } = fill;
  if (filled > 0) {
    toast.success(filled === 1 ? "Day date filled in" : "Day dates filled in", {
      description: `${filled} TBD ${filled === 1 ? "day" : "days"} now ${filled === 1 ? "follows" : "follow"} your trip dates from ${formatShortDate(startISO)}.`,
      duration: 3200,
    });
  }
  if (rangeDays != null && dayCount > 0 && rangeDays !== dayCount) {
    const diff = Math.abs(rangeDays - dayCount);
    const dayWord = diff === 1 ? "day" : "days";
    toast.message("Dates and days don't match", {
      description:
        rangeDays > dayCount
          ? `Your dates span ${rangeDays} days, but the itinerary has ${dayCount}. Add ${diff} more ${dayWord} — or tighten the dates to match.`
          : `Your dates span ${rangeDays} days, but the itinerary has ${dayCount}. Remove ${diff} ${dayWord} — or extend the dates to match.`,
      duration: 7000,
    });
  }
}
