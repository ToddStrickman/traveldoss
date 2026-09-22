import type { ExtractedTravelEntity, ImportedEmailMessage, ItemType, Reservation } from "./types";
import { awareTime, providerName } from "./normalize";

export interface TravelDataExtractor {
  extract(message: ImportedEmailMessage): ExtractedTravelEntity[];
}
export interface ProviderTemplateParser {
  id: string;
  supports(message: ImportedEmailMessage): boolean;
  parse(message: ImportedEmailMessage): ExtractedTravelEntity[];
}
export const TRUSTED_PROVIDERS: Record<string, string[]> = {
  airfrance: ["airfrance.com", "airfrance.fr"],
  delta: ["delta.com"],
  united: ["united.com"],
  american: ["aa.com"],
  britishairways: ["ba.com"],
  marriott: ["marriott.com"],
  hilton: ["hilton.com"],
  opentable: ["opentable.com"],
  amtrak: ["amtrak.com"],
  eurostar: ["eurostar.com"],
};
function trusted(message: ImportedEmailMessage, provider: string): boolean {
  const domain = /@([^>\s]+)/.exec(message.sender)?.[1]?.toLowerCase();
  return (
    message.authenticatedSender &&
    !!domain &&
    (TRUSTED_PROVIDERS[providerName(provider)] ?? []).some(
      (d) => domain === d || domain.endsWith(`.${d}`),
    )
  );
}
export function isTravelEmail(message: ImportedEmailMessage): boolean {
  const evidence = [
    message.subject,
    message.text,
    ...(message.attachments ?? []).map((a) => a.name + " " + (a.text ?? "")),
  ].join("\n");
  if (
    /sale|newsletter|inspiration|limited.time.offer/i.test(message.subject) &&
    !/confirmation|reservation|cancel|refund/i.test(message.subject)
  )
    return false;
  return /flight|airline|itinerary|reservation|booking|hotel|check.in|ticket|rail|ferry|rental.car|airport|tour|visa|travel.insurance|boarding|cancell?ed|refund/i.test(
    evidence,
  );
}
function unquoted(text: string) {
  return text
    .split(/\n(?:On .+wrote:|From:|_{5,}|-{2,}\s*Original Message)/i)[0]
    .split("\n")
    .filter((s) => !/^\s*>/.test(s))
    .join("\n");
}
export function cancellationDetected(
  subject: string,
  text: string,
  explicitStatus?: string,
): boolean {
  if (
    explicitStatus &&
    /^(?:https?:\/\/schema.org\/)?(?:ReservationCancelled|cancelled|canceled|voided|refunded|expired|no longer confirmed)$/i.test(
      explicitStatus.trim(),
    )
  )
    return true;
  const clean = unquoted(text)
    .split("\n")
    .filter(
      (s) =>
        !/cancellation policy|free cancellation|cancel (?:your|this)|how to cancel|if you cancel|not cancelle?d/i.test(
          s,
        ),
    )
    .join("\n");
  return /(?:booking|reservation|flight|ticket|tour|event).{0,55}(?:has been |is |was )?(?:cancell?ed|voided|refunded|expired|no longer confirmed)|(?:cancellation confirmed|confirmation of cancellation|your cancellation|refund processed)/i.test(
    `${subject}\n${clean}`,
  );
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, 1200) : undefined;
const name = (v: unknown) => (typeof v === "string" ? str(v) : str(object(v).name));
function structuredEntities(message: ImportedEmailMessage): ExtractedTravelEntity[] {
  const found: Record<string, unknown>[] = [];
  const visit = (value: unknown, depth = 0) => {
    if (depth > 8) return;
    if (Array.isArray(value)) {
      value.slice(0, 40).forEach((v) => visit(v, depth + 1));
      return;
    }
    const v = object(value);
    if (String(v["@type"]).endsWith("Reservation")) found.push(v);
    if (v["@graph"]) visit(v["@graph"], depth + 1);
  };
  for (const match of (message.html ?? "").matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      visit(JSON.parse(match[1]));
    } catch {
      /* malformed structured data remains reviewable through text */
    }
  }
  return found.slice(0, 40).map((v, i) => {
    const event = object(v.reservationFor),
      guest = object(v.underName),
      lodging = object(v.reservationFor),
      address = object(lodging.address);
    const kind = String(v["@type"]);
    const type: ItemType = kind.includes("Flight")
      ? "flight"
      : kind.includes("Lodging")
        ? "lodging"
        : kind.includes("Food")
          ? "dining"
          : kind.includes("Train")
            ? "rail"
            : kind.includes("Bus")
              ? "bus"
              : kind.includes("RentalCar")
                ? "car"
                : kind.includes("Event")
                  ? "event"
                  : "other";
    const provider =
      name(event.airline) ??
      name(event.provider) ??
      name(v.provider) ??
      name(lodging) ??
      "Unknown provider";
    const startAt = awareTime(
      str(event.departureTime ?? v.checkinTime ?? v.startTime ?? event.startDate ?? v.pickupTime),
    );
    const endAt = awareTime(
      str(event.arrivalTime ?? v.checkoutTime ?? v.endTime ?? event.endDate ?? v.dropoffTime),
    );
    const reservation: ExtractedTravelEntity["reservation"] = {
      type,
      title:
        name(event) ??
        (type === "flight"
          ? `${provider} ${str(event.flightNumber) ?? "flight"}`
          : "Travel reservation"),
      provider,
      confirmation: str(v.reservationNumber ?? v.bookingId),
      traveler: name(guest),
      startAt,
      endAt,
      timezone: str(event.departureTimezone ?? v.timezone),
      origin: str(object(event.departureAirport).iataCode ?? object(event.departureStation).name),
      destination: str(object(event.arrivalAirport).iataCode ?? object(event.arrivalStation).name),
      location: str(address.addressLocality ?? object(event.location).name ?? lodging.name),
      address:
        [
          address.streetAddress,
          address.addressLocality,
          address.addressRegion,
          address.postalCode,
          address.addressCountry,
        ]
          .filter((s) => typeof s === "string")
          .join(", ") || undefined,
      status: cancellationDetected(message.subject, message.text, str(v.reservationStatus))
        ? "cancelled"
        : "confirmed",
      details: Object.fromEntries(
        Object.entries({
          flightNumber: str(event.flightNumber),
          arrivalAirport: str(object(event.arrivalAirport).iataCode),
          destinationCity: str(object(object(event.arrivalAirport).address).addressLocality),
          gate: str(event.departureGate),
          terminal: str(event.departureTerminal),
        }).filter(([, value]) => value !== undefined),
      ) as Record<string, string>,
    };
    // An explicit numeric offset establishes an instant; UTC is honest when no geographic IANA zone is supplied.
    if (startAt && !reservation.timezone) reservation.timezone = "UTC";
    const verified = trusted(message, provider);
    return {
      key: `schema:${i}`,
      reservation,
      confidence: verified ? 0.98 : 0.7,
      rationale: verified
        ? "Structured reservation data from an authenticated, recognized provider email."
        : "Structured data found, but the sender/provider association needs your review.",
    };
  });
}

