/**
 * Calendar quick reference — plan around the trip, not just read it.
 *
 * The day-by-day rails answer "what happens on day 3". They don't answer
 * "which day am I free" or "when am I moving cities". This surfaces the trip
 * as dates: a strip of the trip's days with markers for flights, stops and
 * the hotel night, and an agenda underneath with times in order.
 *
 * Read-only mirror of the same blocks; nothing here edits the dossier.
 */
import { useMemo, useRef, useState } from "react";
import { CalendarDays, Plane } from "lucide-react";
import type { Block } from "../types";
import { TdSheet } from "@/components/mobile/TdSheet";
import { dayDateLabel, useInertRender } from "./views/parts";
import { resolveCategoryIcon, HotelIcon } from "./CategoryIcon";
import { trackCalendarDayJumped, trackCalendarQuickRefOpened } from "@/lib/analytics";

type PlaceBlock = Extract<Block, { kind: "place" }>;
type FlightBlock = Extract<Block, { kind: "flight" }>;

const STAY_CATEGORIES = new Set(["accommodation", "stay", "hotel"]);

export type CalendarStop = { place: PlaceBlock; index: number };

export type CalendarDay = {
  /** Authored day number (1-based). */
  n: number;
  label?: string;
  date?: string;
  /** Position of this day among the trip's days, for scroll targeting. */
  dayPos: number;
  flights: FlightBlock[];
  /** Hotel for this night, when the day names one. */
  hotel?: PlaceBlock;
  /** Timed stops first (sorted), then untimed — never a fabricated time. */
  timed: CalendarStop[];
  untimed: CalendarStop[];
};

function isStayCategory(category?: string): boolean {
  return !!category && STAY_CATEGORIES.has(category);
}

/** "14:20" / "9:05 AM" → comparable minutes; undefined when unparseable. */
function timeKey(raw?: string): number | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  const m = /^(\d{1,2})[:.](\d{2})\s*(am|pm)?/i.exec(t) ?? /^(\d{1,2})\s*(am|pm)/i.exec(t);
  if (!m) return undefined;
  let h = Number(m[1]);
  const hasMinutes = /[:.]/.test(t.slice(0, 3));
  const min = hasMinutes ? Number(m[2]) : 0;
  const mer = (hasMinutes ? m[3] : m[2])?.toLowerCase();
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  if (!Number.isFinite(h) || !Number.isFinite(min)) return undefined;
  return h * 60 + min;
}

/**
 * Group the flat block list by day for calendar purposes. Unlike
 * buildItinerary (which lifts both flight legs out of the stream for the
 * summary strip), flights stay attached to the day they happen on — that is
 * the whole point of a calendar. Flights before any day header belong to the
 * first day, which is where arrival legs are usually authored.
 */
export function buildCalendarDays(blocks: Block[]): CalendarDay[] {
  const days: CalendarDay[] = [];
  const prefaceFlights: FlightBlock[] = [];
  let current: CalendarDay | null = null;

  blocks.forEach((b, index) => {
    if (b.kind === "day") {
      current = {
        n: b.n,
        label: b.label,
        date: b.date,
        dayPos: days.length,
        flights: [],
        timed: [],
        untimed: [],
      };
      days.push(current);
      return;
    }
    if (b.kind === "flight") {
      if (current) current.flights.push(b);
      else prefaceFlights.push(b);
      return;
    }
    if (b.kind !== "place" || !current) return;
    const place: PlaceBlock = b;
    const day = current;
    // Plan-B alternatives never belong in a calendar.
    if (place.tier === "shadow") return;
    if (isStayCategory(place.category)) {
      if (!day.hotel) day.hotel = place;
      return;
    }
    const entry: CalendarStop = { place, index };
    if (timeKey(place.time) != null) day.timed.push(entry);
    else day.untimed.push(entry);
  });

  if (prefaceFlights.length > 0 && days[0]) {
    days[0].flights = [...prefaceFlights, ...days[0].flights];
  }

  for (const d of days) {
    d.timed.sort((a, b) => (timeKey(a.place.time) ?? 0) - (timeKey(b.place.time) ?? 0));
  }
  return days;
}

/** Short strip label: "Mon 14" for ISO dates, the day number otherwise. */
export function stripLabel(day: CalendarDay): { top: string; bottom: string } {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec((day.date ?? "").trim());
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(d.getTime())) {
      return {
        top: d.toLocaleDateString("en-US", { weekday: "short" }),
        bottom: String(d.getDate()),
      };
    }
  }
  return { top: "Day", bottom: String(day.n) };
}

function flightLine(f: FlightBlock): string {
  const route = [f.from ?? f.fromCity, f.to ?? f.toCity].filter(Boolean).join(" → ");
  const code = [f.airline, f.flightNumber].filter(Boolean).join(" ");
  return [route, code].filter(Boolean).join(" · ") || "Flight";
}

