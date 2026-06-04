import type { Block, TripView } from "./skins/types";

/**
 * Build a downloadable iCalendar (.ics) blob from the standardized block
 * schema. Today this emits events for:
 *   - Flights (kind: "flight")  — one timed event per leg.
 *   - Accommodation (kind: "place", category: "accommodation"/"hotel"/"stay")
 *     — one event spanning check-in → check-out.
 *
 * Times are emitted as "floating" local times (no TZID, no Z) because the
 * parsed itinerary rarely carries an authoritative timezone. Every major
 * calendar app (Apple, Google, Outlook, Fastmail) interprets floating times
 * in the viewer's local zone, which is the right behaviour for a printed
 * itinerary you're carrying with you.
 */

type FlightBlock = Extract<Block, { kind: "flight" }>;
type PlaceBlock = Extract<Block, { kind: "place" }>;

const STAY_CATEGORIES = new Set(["accommodation", "hotel", "stay"]);

export type IcsBuildResult = {
  ics: string;
  filename: string;
  /** Number of VEVENTs actually emitted. 0 = nothing exportable. */
  count: number;
  /** Per-source counts for the toast/UI. */
  breakdown: { flights: number; stays: number };
};

export function buildItineraryIcs(trip: TripView, blocks: Block[]): IcsBuildResult {
  const events: string[] = [];
  const breakdown = { flights: 0, stays: 0 };
  const tripStart = parseDate(trip.start_date ?? null);

  blocks.forEach((block, i) => {
    if (block.kind === "flight") {
      const ev = flightEvent(block, i, trip, tripStart);
      if (ev) {
        events.push(ev);
        breakdown.flights += 1;
      }
      return;
    }
    if (block.kind === "place" && isStay(block)) {
      const ev = stayEvent(block, i, trip);
      if (ev) {
        events.push(ev);
        breakdown.stays += 1;
      }
    }
  });

  const calName = trip.destination ? `${trip.destination} · TravelDoss` : "TravelDoss itinerary";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TravelDoss//Itinerary Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calName)}`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return {
    ics,
    filename: `${slugify(trip.destination ?? trip.slug ?? "itinerary")}.ics`,
    count: events.length,
    breakdown,
  };
}

function isStay(b: PlaceBlock): boolean {
  return !!b.category && STAY_CATEGORIES.has(b.category);
}

function flightEvent(
  b: FlightBlock,
  index: number,
  trip: TripView,
  fallbackStart: Date | null,
): string | null {
  const baseDate = parseDate(b.date) ?? fallbackStart;
  if (!baseDate) return null;

  const depart = applyTime(baseDate, b.departTime);
  if (!depart) return null;

  const arriveDate = parseDate(b.arriveDate) ?? baseDate;
  let end = applyTime(arriveDate, b.arriveTime);
  if (!end || end.getTime() <= depart.getTime()) {
    // No usable arrival → estimate a 2h flight so the event has duration.
    end = new Date(depart.getTime() + 2 * 60 * 60 * 1000);
  }

  const route =
    [b.from, b.to].filter(Boolean).join(" → ") ||
    [b.fromCity, b.toCity].filter(Boolean).join(" → ");
  const flightId = [b.airline, b.flightNumber].filter(Boolean).join(" ");
  const summary = ["✈︎", flightId, route].filter(Boolean).join("  ").trim() || "Flight";

  const description = [
    flightId && `Flight: ${flightId}`,
    b.confirmation && `Confirmation: ${b.confirmation}`,
    b.seat && `Seat: ${b.seat}`,
    b.boardingGroup && `Boarding group: ${b.boardingGroup}`,
    b.boardingTime && `Boarding: ${b.boardingTime}`,
    b.gate && `Gate: ${b.gate}`,
    b.baggage && `Baggage: ${b.baggage}`,
    b.passenger && `Passenger: ${b.passenger}`,
    b.note,
  ]
    .filter(Boolean)
    .join("\n");

  const location = [b.fromCity, b.toCity].filter(Boolean).join(" → ") || route;

  return wrapVEvent({
    uid: `${slugify(trip.slug ?? "trip")}-flight-${index}@traveldoss`,
    summary,
    description,
    location,
    start: formatLocal(depart),
    end: formatLocal(end),
    allDay: false,
  });
}

