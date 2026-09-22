import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Block, TripView } from "../../types";
import { buildItinerary, type PartOfDay } from "../itinerary";
import { ActivityCard, partOrder } from "./parts";
import { TopScrollbar } from "./TopScrollbar";
import { ActivityDndContext, DraggableActivity, DroppableBucket } from "./dnd";
import { ShadowItinerary, PlanBCue } from "../ShadowItinerary";
import { StayCard, type HotelStay } from "../HotelsQuickRef";
import { getTripLogistics, type LogisticsFlight, type LogisticsStay } from "../logistics";
import { FlightCard } from "../FlightsSummary";
import { useTrustedViewer } from "../trusted-viewer";
import { trackLaneItemExpanded } from "@/lib/analytics";
import { BlankDayScaffold, isScaffoldTriggered } from "../BlankDayScaffold";
import { useEditing } from "../Editable";
import {
  EditableHero,
  EditableDayHeader,
  PartHeaderRow,
  AddActivitySlot,
  AddDayButton,
  useAddActivity,
  useAddDay,
  useMoveDay,
  useDeleteDay,
  buildSuggestContext,
  type SuggestContext,
} from "./editing-kit";

type ActivityEntry = { activity: Extract<Block, { kind: "place" }>; index: number };

/** Kanban board: each day is a vertical column with morning/afternoon/evening
 *  buckets. On mobile the columns snap-scroll horizontally so each day fills
 *  the screen, giving the "swipe day-to-day" feel that the vertical view
 *  intentionally doesn't have. Full inline editing everywhere. */
