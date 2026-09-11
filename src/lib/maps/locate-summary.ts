/**
 * Pure summary of a locate pass (before/after blocks), kept apart from the
 * server function so tests can import it without server-fn machinery.
 */
import type { Block } from "@/lib/skins/types";
import { shouldAttemptGeocode } from "@/lib/itinerary/geo.server";

export type LocateSummary = {
  /** False when the server has no GOOGLE_MAPS_API_KEY: nothing can be looked up. */
  configured: boolean;
  serviceUnavailable?: boolean;
  /** Stops that gained coordinates in this call. */
  located: number;
  /** Stops now marked needs_review (three misses). */
  unresolved: number;
  /** Stops still eligible for another automatic attempt. */
  remaining: number;
};

type PlaceBlock = Extract<Block, { kind: "place" }>;

export function isLocated(b: Block): boolean {
  return b.kind === "place" && typeof b.lat === "number" && Number.isFinite(b.lat) && Math.abs(b.lat) <= 90 && typeof b.lng === "number" && Number.isFinite(b.lng) && Math.abs(b.lng) <= 180;
}

/** Pure summary of a before/after pair, exported for tests. */
export function summarizeLocate(before: Block[], after: Block[], configured: boolean): LocateSummary {
  const locatedBefore = before.filter(isLocated).length;
  const locatedAfter = after.filter(isLocated).length;
  const places = after.filter((b): b is PlaceBlock => b.kind === "place" && !b.mapHidden);
  return {
    configured,
    located: Math.max(0, locatedAfter - locatedBefore),
    unresolved: places.filter((b) => !isLocated(b) && b.geocode?.status === "needs_review").length,
    remaining: places.filter((b) => shouldAttemptGeocode(b)).length,
  };
}

