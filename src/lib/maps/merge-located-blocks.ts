import type { Block } from "@/lib/skins/types";
type Place = Extract<Block, { kind: "place" }>;
/** Apply location fields only. Never replace text or edits made during a lookup. */
export function mergeLocatedBlocks(current: Block[], persisted: Block[]): Block[] {
  const key = (b: Place) => JSON.stringify([b.name, b.address ?? ""]);
  const queues = new Map<string, Place[]>();
  for (const b of persisted)
    if (b.kind === "place") {
      const q = queues.get(key(b)) ?? [];
      q.push(b);
      queues.set(key(b), q);
    }
  return current.map((b) => {
    if (b.kind !== "place") return b;
    const found = queues.get(key(b))?.shift();
    if (!found || b.mapHidden || b.geocode?.status === "manual" || (b.lat != null && b.lng != null))
      return b;
    return {
      ...b,
      ...(found.lat != null ? { lat: found.lat } : {}),
      ...(found.lng != null ? { lng: found.lng } : {}),
      ...(found.placeId ? { placeId: found.placeId } : {}),
      ...(found.geocode ? { geocode: found.geocode } : {}),
    };
  });
}