/** Conservative labeled-template fallback. Free prose never invents a timezone, traveler, or booking. */
export class ConservativeTravelExtractor implements TravelDataExtractor {
  constructor(private parsers: ProviderTemplateParser[] = []) {}
  extract(message: ImportedEmailMessage): ExtractedTravelEntity[] {
    if (!isTravelEmail(message)) return [];
    const custom = this.parsers.find((p) => p.supports(message));
    if (custom) return custom.parse(message);
    const structured = structuredEntities(message);
    if (structured.length) return structured;
    const body = unquoted(
      [message.text, ...(message.attachments ?? []).map((a) => a.text ?? "")].join("\n"),
    );
    const field = (...keys: string[]) => {
      for (const key of keys) {
        const m = new RegExp(`^\\s*${key}\\s*[:#]\\s*(.+)$`, "im").exec(body);
        if (m) return m[1].trim().slice(0, 500);
      }
      return undefined;
    };
    const provider = field("Provider", "Airline", "Hotel", "Operator") ?? "Unknown provider";
    const typeValue = field("Type")?.toLowerCase();
    const types: ItemType[] = [
      "flight",
      "lodging",
      "dining",
      "rail",
      "bus",
      "ferry",
      "car",
      "transfer",
      "parking",
      "activity",
      "event",
      "lounge",
      "insurance",
      "visa",
      "document",
      "other",
    ];
    const type = types.includes(typeValue as ItemType)
      ? (typeValue as ItemType)
      : /flight|airline/i.test(`${message.subject} ${body}`)
        ? "flight"
        : /hotel|check.in|lodging/i.test(body)
          ? "lodging"
          : "other";
    const cancelled =
      cancellationDetected(message.subject, body, field("Status")) ||
      !!message.attachments?.some((a) => /cancell?ation|cancell?ed|refund/i.test(a.name));
    const reservation: ExtractedTravelEntity["reservation"] = {
      type,
      title: field("Title") ?? "Travel reservation",
      provider,
      confirmation: field(
        "Confirmation(?: number)?",
        "Booking (?:ID|reference)",
        "Reservation (?:ID|number)",
        "Ticket number",
      ),
      traveler: field("Traveler", "Passenger", "Guest"),
      startAt: awareTime(field("Departure", "Start", "Check-in")),
      endAt: awareTime(field("Arrival", "End", "Check-out")),
      timezone: field("Timezone", "Time zone"),
      origin: field("From", "Origin"),
      destination: field("To", "Destination"),
      location: field("Location", "City"),
      address: field("Address"),
      outdoor: field("Outdoor") === "yes" ? true : field("Outdoor") === "no" ? false : undefined,
      status: cancelled ? "cancelled" : "confirmed",
      details: Object.fromEntries(
        Object.entries({
          flightNumber: field("Flight number"),
          gate: field("Gate"),
          terminal: field("Terminal"),
          destinationCity: field("Destination city"),
          phone: field("Phone"),
          access: field("Access instructions"),
        }).filter(([, value]) => value !== undefined),
      ) as Record<string, string>,
    };
    const hasUnsupportedAttachment = message.attachments?.some(
      (a) => !a.text && /pdf|image/i.test(a.mimeType),
    );
    const verified =
      trusted(message, provider) && !!reservation.confirmation && !hasUnsupportedAttachment;
    return [
      {
        key: "text:0",
        reservation,
        confidence: verified ? 0.96 : 0.65,
        replacesConfirmation: field("Replaces confirmation"),
        rationale: verified
          ? "Explicit labeled reservation fields from an authenticated, recognized provider."
          : hasUnsupportedAttachment
            ? "This booking has an attachment that needs review; its contents were not guessed."
            : "Travel information found; incomplete fields or an unverified sender need your review.",
      },
    ];
  }
}