/* ------------------------------------------------------------------ */

/** Quick-reference entry point. Hidden when there is nothing to plan around. */
export function CalendarQuickRef({ blocks }: { blocks: Block[] }) {
  const inert = useInertRender();
  const days = useMemo(() => buildCalendarDays(blocks), [blocks]);
  const [open, setOpen] = useState(false);
  const agendaRef = useRef<HTMLDivElement | null>(null);

  const hasFlights = days.some((d) => d.flights.length > 0);
  const hasContent = days.length > 0 && (hasFlights || days.some((d) => d.date));
  if (inert || !hasContent) return null;

  const jumpAgenda = (dayPos: number) => {
    trackCalendarDayJumped();
    const el = agendaRef.current?.querySelector<HTMLElement>(`[data-agenda-day="${dayPos}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const jumpItinerary = (dayPos: number) => {
    setOpen(false);
    // Day sections are rendered in order by every view; target by position
    // rather than inventing ids the views don't carry.
    window.setTimeout(() => {
      const sections = document.querySelectorAll<HTMLElement>('[data-block="day"]');
      sections[dayPos]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 220);
  };

  return (
    <div className="tds-calref" data-print="hide">
      <button
        type="button"
        className="tds-calref-btn tap"
        onClick={() => {
          setOpen(true);
          trackCalendarQuickRefOpened({ day_count: days.length, has_flights: hasFlights });
        }}
      >
        <span className="tds-calref-icon" aria-hidden>
          <CalendarDays size={17} />
        </span>
        <span>Calendar</span>
        <span className="tds-calref-count">{days.length}</span>
      </button>

      <TdSheet
        open={open}
        onOpenChange={setOpen}
        title="Calendar"
        description="Every day of the trip, with times."
        snapHeight="full"
      >
        <div className="tds-calref-panel">
          <div className="tds-calstrip" role="list" aria-label="Trip dates">
            {days.map((d) => {
              const l = stripLabel(d);
              return (
                <button
                  key={d.dayPos}
                  type="button"
                  role="listitem"
                  className="tds-calstrip-cell tap"
                  onClick={() => jumpAgenda(d.dayPos)}
                  data-hotel={d.hotel ? "" : undefined}
                >
                  <span className="tds-calstrip-top">{l.top}</span>
                  <span className="tds-calstrip-bottom">{l.bottom}</span>
                  {/* Reserved marker line so the strip never shifts. */}
                  <span className="tds-calstrip-marks" aria-hidden>
                    {d.flights.length > 0 ? <Plane size={10} /> : null}
                    {d.timed.length + d.untimed.length > 0 ? (
                      <span className="tds-calstrip-dot" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="tds-calagenda" ref={agendaRef}>
            {days.map((d) => (
              <section key={d.dayPos} data-agenda-day={d.dayPos} className="tds-calday">
                <header className="tds-calday-head">
                  <h3>{d.label || `Day ${String(d.n).padStart(2, "0")}`}</h3>
                  <p>{dayDateLabel(d.date)}</p>
                </header>

                {d.flights.map((f, i) => (
                  <div key={`f${i}`} className="tds-calrow">
                    <span className="tds-calrow-time">{f.departTime || "—"}</span>
                    <span className="tds-calrow-icon" aria-hidden>
                      <Plane size={14} />
                    </span>
                    <span className="tds-calrow-body">{flightLine(f)}</span>
                  </div>
                ))}

                {d.hotel ? (
                  <div className="tds-calrow">
                    <span className="tds-calrow-time">{d.hotel.checkIn || "—"}</span>
                    <span className="tds-calrow-icon" aria-hidden>
                      <HotelIcon />
                    </span>
                    <span className="tds-calrow-body">{d.hotel.name}</span>
                  </div>
                ) : null}

                {[...d.timed, ...d.untimed].map(({ place, index }) => {
                  const Icon =
                    resolveCategoryIcon(
                      place.category,
                      [place.name, place.note].filter(Boolean).join(" "),
                    ) ?? null;
                  return (
                    <button
                      key={index}
                      type="button"
                      className="tds-calrow tds-calrow-tap tap"
                      onClick={() => jumpItinerary(d.dayPos)}
                    >
                      <span className="tds-calrow-time">{place.time || "—"}</span>
                      <span className="tds-calrow-icon" aria-hidden>
                        {Icon ? <Icon /> : <span className="tds-calrow-dot" />}
                      </span>
                      <span className="tds-calrow-body">{place.name}</span>
                    </button>
                  );
                })}

                {d.flights.length === 0 &&
                !d.hotel &&
                d.timed.length === 0 &&
                d.untimed.length === 0 ? (
                  <p className="tds-calday-empty">Nothing planned yet.</p>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </TdSheet>
    </div>
  );
}
