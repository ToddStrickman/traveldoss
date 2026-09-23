import type { Block } from "@/lib/skins/types";

export type DossierProgressPreview = {
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  dateLine: string | null;
  counts: {
    days: number;
    stops: number;
    flights: number;
    hotels: number;
  };
  highlights: string[];
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function collectDates(blocks: Block[]): { startDate: string | null; endDate: string | null } {
  const datedDays = blocks
    .filter((b): b is Extract<Block, { kind: "day" }> => b.kind === "day")
    .map((b) => clean(b.date))
    .filter((d): d is string => !!d);
  if (datedDays.length) {
    return { startDate: datedDays[0], endDate: datedDays[datedDays.length - 1] };
  }

  const datedFlights = blocks
    .filter((b): b is Extract<Block, { kind: "flight" }> => b.kind === "flight")
    .flatMap((b) => [clean(b.date), clean(b.arriveDate)])
    .filter((d): d is string => !!d);
  return {
    startDate: datedFlights[0] ?? null,
    endDate: datedFlights[datedFlights.length - 1] ?? null,
  };
}

function dateLine(startDate: string | null, endDate: string | null): string | null {
  if (startDate && endDate && startDate !== endDate) return `${startDate} – ${endDate}`;
  if (startDate) return startDate;
  if (endDate) return endDate;
  return null;
}

export function buildDossierProgressPreview({
  blocks = [],
  destination,
  dates,
  fallbackTitle = "Dossier taking shape",
}: {
  blocks?: Block[];
  destination?: string | null;
  dates?: { startDate?: string | null; endDate?: string | null } | null;
  fallbackTitle?: string;
}): DossierProgressPreview {
  const fromBlocks = collectDates(blocks);
  const startDate = clean(dates?.startDate) ?? fromBlocks.startDate;
  const endDate = clean(dates?.endDate) ?? fromBlocks.endDate;
  const days = blocks.filter((b) => b.kind === "day");
  const places = blocks.filter((b) => b.kind === "place");
  const flights = blocks.filter((b) => b.kind === "flight");
  const hotels = places.filter(
    (b) => b.kind === "place" && (b.category === "accommodation" || b.category === "stay" || b.category === "hotel"),
  );
  const highlights = [
    ...days.map((b) => clean(b.label)).filter((v): v is string => !!v),
    ...places.map((b) => clean(b.name)).filter((v): v is string => !!v),
  ].slice(0, 4);
  const title = clean(destination) ?? clean(fallbackTitle) ?? "Dossier taking shape";

  return {
    title,
    destination: clean(destination),
    startDate,
    endDate,
    dateLine: dateLine(startDate, endDate),
    counts: {
      days: days.length,
      stops: places.length,
      flights: flights.length,
      hotels: hotels.length,
    },
    highlights,
  };
}