function stayEvent(b: PlaceBlock, index: number, trip: TripView): string | null {
  // We need at least a check-in date to anchor the event.
  const tripStart = parseDate(trip.start_date ?? null);
  const tripEnd = parseDate(trip.end_date ?? null);

  // checkIn / checkOut may be either a full date ("2026-06-12") or a time
  // ("15:00"). Try date first, then fall back to trip bounds + time.
  const inDate = parseDate(b.checkIn) ?? tripStart;
  const outDate = parseDate(b.checkOut) ?? tripEnd ?? inDate;
  if (!inDate) return null;

  const checkInTime = onlyTime(b.checkIn);
  const checkOutTime = onlyTime(b.checkOut);

  let start: Date;
  let end: Date;
  let allDay: boolean;

  if (checkInTime || checkOutTime) {
    start = applyTime(inDate, checkInTime ?? "15:00") ?? inDate;
    const endBase = outDate ?? inDate;
    end = applyTime(endBase, checkOutTime ?? "11:00") ?? new Date(start.getTime() + 60 * 60 * 1000);
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }
    allDay = false;
  } else {
    // All-day stay spanning inDate → outDate (exclusive end per RFC 5545).
    start = inDate;
    const endBase = outDate && outDate.getTime() >= inDate.getTime() ? outDate : inDate;
    end = new Date(endBase.getTime() + 24 * 60 * 60 * 1000);
    allDay = true;
  }

  const description = [
    b.address && `Address: ${b.address}`,
    b.phone && `Phone: ${b.phone}`,
    b.website && `Website: ${b.website}`,
    b.reservation && `Reservation: ${b.reservation}`,
    b.checkIn && `Check-in: ${b.checkIn}`,
    b.checkOut && `Check-out: ${b.checkOut}`,
    b.amenities && `Amenities: ${b.amenities}`,
    b.note,
    b.mapsUrl,
  ]
    .filter(Boolean)
    .join("\n");

  return wrapVEvent({
    uid: `${slugify(trip.slug ?? "trip")}-stay-${index}@traveldoss`,
    summary: `🛏 ${b.name}`.trim(),
    description,
    location: b.address ?? "",
    start: allDay ? formatDate(start) : formatLocal(start),
    end: allDay ? formatDate(end) : formatLocal(end),
    allDay,
    url: b.website || b.mapsUrl,
  });
}

/* ─── helpers ──────────────────────────────────────────────────────── */

function wrapVEvent(opts: {
  uid: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  url?: string;
}): string {
  const dtKey = opts.allDay ? ";VALUE=DATE" : "";
  const lines = [
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART${dtKey}:${opts.start}`,
    `DTEND${dtKey}:${opts.end}`,
    `SUMMARY:${escapeText(opts.summary)}`,
  ];
  if (opts.location) lines.push(`LOCATION:${escapeText(opts.location)}`);
  if (opts.description) lines.push(`DESCRIPTION:${escapeText(opts.description)}`);
  if (opts.url) lines.push(`URL:${escapeText(opts.url)}`);
  lines.push("END:VEVENT");
  return lines.map(foldLine).join("\r\n");
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** RFC 5545 line folding at 75 octets. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    chunks.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
    i += 73;
  }
  return chunks.join("\r\n");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatLocal(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function formatUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function parseDate(input?: string | null): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Pure ISO date "YYYY-MM-DD" → construct as local midnight.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  // Time-only? Don't treat as a date.
  if (/^\d{1,2}:\d{2}(\s?(am|pm))?$/i.test(trimmed)) return null;
  const t = Date.parse(trimmed);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

function onlyTime(input?: string | null): string | null {
  if (!input) return null;
  const m = /^(\d{1,2}):(\d{2})(\s?(am|pm))?$/i.exec(input.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[4]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return `${pad(h)}:${pad(min)}`;
}

function applyTime(base: Date | null, time?: string | null): Date | null {
  if (!base) return null;
  const out = new Date(base);
  const t = onlyTime(time ?? null);
  if (!t) {
    out.setHours(0, 0, 0, 0);
    return out;
  }
  const [h, m] = t.split(":").map(Number);
  out.setHours(h, m, 0, 0);
  return out;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "itinerary";
}

export function downloadIcs(result: IcsBuildResult): void {
  const blob = new Blob([result.ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}