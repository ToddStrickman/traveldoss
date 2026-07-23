import type { Block, GalleryImage, TripView } from "../../types";
import { buildItinerary, PART_LABEL } from "../itinerary";
import { ActivityCell, PART_ICON, CarouselLightbox } from "./parts";
import { ActivityDndContext, DraggableActivity, DroppableBucket } from "./dnd";
import type { PartOfDay } from "../itinerary";
import { ShadowItinerary, PlanBCue } from "../ShadowItinerary";
import { BlankDayScaffold, isScaffoldTriggered } from "../BlankDayScaffold";
import { useEditing } from "../Editable";
import { Pencil, Copy, Check, ChevronDown, ExternalLink, Images } from "lucide-react";
import { FlightEditSheet } from "../ActivityEditSheet";
import { AirfareIcon } from "../CategoryIcon";
import { useCallback, useState, type ReactNode } from "react";
import { airportTzLabel, flightDuration } from "../airportTz";
import {
  EditableHero,
  EditableDayHeader,
  AddActivitySlot,
  AddDayButton,
  useAddActivity,
  useAddDay,
  CollapseToggle,
  useMoveDay,
  useDeleteDay,
  buildSuggestContext,
} from "./editing-kit";

/** Grid flight row with the shared edit sheet behind a pencil (the grid
 *  table was fully read-only; flights had no editor in ANY view). */
