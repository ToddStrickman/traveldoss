import type { Block } from "@/lib/skins/types";
import { LinkifiedText } from "@/lib/skins/shared/views/parts";

/** Active-phase banner pinned above the dossier. Surfaces the next reservation
 *  with its confirmation # and a maps link. */
export function CompanionToday({ blocks }: { blocks: Block[] }) {
  const next = pickNext(blocks);
  if (!next) return null;
  return (
    <div data-print="hide" className="sticky top-0 z-30 border-b border-seal/30 bg-paper/95 px-6 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-seal" />
          <div>
            <p className="text-[9px] uppercase tracking-[0.4em] text-seal">Today</p>
            <p className="text-sm text-ink" style={{ fontFamily: "var(--font-display)" }}>
              {next.title}
            </p>
            {next?.sub && (
              <p className="text-[11px] text-ink-soft">
                <LinkifiedText text={next.sub} />
              </p>
            )}
          </div>
        </div>
        {next?.mapsUrl && (
          <a
            href={next.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-seal/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] text-seal transition-elegant hover:bg-seal hover:text-paper"
          >
            Open in Maps →
          </a>
        )}
      </div>
    </div>
  );
}

function pickNext(blocks: Block[]): { title: string; sub?: string; mapsUrl?: string } | null {
  const flight = blocks.find((b) => b.kind === "flight");
  if (flight && flight.kind === "flight") {
    return {
      title: `${flight.airline ?? "Flight"} ${flight.flightNumber ?? ""} · ${flight.from ?? ""}→${flight.to ?? ""}`,
      sub: [flight.date, flight.departTime, flight.confirmation && `Conf ${flight.confirmation}`].filter(Boolean).join(" · "),
    };
  }
  const place = blocks.find((b) => b.kind === "place");
  if (place && place.kind === "place") {
    const q = encodeURIComponent([place.name, place.address].filter(Boolean).join(" "));
    return {
      title: place.name,
      sub: place.address ?? place.note ?? undefined,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${q}`,
    };
  }
  return null;
}