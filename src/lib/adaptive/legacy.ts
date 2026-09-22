import type { Block } from "@/lib/skins/types";
import type { TravelDossier, ExtractedTravelEntity } from "./types";
import { airportZone } from "@/lib/skins/shared/airportTz";
import { awareTime } from "./normalize";

/** Explicit owner import stages old display blocks for review, without guessing their reservation status. */
export function stageLegacy(
  state: TravelDossier,
  tripId: string,
  blocks: Block[],
  now: string,
): TravelDossier {
  const next = structuredClone(state);
  const marker = `legacy:${tripId}`;
  if (next.processed.includes(marker)) return next;
  next.processed.push(marker);
  let day: string | undefined;
  for (const [index, block] of blocks.entries()) {
    if (block.kind === "day") day = block.date;
    if (block.kind !== "flight" && block.kind !== "place") continue;
    const flight = block.kind === "flight";
    const entity: ExtractedTravelEntity = {
      key: `${marker}:${index}`,
      confidence: 0.7,
      rationale:
        "Imported from your existing itinerary. Confirm the reservation, dates, and timezone before live monitoring.",
      reservation: flight
        ? {
            type: "flight",
            title: `${block.airline ?? "Flight"} ${block.flightNumber ?? ""}`.trim(),
            provider: block.airline ?? "Unknown provider",
            confirmation: block.confirmation,
            traveler: block.passenger,
            origin: block.from,
            destination: block.to,
            startAt: awareTime(block.date),
            timezone: airportZone(block.from),
            status: "confirmed",
            details: {
              ...(block.flightNumber ? { flightNumber: block.flightNumber } : {}),
              originalDate: block.date ?? "",
              originalTime: block.departTime ?? "",
              ...(block.gate ? { gate: block.gate } : {}),
            },
          }
        : {
            type: ["stay", "hotel", "accommodation"].includes(block.category ?? "")
              ? "lodging"
              : ["restaurant", "eat", "food"].includes(block.category ?? "")
                ? "dining"
                : block.category === "transit"
                  ? "transfer"
                  : "activity",
            title: block.name,
            provider: block.vendor ?? block.name,
            confirmation: block.reservation,
            location: block.name,
            address: block.address,
            lat: block.lat,
            lng: block.lng,
            outdoor: ["walk", "walking"].includes(block.category ?? ""),
            status: "confirmed",
            details: {
              originalDate: day ?? "",
              originalTime: block.time ?? "",
              ...(block.phone ? { phone: block.phone } : {}),
              ...(block.website ? { website: block.website } : {}),
            },
          },
    };
    next.reviews.push({
      id: entity.key,
      entity,
      tripId,
      candidateIds: [],
      reason: entity.rationale,
      status: "open",
      at: now,
    });
  }
  return next;
}