function FlightTableRow({
  leg,
  f,
  index,
  editing,
}: {
  leg: string;
  f: Extract<Block, { kind: "flight" }>;
  index?: number;
  editing: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const flightNo = [f.airline, f.flightNumber].filter(Boolean).join(" ");
  const depTz = airportTzLabel(f.from, f.date);
  const arrTz = airportTzLabel(f.to, f.arriveDate ?? f.date);
  const duration = flightDuration(f.date, f.departTime, f.arriveTime, f.from, f.to, f.arriveDate);
  const details: Array<{ label: string; value: ReactNode }> = [];
  if (duration) details.push({ label: "Duration", value: duration });
  if (f.fareClass) details.push({ label: "Class", value: f.fareClass });
  if (f.seat) details.push({ label: "Seat", value: f.seat });
  if (f.boardingGroup) details.push({ label: "Boarding group", value: f.boardingGroup });
  if (f.boardingTime) details.push({ label: "Boarding time", value: f.boardingTime });
  if (f.gate) details.push({ label: "Gate", value: f.gate });
  if (f.baggage) details.push({ label: "Baggage", value: f.baggage });
  if (f.passenger) details.push({ label: "Passenger", value: f.passenger });
  if (f.price) details.push({ label: "Price", value: f.price });
  if (f.arriveDate) details.push({ label: "Arrival date", value: f.arriveDate });
  if (f.airline) {
    const q = encodeURIComponent(`${f.airline} customer service contact`);
    details.push({
      label: "Airline contact",
      value: (
        <a
          href={`https://www.google.com/search?q=${q}`}
          target="_blank"
          rel="noopener noreferrer"
          className="tds-flight-detail-link"
        >
          {f.airline} <ExternalLink size={11} aria-hidden />
        </a>
      ),
    });
  }
  if (f.note) details.push({ label: "Notes", value: f.note });
  const hasDetails = details.length > 0;
  return (
    <>
    <tr>
      <td className="tds-td-strong">
        <span className="inline-flex items-center gap-1.5">
          {hasDetails ? (
            <button
              type="button"
              className="tds-flight-disclose tap"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? `Hide ${leg.toLowerCase()} flight details` : `Show ${leg.toLowerCase()} flight details`}
              title={open ? "Hide details" : "Show details"}
              data-open={open || undefined}
            >
              <ChevronDown size={12} aria-hidden />
            </button>
          ) : null}
          {leg}
          {editing && index != null ? (
            <>
              <button
                type="button"
                className="tds-act-delete tap"
                data-print="hide"
                onClick={() => setEditOpen(true)}
                aria-label={`Edit ${leg.toLowerCase()} flight`}
                title="Edit flight details"
              >
                <Pencil size={12} aria-hidden />
              </button>
              {editOpen ? (
                <FlightEditSheet flight={f} index={index} open={editOpen} onOpenChange={setEditOpen} />
              ) : null}
            </>
          ) : null}
        </span>
      </td>
      <td>
        {flightNo ? (
          <span className="tds-flight-copy-cell">
            <span>{flightNo}</span>
            {f.flightNumber ? (
              <CopyChip value={f.flightNumber} label="flight number" />
            ) : null}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td>{[f.from, f.to].filter(Boolean).join(" → ") || "—"}</td>
      <td>{f.date ?? "—"}</td>
      <td>
        {f.departTime ? (
          <span
            className="tds-flight-time"
            title={depTz ? `Local time at ${f.from ?? "origin"}` : undefined}
          >
            <span>{f.departTime}</span>
            {depTz ? <span className="tds-flight-tz">{depTz}</span> : null}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td>
        {f.arriveTime ? (
          <span
            className="tds-flight-time"
            title={arrTz ? `Local time at ${f.to ?? "destination"}` : undefined}
          >
            <span>{f.arriveTime}</span>
            {arrTz ? <span className="tds-flight-tz">{arrTz}</span> : null}
            {f.arriveDate ? <span className="tds-flight-nextday" aria-label={`arrives ${f.arriveDate}`}>+</span> : null}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td>
        {f.confirmation ? (
          <span className="tds-flight-copy-cell">
            <span>{f.confirmation}</span>
            <CopyChip value={f.confirmation} label="confirmation code" />
          </span>
        ) : (
          "—"
        )}
      </td>
    </tr>
    {hasDetails && open ? (
      <tr className="tds-flight-details-row">
        <td colSpan={7}>
          <dl className="tds-flight-details">
            {details.map(({ label, value }) => (
              <div key={label} className="tds-flight-detail">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </td>
      </tr>
    ) : null}
    </>
  );
}

/** One-tap copy for a short value (flight #, confirmation). Icon-only,
 *  keyboard-accessible, gives a 1.4s "copied" affordance. */
function CopyChip({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — value is still visible next to the chip */
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      data-print="hide"
      className="tds-copy-chip tap"
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
    >
      {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
    </button>
  );
}

// PART_ICON / PART_LABEL come from parts.tsx / itinerary.ts — one icon
// set for parts of day across every view (icon-parity item).

type GridDay = {
  dayIndex: number;
  day: { n: number; label: string; images?: GalleryImage[] };
  morning: Array<{ activity: { name: string; images?: GalleryImage[] } }>;
  afternoon: Array<{ activity: { name: string; images?: GalleryImage[] } }>;
  evening: Array<{ activity: { name: string; images?: GalleryImage[] } }>;
};

/** Every photo attached to a day, captioned by where it lives — day-level
 *  images first, then each part's activity photos in itinerary order. */
function collectDayPhotos(d: GridDay): GalleryImage[] {
  const out: GalleryImage[] = [];
  for (const im of d.day.images ?? []) {
    out.push({ ...im, caption: im.caption ?? `Day ${d.day.n}` });
  }
  for (const part of ["morning", "afternoon", "evening"] as const) {
    for (const { activity } of d[part]) {
      for (const im of activity.images ?? []) {
        out.push({
          ...im,
          caption: im.caption ?? `Day ${d.day.n} · ${PART_LABEL[part]} — ${activity.name}`,
        });
      }
    }
  }
  return out;
}

/** Small shimmer-swept icon in the grid's day header: signals that this
 *  day carries photos; opens them in the fullscreen lightbox carousel. */
function DayPhotosButton({ d }: { d: GridDay }) {
  const [open, setOpen] = useState(false);
  const photos = collectDayPhotos(d);
  if (photos.length === 0) return null;
  return (
    <>
      <button
        type="button"
        className="tds-day-photos-btn tap"
        data-print="hide"
        onClick={() => setOpen(true)}
        aria-label={`View ${photos.length} photo${photos.length === 1 ? "" : "s"} from Day ${d.day.n}`}
        title={`Photos — Day ${String(d.day.n).padStart(2, "0")}`}
      >
        <Images size={12} aria-hidden />
        <span className="tds-day-photos-count">{photos.length}</span>
      </button>
      {open ? (
        <CarouselLightbox images={photos} startIndex={0} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

/** Operational table view. Desktop: dense 3-col table per day. Mobile:
 *  three stacked "Morning / Afternoon / Evening" cards with iconography —
 *  more decisive framing than a cramped 3-col table at 375px. Editable
 *  everywhere. */
export function GridView({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const it = buildItinerary(blocks);
  const { editing } = useEditing();
  const showScaffold = editing && isScaffoldTriggered(blocks);
  const addActivity = useAddActivity(blocks);
  const addDay = useAddDay(blocks);
  const moveDay = useMoveDay(blocks);
  const deleteDay = useDeleteDay(blocks);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const togglePart = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const flights: Array<{
    leg: string;
    f: NonNullable<typeof it.flights.outbound>;
    index?: number;
  }> = [];
  if (it.flights.outbound)
    flights.push({ leg: "Outbound", f: it.flights.outbound, index: it.flights.outboundIndex });
  if (it.flights.inbound)
    flights.push({ leg: "Inbound", f: it.flights.inbound, index: it.flights.inboundIndex });

  return (
    <div className="tds-grid-view">
      <EditableHero trip={trip} className="tds-hero tds-grid-head" />

      {showScaffold ? (
        <BlankDayScaffold blocks={blocks} />
      ) : (
        <>
      {flights.length > 0 ? (
        <section className="tds-grid-section tds-flights-boarding">
          <h2 className="tds-grid-h2 tds-flights-h2">
            <AirfareIcon className="tds-flights-h2-icon" aria-hidden />
            <span>Flights</span>
          </h2>
          <div className="tds-table-scroll tds-boarding-pass">
          <span className="tds-boarding-notch tds-boarding-notch-l" aria-hidden />
          <span className="tds-boarding-notch tds-boarding-notch-r" aria-hidden />
          <table className="tds-table tds-table-flights">
            <thead>
              <tr>
                <th>Leg</th>
                <th>Airline</th>
                <th>From → To</th>
                <th>Date</th>
                <th title="Local time at origin airport">Depart<span className="tds-flight-th-hint"> · local</span></th>
                <th title="Local time at destination airport">Arrive<span className="tds-flight-th-hint"> · local</span></th>
                <th>Conf.</th>
              </tr>
            </thead>
            <tbody>
              {flights.map(({ leg, f, index }) => (
                <FlightTableRow key={leg} leg={leg} f={f} index={index} editing={editing} />
              ))}
            </tbody>
          </table>
          </div>
        </section>
      ) : null}

      {it.preface.length > 0 ? (
        <section className="tds-grid-section">
          <h2 className="tds-grid-h2">Essentials</h2>
          <div className="tds-grid-essentials">
            {it.preface.map(({ activity, index }) => (
              <ActivityCell key={index} activity={activity} index={index} />
            ))}
          </div>
        </section>
      ) : null}

      <ActivityDndContext blocks={blocks}>
      {it.days.map((d, dPos) => (
        <section
          key={d.dayIndex}
          className="tds-grid-section"
          data-block="day"
          data-collapsed={collapsed.has(`day:${d.dayIndex}`) || undefined}
        >
          <EditableDayHeader
            d={d}
            className="tds-grid-day-head"
            collapsed={collapsed.has(`day:${d.dayIndex}`)}
            onToggleCollapsed={() => togglePart(`day:${d.dayIndex}`)}
            onMoveDay={(dir) => moveDay(d.dayIndex, dir)}
            canMoveUp={dPos > 0}
            canMoveDown={dPos < it.days.length - 1}
            onDeleteDay={() => deleteDay(d.dayIndex)}
            extraChip={<DayPhotosButton d={d} />}
          />
          <PlanBCue count={d.shadows.length} />

          {/* Desktop: dense 3-col table. Hidden on mobile via CSS. */}
          <div className="tds-table-scroll tds-grid-desktop-only">
          <table className="tds-table tds-table-day">
            <thead>
              <tr>
                {(["morning", "afternoon", "evening"] as PartOfDay[]).map((part) => {
                  const Icon = PART_ICON[part];
                  return (
                    <th key={part}>
                      <span className="tds-th-part">
                        <Icon size={12} strokeWidth={1.6} aria-hidden />
                        <span>{PART_LABEL[part]}</span>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {(["morning", "afternoon", "evening"] as PartOfDay[]).map((part) => {
                  const list = d[part];
                  return (
                    <DroppableBucket key={part} as="td" dayIndex={d.dayIndex} part={part}>
                      <details className="tds-grid-disclosure" open>
                        <summary>
                          <span>{part}{list.length > 0 ? ` · ${list.length}` : ""}</span>
                        </summary>
                        <div className="tds-grid-disclosure-body">
                          {list.length === 0 && !editing ? (
                            <span className="tds-td-muted">—</span>
                          ) : (
                            list.map(({ activity, index }) => (
                              <DraggableActivity key={index} index={index}>
                                <ActivityCell activity={activity} index={index} />
                              </DraggableActivity>
                            ))
                          )}
                          {editing ? (
                            <AddActivitySlot
                              dayIndex={d.dayIndex}
                              dayN={d.day.n}
                              part={part}
                              empty={list.length === 0}
                              size="cell"
                              onAdd={addActivity}
                        suggestContext={buildSuggestContext(d, part, trip.destination)}
                            />
                          ) : null}
                        </div>
                      </details>
                    </DroppableBucket>
                  );
                })}
              </tr>
            </tbody>
          </table>
          </div>

          {/* Mobile: stacked cards per part-of-day. */}
          <div className="tds-grid-stack tds-grid-mobile-only">
            {(["morning", "afternoon", "evening"] as PartOfDay[]).map((part) => {
              const list = d[part];
              const key = `p:${d.dayIndex}:${part}`;
              const isCollapsed = collapsed.has(key);
              const Icon = PART_ICON[part];
              return (
                <DroppableBucket
                  key={part}
                  dayIndex={d.dayIndex}
                  part={part}
                  className={`tds-grid-card tds-grid-card--${part}${isCollapsed ? " tds-grid-card--collapsed" : ""}`}
                >
                  <header className="tds-grid-card-head">
                    <span className="tds-grid-card-icon" aria-hidden>
                      <Icon size={16} />
                    </span>
                    <span className="tds-grid-card-label">{PART_LABEL[part]}</span>
                    {list.length > 0 ? (
                      <span className="tds-grid-card-count" aria-hidden>{list.length}</span>
                    ) : null}
                    <CollapseToggle
                      collapsed={isCollapsed}
                      onToggle={() => togglePart(key)}
                      label={`${PART_LABEL[part]} on Day ${d.day.n}`}
                      variant="part"
                    />
                  </header>
                  <div className="tds-grid-card-body">
                    {list.length === 0 && !editing ? (
                      <div className="tds-grid-card-empty">Nothing planned</div>
                    ) : null}
                    {list.map(({ activity, index }) => (
                      <DraggableActivity key={index} index={index}>
                        <ActivityCell activity={activity} index={index} />
                      </DraggableActivity>
                    ))}
                    {editing ? (
                      <AddActivitySlot
                        dayIndex={d.dayIndex}
                        dayN={d.day.n}
                        part={part}
                        empty={list.length === 0}
                        size="card"
                        onAdd={addActivity}
                        suggestContext={buildSuggestContext(d, part, trip.destination)}
                      />
                    ) : null}
                  </div>
                </DroppableBucket>
              );
            })}
          </div>

          {d.unassigned.length > 0 ? (
            <div className="tds-grid-essentials">
              {d.unassigned.map(({ activity, index }) => (
                <DraggableActivity key={index} index={index}>
                  <ActivityCell activity={activity} index={index} />
                </DraggableActivity>
              ))}
            </div>
          ) : null}
        </section>
      ))}
      </ActivityDndContext>
      {editing ? <AddDayButton onAdd={addDay} /> : null}
      <ShadowItinerary itinerary={it} />
        </>
      )}
    </div>
  );
}
