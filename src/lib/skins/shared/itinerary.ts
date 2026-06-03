import type { Block } from "../types";

/** A grouped, structured view over the flat Block[] used by all three views.
 *  - Flights are pulled out of the stream into outbound/inbound.
 *  - Days collect their part-of-day buckets (morning/afternoon/evening).
 *  - Anything else (paragraphs, quotes, notes, free sections) lands in extras. */
export type PartOfDay = "morning" | "afternoon" | "evening";

export type ActivityBlock = Extract<Block, { kind: "place" }>;
export type FlightBlock = Extract<Block, { kind: "flight" }>;
export type DayBlock = Extract<Block, { kind: "day" }>;

export type ItineraryDay = {
  day: DayBlock;
  /** Index of the day block in the original flat array. */
  dayIndex: number;
  morning: { activity: ActivityBlock; index: number }[];
  afternoon: { activity: ActivityBlock; index: number }[];
  evening: { activity: ActivityBlock; index: number }[];
  /** Activities not assigned to a part-of-day section. */
  unassigned: { activity: ActivityBlock; index: number }[];
};

export type Itinerary = {
  flights: { outbound?: FlightBlock; inbound?: FlightBlock };
  /** Activities before any day block (e.g. hotel, currency). */
  preface: { activity: ActivityBlock; index: number }[];
  days: ItineraryDay[];
  /** Non-place/day blocks (paragraph, quote, note, plain section) in order. */
  extras: { block: Block; index: number }[];
};

export function buildItinerary(blocks: Block[]): Itinerary {
  const flights: Itinerary["flights"] = {};
  const preface: Itinerary["preface"] = [];
  const days: ItineraryDay[] = [];
  const extras: Itinerary["extras"] = [];

  let currentDay: ItineraryDay | null = null;
  let currentPart: PartOfDay | null = null;

  blocks.forEach((block, index) => {
    if (block.kind === "flight") {
      if (block.direction === "inbound") flights.inbound = block;
      else flights.outbound = flights.outbound ?? block;
      return;
    }
    if (block.kind === "day") {
      currentDay = {
        day: block,
        dayIndex: index,
        morning: [],
        afternoon: [],
        evening: [],
        unassigned: [],
      };
      currentPart = null;
      days.push(currentDay);
      return;
    }
    if (block.kind === "section") {
      if (block.partOfDay && currentDay) {
        currentPart = block.partOfDay;
      } else {
        // Plain section: reset part-of-day pointer, push to extras.
        currentPart = null;
        extras.push({ block, index });
      }
      return;
    }
    if (block.kind === "place") {
      if (!currentDay) {
        preface.push({ activity: block, index });
        return;
      }
      const entry = { activity: block, index };
      if (currentPart === "morning") currentDay.morning.push(entry);
      else if (currentPart === "afternoon") currentDay.afternoon.push(entry);
      else if (currentPart === "evening") currentDay.evening.push(entry);
      else currentDay.unassigned.push(entry);
      return;
    }
    // paragraph, quote, note, hero
    if (block.kind !== "hero") extras.push({ block, index });
  });

  return { flights, preface, days, extras };
}

export const PART_LABEL: Record<PartOfDay, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

const PART_ORDER: Record<PartOfDay, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
};

/**
 * Move an activity block to a different day and part-of-day, returning a new
 * flat block array. Used by the horizontal kanban drag-and-drop.
 *
 * @param blocks       Current flat block list
 * @param srcIndex     Index of the activity (place) block being moved
 * @param dayIndex     Index of the destination day block in `blocks`
 * @param part         Destination part-of-day bucket
 * @param beforeIndex  Optional index of an existing activity to insert before.
 *                     When omitted, the moved activity is appended to the bucket.
 */
export function moveActivity(
  blocks: Block[],
  srcIndex: number,
  dayIndex: number,
  part: PartOfDay,
  beforeIndex?: number,
): Block[] {
  if (srcIndex < 0 || srcIndex >= blocks.length) return blocks;
  const src = blocks[srcIndex];
  if (src.kind !== "place") return blocks;

  const next = blocks.slice();
  next.splice(srcIndex, 1);

  // Adjust indices that were past the removed block.
  const adjust = (i: number) => (i > srcIndex ? i - 1 : i);
  let day = adjust(dayIndex);
  let before = beforeIndex == null ? -1 : adjust(beforeIndex);

  if (day < 0 || day >= next.length || next[day].kind !== "day") return blocks;

  // End of this day's range (exclusive).
  let dayEnd = next.length;
  for (let i = day + 1; i < next.length; i++) {
    if (next[i].kind === "day") {
      dayEnd = i;
      break;
    }
  }

  // Find (or create) the part-of-day section within the day range.
  let sectionIdx = -1;
  for (let i = day + 1; i < dayEnd; i++) {
    const b = next[i];
    if (b.kind === "section" && b.partOfDay === part) {
      sectionIdx = i;
      break;
    }
  }
  if (sectionIdx === -1) {
    // Insert a new section in part order.
    let insertAt = dayEnd;
    for (let i = day + 1; i < dayEnd; i++) {
      const b = next[i];
      if (b.kind === "section" && b.partOfDay && PART_ORDER[b.partOfDay] > PART_ORDER[part]) {
        insertAt = i;
        break;
      }
    }
    next.splice(insertAt, 0, {
      kind: "section",
      title: PART_LABEL[part],
      partOfDay: part,
    });
    sectionIdx = insertAt;
    dayEnd += 1;
    if (before >= insertAt) before += 1;
  }

  // End of this part's range (next section/day, or day end).
  let partEnd = dayEnd;
  for (let i = sectionIdx + 1; i < dayEnd; i++) {
    const b = next[i];
    if (b.kind === "section" || b.kind === "day") {
      partEnd = i;
      break;
    }
  }

  let insertAt: number;
  if (before >= sectionIdx + 1 && before < partEnd) {
    insertAt = before;
  } else {
    insertAt = partEnd;
  }
  next.splice(insertAt, 0, src);
  return next;
}