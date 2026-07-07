import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, TripView } from "../../types";
import { buildItinerary, type PartOfDay } from "../itinerary";
import { ActivityCard, FlightStrip, partOrder } from "./parts";
import { ActivityDndContext, DraggableActivity, DroppableBucket } from "./dnd";
import { ShadowItinerary, PlanBCue } from "../ShadowItinerary";
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
} from "./editing-kit";

type ActivityEntry = { activity: Extract<Block, { kind: "place" }>; index: number };

/** Kanban board: each day is a vertical column with morning/afternoon/evening
 *  buckets. On mobile the columns snap-scroll horizontally so each day fills
 *  the screen, giving the "swipe day-to-day" feel that the vertical view
 *  intentionally doesn't have. Full inline editing everywhere. */
export function HorizontalView({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const it = buildItinerary(blocks);
  const { editing } = useEditing();
  const showScaffold = editing && isScaffoldTriggered(blocks);
  const addActivity = useAddActivity(blocks);
  const addDay = useAddDay(blocks);

  // Mobile pager: which day column is centered right now.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setActiveDay((prev) => (prev === idx ? prev : Math.min(idx, Math.max(0, it.days.length - 1))));
  }, [it.days.length]);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);
  const jumpToDay = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="tds-horizontal">
      <EditableHero trip={trip} className="tds-hero tds-board-head" />
      {showScaffold ? null : (
        <FlightStrip outbound={it.flights.outbound} inbound={it.flights.inbound} />
      )}

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

      <ActivityDndContext blocks={blocks}>
        <div className="tds-board" role="list" ref={scrollerRef}>
          {it.days.map((d) => (
            <section key={d.dayIndex} className="tds-board-col" role="listitem" data-block="day">
              <EditableDayHeader
                d={d}
                className="tds-board-col-head"
                showCollapse={false}
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
      </ActivityDndContext>
      {editing ? <AddDayButton onAdd={addDay} /> : null}
      <ShadowItinerary itinerary={it} />
        </>
      )}
    </div>
  );
}

function Bucket({
  dayIndex,
  dayN,
  part,
  entries,
  editing,
  onAdd,
}: {
  dayIndex: number;
  dayN: number;
  part: PartOfDay;
  entries: ActivityEntry[];
  editing: boolean;
  onAdd: (dayIndex: number, part: PartOfDay, seed: Partial<Extract<Block, { kind: "place" }>>) => void;
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
          />
        ) : null}
      </div>
    </DroppableBucket>
  );
}