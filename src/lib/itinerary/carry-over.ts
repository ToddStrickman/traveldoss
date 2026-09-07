/**
 * Carry-over of fields the AI round-trip cannot express.
 *
 * `refineItineraryAiCore` serializes the itinerary to a markdown brief and
 * re-parses it; the parser's Zod schema only knows the fields a model can
 * write. Everything else on a block — coordinates from Google Places, the
 * Places id, geocode status, an owner's manual fix, uploaded photos, link
 * titles — came back missing after every refine and every harden pass
 * (the August gap analysis called this out for reservations and images).
 *
 * This helper matches the blocks that came back against the blocks that
 * went in and restores those fields when the new block lacks them. It
 * never overwrites a value the model produced. Matching is by kind and
 * normalised name for places (in order of appearance, so two dinners at
 * the same restaurant stay distinct), and by day number for days.
 */
import type { Block } from "@/lib/skins/types";

type PlaceBlock = Extract<Block, { kind: "place" }>;
type DayBlock = Extract<Block, { kind: "day" }>;

/** Place fields the AI schema never carries. */
export const CARRIED_PLACE_FIELDS = [
  "lat",
  "lng",
  "placeId",
  "geocode",
  "mapHidden",
  "images",
  "mapsUrl",
  "websiteTitle",
  "linkTitles",
  "ticketLinkTitle",
  "enrichmentSource",
  "enrichedFields",
  "addressSuggested",
] as const satisfies readonly (keyof PlaceBlock)[];

const CARRIED_DAY_FIELDS = ["images", "linkTitles"] as const satisfies readonly (keyof DayBlock)[];

export function normalizePlaceName(name: string | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

/**
 * Restore carried fields from `before` onto `after`. Returns a new array;
 * `after` blocks that gain nothing are returned as-is.
 */
export function carryOverBlockFields(before: Block[], after: Block[]): Block[] {
  const placeQueues = new Map<string, PlaceBlock[]>();
  const dayByN = new Map<number, DayBlock>();
  for (const b of before) {
    if (b.kind === "place") {
      const k = normalizePlaceName(b.name);
      if (!k) continue;
      const q = placeQueues.get(k) ?? [];
      q.push(b);
      placeQueues.set(k, q);
    } else if (b.kind === "day") {
      dayByN.set(b.n, b);
    }
  }

  return after.map((b) => {
    if (b.kind === "place") {
      const q = placeQueues.get(normalizePlaceName(b.name));
      const src = q?.shift();
      if (!src) return b;
      // A manual fix is authoritative: it beats a fresh model/Places value.
      const manual = src.geocode?.status === "manual" && src.lat != null && src.lng != null;
      let next: PlaceBlock | null = null;
      for (const f of CARRIED_PLACE_FIELDS) {
        const have = (b as Record<string, unknown>)[f];
        const had = (src as Record<string, unknown>)[f];
        const force = manual && (f === "lat" || f === "lng" || f === "placeId" || f === "geocode");
        if (isEmpty(had)) continue;
        if (!isEmpty(have) && !force) continue;
        next ??= { ...b };
        (next as Record<string, unknown>)[f] = had;
      }
      return next ?? b;
    }
    if (b.kind === "day") {
      const src = dayByN.get(b.n);
      if (!src) return b;
      let next: DayBlock | null = null;
      for (const f of CARRIED_DAY_FIELDS) {
        const have = (b as Record<string, unknown>)[f];
        const had = (src as Record<string, unknown>)[f];
        if (isEmpty(had) || !isEmpty(have)) continue;
        next ??= { ...b };
        (next as Record<string, unknown>)[f] = had;
      }
      return next ?? b;
    }
    return b;
  });
}
