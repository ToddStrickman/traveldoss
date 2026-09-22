/**
 * The one-way bridge from the private workspace to the shared dossier.
 *
 * Private reservations (email evidence, confirmation numbers, live status) stay
 * in the workspace. Sharing copies only the traveler-facing facts a dossier
 * reader needs: what it is, where, and when. Nothing here reads or writes the
 * database — the server function owns that — so the merge rules are unit-testable.
 *
 * Matching is by confirmation number first, then by flight number, then by
 * normalized title on the same local date. A matched block is updated in place
 * so repeated shares never duplicate a stop.
 */
import type { Block } from "@/lib/skins/types";
import type { CanonicalItineraryItem } from "./types";

export type ShareMerge = {
  blocks: Block[];
  added: number;
  updated: number;
};

/** Local calendar date (YYYY-MM-DD) of an aware instant, in the reservation's own zone. */
function localDate(startAt: string | undefined, timezone: string): string | undefined {
  if (!startAt) return undefined;
  const ms = Date.parse(startAt);
  if (Number.isNaN(ms)) return undefined;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(ms);
  } catch {
    return undefined;
  }
}

/** Local 24h clock time of an aware instant, in the reservation's own zone. */
function localTime(startAt: string | undefined, timezone: string): string | undefined {
  if (!startAt) return undefined;
  const ms = Date.parse(startAt);
  if (Number.isNaN(ms)) return undefined;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(ms);
  } catch {
    return undefined;
  }
}

function norm(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Free-form day dates ("Oct 14", "2026-10-14") reduced to YYYY-MM-DD when parseable. */
function dayKey(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim());
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ms = Date.parse(date);
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms).toISOString().slice(0, 10);
}

const CATEGORY: Record<string, NonNullable<Extract<Block, { kind: "place" }>["category"]>> = {
  lodging: "accommodation",
  dining: "restaurant",
  transfer: "transit",
  activity: "event",
  event: "event",
  tour: "culture",
  car: "transit",
  rail: "transit",
};

/** True when this reservation is already represented by the given block. */
function matches(block: Block, item: CanonicalItineraryItem): boolean {
  const r = item.reservation;
  if (block.kind === "flight") {
    if (r.type !== "flight") return false;
    if (r.confirmation && block.confirmation && norm(r.confirmation) === norm(block.confirmation))
      return true;
    const flightNumber = r.details?.flightNumber;
    return !!flightNumber && norm(flightNumber) === norm(block.flightNumber);
  }
  if (block.kind === "place") {
    if (r.type === "flight") return false;
    if (r.confirmation && block.reservation && norm(block.reservation).includes(norm(r.confirmation)))
      return true;
    return norm(block.name) === norm(r.title || r.location);
  }
  return false;
}

function flightBlock(item: CanonicalItineraryItem): Extract<Block, { kind: "flight" }> {
  const r = item.reservation;
  return {
    kind: "flight",
    ...(r.provider ? { airline: r.provider } : {}),
    ...(r.details?.flightNumber ? { flightNumber: r.details.flightNumber } : {}),
    ...(r.origin ? { from: r.origin } : {}),
    ...(r.destination ? { to: r.destination } : {}),
    ...(localDate(r.startAt, r.timezone) ? { date: localDate(r.startAt, r.timezone) } : {}),
    ...(localTime(r.startAt, r.timezone) ? { departTime: localTime(r.startAt, r.timezone) } : {}),
    ...(r.endAt && localTime(r.endAt, r.timezone)
      ? { arriveTime: localTime(r.endAt, r.timezone) }
      : {}),
  };
}

function placeBlock(item: CanonicalItineraryItem): Extract<Block, { kind: "place" }> {
  const r = item.reservation;
  const category = CATEGORY[r.type];
  return {
    kind: "place",
    name: r.title || r.location || r.provider,
    ...(category ? { category } : {}),
    ...(r.address ? { address: r.address } : {}),
    ...(localTime(r.startAt, r.timezone) ? { time: localTime(r.startAt, r.timezone) } : {}),
    ...(r.lat != null ? { lat: r.lat } : {}),
    ...(r.lng != null ? { lng: r.lng } : {}),
  };
}

/** Fields the bridge is allowed to refresh on an existing block. */
function refresh(block: Block, item: CanonicalItineraryItem): boolean {
  const r = item.reservation;
  let changed = false;
  const set = <T extends object, K extends keyof T>(target: T, field: K, value: T[K]) => {
    if (value == null || value === "" || target[field] === value) return;
    target[field] = value;
    changed = true;
  };
  if (block.kind === "flight") {
    set(block, "date", localDate(r.startAt, r.timezone));
    set(block, "departTime", localTime(r.startAt, r.timezone));
    if (r.endAt) set(block, "arriveTime", localTime(r.endAt, r.timezone));
    set(block, "from", r.origin);
    set(block, "to", r.destination);
    set(block, "airline", r.provider);
  } else if (block.kind === "place") {
    set(block, "time", localTime(r.startAt, r.timezone));
    set(block, "address", r.address);
  }
  return changed;
}

/**
 * Merge every confirmed reservation for one trip into the dossier's blocks.
 * Cancelled reservations are never copied, and nothing is ever deleted: a
 * cancellation is the traveler's call to make in the dossier itself.
 */
export function mergeConfirmedIntoBlocks(
  blocks: Block[],
  items: CanonicalItineraryItem[],
  tripId: string,
): ShareMerge {
  const next = structuredClone(blocks);
  let added = 0;
  let updated = 0;
  const confirmed = items.filter(
    (i) => i.tripId === tripId && i.reservation.status === "confirmed",
  );
  for (const item of confirmed) {
    const existing = next.find((b) => matches(b, item));
    if (existing) {
      if (refresh(existing, item)) updated += 1;
      continue;
    }
    const block = item.reservation.type === "flight" ? flightBlock(item) : placeBlock(item);
    if (block.kind === "flight") {
      next.push(block);
      added += 1;
      continue;
    }
    // Land the stop inside its own day when the dossier already has that date.
    const date = localDate(item.reservation.startAt, item.reservation.timezone);
    const dayIndex = date
      ? next.findIndex((b) => b.kind === "day" && dayKey(b.date) === date)
      : -1;
    if (dayIndex === -1) {
      next.push(block);
    } else {
      let insertAt = dayIndex + 1;
      while (insertAt < next.length && next[insertAt].kind !== "day") insertAt += 1;
      next.splice(insertAt, 0, block);
    }
    added += 1;
  }
  return { blocks: next, added, updated };
}
