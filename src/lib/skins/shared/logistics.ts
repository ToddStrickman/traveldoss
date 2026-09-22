import type { Block, TripView } from "../types";
import { flightDuration, parseFlightDate } from "./airportTz";

export type LogisticsFlight = {
  id: string;
  blockIndex: number;
  flight: Extract<Block, { kind: "flight" }>;
  start: number;
  end: number;
  departureDay: number;
  arrivalDay: number;
  fallback: boolean;
  duration?: string;
};

export type LogisticsStay = {
  id: string;
  blockIndex: number;
  hotel: Extract<Block, { kind: "place" }>;
  start: number;
  end: number;
  fromDay: number;
  toDay: number;
  nights: number;
  shadeIndex: 0 | 1;
  checkInDate?: string;
  checkOutDate?: string;
};

export type LogisticsGap = { id: string; start: number; end: number; night: number };

export type LogisticsDay = {
  index: number;
  n: number;
  date?: string;
  city?: string;
  cityChanged: boolean;
  today: boolean;
};

export type TripLogistics = {
  days: LogisticsDay[];
  flights: LogisticsFlight[];
  stays: LogisticsStay[];
  gaps: LogisticsGap[];
  homeCity?: string;
};

const STAY_CATEGORIES = new Set(["accommodation", "stay", "hotel"]);
const DAY_MS = 86_400_000;

export function timeFraction(value: string | undefined, fallback: number): number {
  const raw = value?.trim();
  if (!raw) return fallback;
  const match = /^(\d{1,2})(?::|\.)(\d{2})\s*(am|pm)?$/i.exec(raw);
  if (!match) return fallback;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return fallback;
  return (hours * 60 + minutes) / 1_440;
}

function dateKey(value?: string): number | undefined {
  const parsed = parseFlightDate(value);
  if (!parsed) return undefined;
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function dayOffset(days: LogisticsDay[], value: string | undefined, fallback: number): number {
  const target = dateKey(value);
  if (target == null) return fallback;
  const exact = days.findIndex((day) => dateKey(day.date) === target);
  if (exact >= 0) return exact;
  const first = dateKey(days[0]?.date);
  if (first == null) return fallback;
  return Math.max(0, Math.min(days.length - 1, Math.round((target - first) / DAY_MS)));
}

function cityFromStay(stay: Extract<Block, { kind: "place" }> | undefined): string | undefined {
  if (!stay) return undefined;
  const address = stay.address?.split(",").map((part) => part.trim()).filter(Boolean);
  if (address && address.length > 1) return address[address.length - 2] ?? address.at(-1);
  return undefined;
}

function authoredStayDay(stay: Extract<Block, { kind: "place" }>, fallback: number, dayCount: number): number {
  const text = [stay.reservation, stay.note].filter(Boolean).join(" ");
  const match = /\bday\s+(\d+)\b/i.exec(text);
  if (!match) return fallback;
  return Math.max(0, Math.min(dayCount - 1, Number(match[1]) - 1));
}

/** Pure projection used by every logistics surface. Geometry is measured in
 * day-column units: 0.5 is noon on the first day, 1.5 noon on the second. */
export function getTripLogistics(trip: TripView, blocks: Block[], now = new Date()): TripLogistics {
  const dayBlocks = blocks.filter((block): block is Extract<Block, { kind: "day" }> => block.kind === "day");
  const days: LogisticsDay[] = dayBlocks.map((day, index) => ({
    index,
    n: day.n,
    date: day.date,
    cityChanged: false,
    today: dateKey(day.date) === Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  }));
  if (days.length === 0) return { days, flights: [], stays: [], gaps: [] };

  type RawStay = { hotel: Extract<Block, { kind: "place" }>; blockIndex: number; day: number };
  const rawStays: RawStay[] = [];
  let currentDay = 0;
  blocks.forEach((block, blockIndex) => {
    if (block.kind === "day") {
      const found = dayBlocks.indexOf(block);
      currentDay = found >= 0 ? found : currentDay;
    } else if (block.kind === "place" && block.category && STAY_CATEGORIES.has(block.category)) {
      const previous = rawStays.at(-1);
      if (previous?.hotel.name.trim().toLowerCase() !== block.name.trim().toLowerCase()) {
        rawStays.push({ hotel: block, blockIndex, day: authoredStayDay(block, currentDay, days.length) });
      }
    }
  });

  const stays: LogisticsStay[] = rawStays.map((entry, index) => {
    const nextDay = rawStays[index + 1]?.day;
    const fromDay = Math.max(0, Math.min(days.length - 1, entry.day));
    const toDay = nextDay != null && nextDay > fromDay ? nextDay : days.length;
    const checkIn = timeFraction(entry.hotel.checkIn, 15 / 24);
    const checkOut = timeFraction(entry.hotel.checkOut, 11 / 24);
    return {
      id: `stay-${entry.blockIndex}`,
      blockIndex: entry.blockIndex,
      hotel: entry.hotel,
      start: fromDay + checkIn,
      end: Math.max(fromDay + checkIn + 1 / 24, toDay + checkOut),
      fromDay,
      toDay,
      nights: Math.max(1, toDay - fromDay),
      shadeIndex: (index % 2) as 0 | 1,
      checkInDate: days[fromDay]?.date,
      checkOutDate: days[Math.min(toDay, days.length - 1)]?.date,
    };
  });

  const flights: LogisticsFlight[] = [];
  blocks.forEach((block, blockIndex) => {
    if (block.kind !== "flight") return;
    const directionFallback = block.direction === "inbound" ? days.length - 1 : 0;
    const departureDay = dayOffset(days, block.date, directionFallback);
    const arrivalDay = dayOffset(days, block.arriveDate ?? block.date, departureDay);
    const start = departureDay + timeFraction(block.departTime, 0);
    const naturalEnd = arrivalDay + timeFraction(block.arriveTime, 1);
    const fallback = naturalEnd <= start;
    flights.push({
      id: `flight-${blockIndex}`,
      blockIndex,
      flight: block,
      start,
      end: fallback ? Math.min(days.length, start + 0.32) : naturalEnd,
      departureDay,
      arrivalDay,
      fallback,
      duration: flightDuration(block.date, block.departTime, block.arriveTime, block.from, block.to, block.arriveDate),
    });
  });

  for (const day of days) {
    const stay = stays.find((item) => item.fromDay <= day.index && item.toDay > day.index);
    const arriving = flights.find((item) => item.arrivalDay <= day.index && item.flight.toCity);
    day.city = cityFromStay(stay?.hotel) ?? arriving?.flight.toCity;
    const previous = days[day.index - 1]?.city;
    day.cityChanged = !!day.city && day.city !== previous;
  }

  const gaps: LogisticsGap[] = [];
  for (let night = 0; night < Math.max(0, days.length - 1); night += 1) {
    const covered = stays.some((stay) => stay.fromDay <= night && stay.toDay > night);
    const inTransit = flights.some((flight) => flight.start < night + 1 && flight.end > night + 1);
    if (!covered && !inTransit) gaps.push({ id: `gap-${night}`, start: night + 0.5, end: night + 1.5, night });
  }

  return {
    days,
    flights,
    stays,
    gaps,
    homeCity: flights[0]?.flight.fromCity ?? cityFromStay(stays[0]?.hotel),
  };
}