export function HorizontalView({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const it = buildItinerary(blocks);
  const logistics = useMemo(() => getTripLogistics(trip, blocks), [trip, blocks]);
  const trusted = useTrustedViewer();
  const { editing } = useEditing();
  const showScaffold = editing && isScaffoldTriggered(blocks);
  const addActivity = useAddActivity(blocks);
  const addDay = useAddDay(blocks);
  const moveDay = useMoveDay(blocks);
  const deleteDay = useDeleteDay(blocks);

  // Mobile pager: which day column is centered right now.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [expanded, setExpanded] = useState<{ kind: "flight" | "stay"; id: string } | null>(null);
  // Per-day truncation: a collapsed board column shrinks to its header
  // (which keeps the map opener and the toggle for re-expanding).
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(() => new Set());
  const toggleDayCollapsed = useCallback((dayIndex: number) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayIndex)) next.delete(dayIndex);
      else next.add(dayIndex);
      return next;
    });
  }, []);
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const columns = Array.from(el.querySelectorAll<HTMLElement>(".tds-board-col"));
    const idx = columns.reduce((nearest, column, index) =>
      Math.abs(column.offsetLeft - el.scrollLeft) < Math.abs((columns[nearest]?.offsetLeft ?? 0) - el.scrollLeft)
        ? index
        : nearest, 0);
    setActiveDay((prev) => (prev === idx ? prev : Math.min(idx, Math.max(0, it.days.length - 1))));
  }, [it.days.length]);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);
  useEffect(() => {
    const today = logistics.days.findIndex((day) => day.today);
    if (today < 0) return;
    const el = scrollerRef.current;
    const column = el?.querySelectorAll<HTMLElement>(".tds-board-col")[today];
    if (el && column) {
      el.scrollTo({ left: column.offsetLeft, behavior: "auto" });
      setActiveDay(today);
    }
  }, [logistics.days]);
  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [expanded]);
  const jumpToDay = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const column = el.querySelectorAll<HTMLElement>(".tds-board-col")[i];
    if (column) el.scrollTo({ left: column.offsetLeft, behavior: "smooth" });
  };
  const toggleExpanded = (kind: "flight" | "stay", id: string) => {
    setExpanded((current) => {
      if (current?.kind === kind && current.id === id) return null;
      trackLaneItemExpanded(kind);
      return { kind, id };
    });
  };
  const expandedFlight = expanded?.kind === "flight"
    ? logistics.flights.find((item) => item.id === expanded.id)
    : undefined;
  const expandedStay = expanded?.kind === "stay"
    ? logistics.stays.find((item) => item.id === expanded.id)
    : undefined;

  return (
    <div className="tds-horizontal">
      <EditableHero trip={trip} className="tds-hero tds-board-head" />
      {showScaffold ? (
        <BlankDayScaffold blocks={blocks} />
      ) : (
        <>
      {/* Mobile pager dots — a quiet indicator of which day is on screen. */}
      {it.days.length > 1 ? (
        <nav className="tds-board-pager" aria-label="Days" data-print="hide">
          {it.days.map((d, i) => (
            <button
              key={d.dayIndex}
              type="button"
              className="tds-board-pager-dot tap"
              data-active={i === activeDay || undefined}
              onClick={() => jumpToDay(i)}
              aria-label={`Go to Day ${d.day.n}`}
              aria-current={i === activeDay ? "true" : undefined}
            >
              <span aria-hidden>{String(d.day.n).padStart(2, "0")}</span>
            </button>
          ))}
        </nav>
      ) : null}

      {/* Route-line scrollbar ABOVE the board: the native bar sits at the
          bottom of a 60vh scroller, so reaching more days used to mean
          "scroll down to scroll sideways". Appears only on overflow. */}
      <TopScrollbar targetRef={scrollerRef} ariaLabel="Scroll across days" />

      <ActivityDndContext blocks={blocks}>
        <div className="tds-board" ref={scrollerRef}>
          <div
            className="tds-board-track"
            style={{ "--tds-board-days": Math.max(1, it.days.length) } as CSSProperties}
          >
            <LogisticsLane
              label="Transit"
              count={it.days.length}
              items={logistics.flights}
              expandedId={expanded?.kind === "flight" ? expanded.id : undefined}
              onToggle={(id) => toggleExpanded("flight", id)}
            />
            <LogisticsLane
              label="Stays"
              count={it.days.length}
              items={logistics.stays}
              gaps={logistics.gaps}
              trusted={trusted}
              expandedId={expanded?.kind === "stay" ? expanded.id : undefined}
              onToggle={(id) => toggleExpanded("stay", id)}
            />
            {expandedFlight || expandedStay ? (
              <div className="tds-board-lane-panel">
                {expandedFlight ? <FlightCard flight={expandedFlight.flight} /> : null}
                {expandedStay ? <StayCard stay={toHotelStay(expandedStay)} /> : null}
              </div>
            ) : null}
          {it.days.map((d, dPos) => (
            <section
              key={d.dayIndex}
              className="tds-board-col"
              role="listitem"
              data-block="day"
              data-collapsed={collapsedDays.has(d.dayIndex) || undefined}
              data-today={logistics.days[dPos]?.today || undefined}
            >
              {logistics.days[dPos]?.cityChanged ? (
                <div className="tds-board-city">{logistics.days[dPos]?.city}</div>
              ) : null}
              <EditableDayHeader
                d={d}
                className="tds-board-col-head"
                collapsed={collapsedDays.has(d.dayIndex)}
                onToggleCollapsed={() => toggleDayCollapsed(d.dayIndex)}
                onMoveDay={(dir) => moveDay(d.dayIndex, dir)}
                canMoveUp={dPos > 0}
                canMoveDown={dPos < it.days.length - 1}
                onDeleteDay={() => deleteDay(d.dayIndex)}
              />
              <PlanBCue count={d.shadows.length} />
              {partOrder.map((part) => (
                <Bucket
                  key={part}
                  dayIndex={d.dayIndex}
                  dayN={d.day.n}
                  part={part}
                  entries={d[part]}
                  editing={editing}
                  onAdd={addActivity}
                  suggestContext={buildSuggestContext(d, part, trip.destination)}
                />
              ))}
              {d.unassigned.length > 0 ? (
                <div className="tds-board-bucket">
                  <div className="tds-board-bucket-list">
                    {d.unassigned.map(({ activity, index }) => (
                      <DraggableActivity key={index} index={index}>
                        <ActivityCard activity={activity} index={index} />
                      </DraggableActivity>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ))}
          </div>
        </div>
      </ActivityDndContext>
      {editing ? <AddDayButton onAdd={addDay} /> : null}
      <ShadowItinerary itinerary={it} />
        </>
      )}
    </div>
  );
}

type LaneItem = LogisticsFlight | LogisticsStay;

function LogisticsLane({
  label,
  count,
  items,
  gaps = [],
  trusted = false,
  expandedId,
  onToggle,
}: {
  label: string;
  count: number;
  items: LaneItem[];
  gaps?: Array<{ id: string; start: number; end: number }>;
  trusted?: boolean;
  expandedId?: string;
  onToggle: (id: string) => void;
}) {
  if (count === 0) return null;
  return (
    <section className="tds-board-lane" aria-label={`${label} lane`}>
      <div className="tds-board-lane-label">{label}</div>
      <div className="tds-board-lane-cells" aria-hidden>
        {Array.from({ length: count }, (_, index) => <span key={index} />)}
      </div>
      {items.map((item) => {
        const flight = "flight" in item ? item : undefined;
        const stay = "hotel" in item ? item : undefined;
        const title = flight
          ? [flight.flight.from, flight.flight.to].filter(Boolean).join(" → ") || flight.flight.flightNumber || "Flight"
          : `${stay?.hotel.name ?? "Stay"} · ${stay?.nights ?? 1} ${(stay?.nights ?? 1) === 1 ? "night" : "nights"}`;
        const arrival = flight?.fallback
          ? ` · arrives ${[flight.flight.arriveDate ?? flight.flight.date, flight.flight.arriveTime].filter(Boolean).join(" ")}`
          : "";
        return (
          <button
            key={item.id}
            type="button"
            className="tds-board-lane-item tap"
            data-kind={flight ? "flight" : "stay"}
            data-shade={stay?.shadeIndex}
            data-fallback={flight?.fallback || undefined}
            data-expanded={expandedId === item.id || undefined}
            aria-expanded={expandedId === item.id}
            onClick={() => onToggle(item.id)}
            style={{
              left: `${(item.start / count) * 100}%`,
              width: `${Math.max(1.8, ((item.end - item.start) / count) * 100)}%`,
            }}
          >
            <span className="tds-board-lane-item-text">{title}{arrival}</span>
          </button>
        );
      })}
      {gaps.map((gap) => (
        <div
          key={gap.id}
          className="tds-board-lane-gap"
          style={{ left: `${(gap.start / count) * 100}%`, width: `${((gap.end - gap.start) / count) * 100}%` }}
        >
          {trusted ? "No stay booked" : null}
        </div>
      ))}
    </section>
  );
}

function toHotelStay(stay: LogisticsStay): HotelStay {
  return {
    hotel: stay.hotel,
    index: stay.blockIndex,
    fromDay: stay.fromDay + 1,
    toDay: stay.toDay + 1,
    checkInDate: stay.checkInDate,
    checkOutDate: stay.checkOutDate,
    nights: stay.nights,
  };
}

function Bucket({
  dayIndex,
  dayN,
  part,
  entries,
  editing,
  onAdd,
  suggestContext,
}: {
  dayIndex: number;
  dayN: number;
  part: PartOfDay;
  entries: ActivityEntry[];
  editing: boolean;
  onAdd: (dayIndex: number, part: PartOfDay, seed: Partial<Extract<Block, { kind: "place" }>>) => void;
  suggestContext?: SuggestContext;
}) {
  return (
    <DroppableBucket dayIndex={dayIndex} part={part} className="tds-board-bucket">
      <PartHeaderRow part={part} dayN={dayN} showCollapse={false} />
      <div className="tds-board-bucket-list">
        {entries.map(({ activity, index }) => (
          <DraggableActivity key={index} index={index}>
            <ActivityCard activity={activity} index={index} />
          </DraggableActivity>
        ))}
        {entries.length === 0 && !editing ? <div className="tds-board-empty">—</div> : null}
        {editing ? (
          <AddActivitySlot
            dayIndex={dayIndex}
            dayN={dayN}
            part={part}
            empty={entries.length === 0}
            size="card"
            onAdd={onAdd}
            suggestContext={suggestContext}
          />
        ) : null}
      </div>
    </DroppableBucket>
  );
}