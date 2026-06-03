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