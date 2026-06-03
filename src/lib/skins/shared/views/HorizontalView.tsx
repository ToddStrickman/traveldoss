import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import type { Block, TripView } from "../../types";
import { buildItinerary, type PartOfDay } from "../itinerary";
import { useEditing } from "../Editable";
import { ActivityCard, FlightStrip, PartHeading, partOrder } from "./parts";

type ActivityEntry = { activity: Extract<Block, { kind: "place" }>; index: number };

function cardId(index: number) {
  return `act:${index}`;
}
function bucketId(dayIndex: number, part: PartOfDay) {
  return `bkt:${dayIndex}:${part}`;
}
function parseCardId(id: string): number | null {
  const m = /^act:(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}
function parseBucketId(id: string): { dayIndex: number; part: PartOfDay } | null {
  const m = /^bkt:(\d+):(morning|afternoon|evening)$/.exec(id);
  return m ? { dayIndex: Number(m[1]), part: m[2] as PartOfDay } : null;
}

/** Kanban board: each day is a vertical column with morning/afternoon/evening
 *  buckets. Read-only ordering in this pass (editing of titles/notes still
 *  works inline). Flights pinned as a strip above the board. */
export function HorizontalView({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const it = buildItinerary(blocks);
  const { editing, onMoveActivity } = useEditing();
  const dates = [trip.start_date, trip.end_date].filter(Boolean).join(" – ");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  /** Map of activity flat-index → its bucket coordinates. Used to resolve a
   *  drop target when the user releases over another card. */
  const cardLocation = useMemo(() => {
    const m = new Map<number, { dayIndex: number; part: PartOfDay }>();
    for (const d of it.days) {
      for (const part of partOrder) {
        for (const { index } of d[part]) m.set(index, { dayIndex: d.dayIndex, part });
      }
    }
    return m;
  }, [it.days]);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const srcIndex = parseCardId(String(active.id));
    if (srcIndex == null) return;

    const overStr = String(over.id);
    const overBucket = parseBucketId(overStr);
    const overCard = parseCardId(overStr);

    if (overBucket) {
      onMoveActivity(srcIndex, overBucket.dayIndex, overBucket.part);
      return;
    }
    if (overCard != null && overCard !== srcIndex) {
      const loc = cardLocation.get(overCard);
      if (loc) onMoveActivity(srcIndex, loc.dayIndex, loc.part, overCard);
    }
  }

  return (
    <div className="tds-horizontal">
      <header className="tds-board-head">
        <h1 className="tds-title tds-trip-title">
          {trip.destination}
          <span className="tds-dot">.</span>
        </h1>
        {trip.subtitle ? <p className="tds-dek">{trip.subtitle}</p> : null}
        <div className="tds-byline">
          <span>{trip.destination}</span>
          {dates ? <span>{dates}</span> : null}
        </div>
        <FlightStrip outbound={it.flights.outbound} inbound={it.flights.inbound} />
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="tds-board" role="list">
          {it.days.map((d) => (
            <section key={d.dayIndex} className="tds-board-col" role="listitem" data-block="day">
              <header className="tds-board-col-head">
                <div className="tds-day-no">Day {String(d.day.n).padStart(2, "0")}</div>
                <div className="tds-day-label">{d.day.label}</div>
              </header>
              {partOrder.map((part) => (
                <Bucket
                  key={part}
                  dayIndex={d.dayIndex}
                  part={part}
                  entries={d[part]}
                  editing={editing}
                />
              ))}
              {d.unassigned.length > 0 ? (
                <div className="tds-board-bucket">
                  <div className="tds-board-bucket-list">
                    {d.unassigned.map(({ activity, index }) => (
                      <DraggableCard
                        key={index}
                        activity={activity}
                        index={index}
                        editing={editing}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Bucket({
  dayIndex,
  part,
  entries,
  editing,
}: {
  dayIndex: number;
  part: PartOfDay;
  entries: ActivityEntry[];
  editing: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: bucketId(dayIndex, part),
    disabled: !editing,
  });
  return (
    <div
      ref={setNodeRef}
      className="tds-board-bucket"
      data-part={part}
      data-drop-over={isOver ? "true" : undefined}
    >
      <PartHeading part={part} />
      <div className="tds-board-bucket-list">
        {entries.map(({ activity, index }) => (
          <DraggableCard key={index} activity={activity} index={index} editing={editing} />
        ))}
        {entries.length === 0 ? <div className="tds-board-empty">—</div> : null}
      </div>
    </div>
  );
}

function DraggableCard({
  activity,
  index,
  editing,
}: {
  activity: Extract<Block, { kind: "place" }>;
  index: number;
  editing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: cardId(index),
    disabled: !editing,
  });
  // Also accept drops on the card itself so users can drop "before" it.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: cardId(index),
    disabled: !editing,
  });
  const ref = (n: HTMLDivElement | null) => {
    setNodeRef(n);
    setDropRef(n);
  };
  const style = {
    transform: transform ? DndCSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.4 : 1,
    outline: isOver ? "1px solid var(--tds-accent)" : undefined,
    touchAction: editing ? ("none" as const) : undefined,
  };
  return (
    <div
      ref={ref}
      style={style}
      {...(editing ? listeners : {})}
      {...(editing ? attributes : {})}
    >
      <ActivityCard activity={activity} index={index} />
    </div>
  );
}