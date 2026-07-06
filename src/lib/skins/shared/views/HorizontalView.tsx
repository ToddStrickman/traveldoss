import type { Block, TripView } from "../../types";
import { buildItinerary, type PartOfDay } from "../itinerary";
import { ActivityCard, FlightStrip, PartHeading, partOrder, dayDateLabel } from "./parts";
import { ActivityDndContext, DraggableActivity, DroppableBucket } from "./dnd";
import { ShadowItinerary, PlanBCue } from "../ShadowItinerary";
import { BlankDayScaffold, isScaffoldTriggered } from "../BlankDayScaffold";
import { useEditing } from "../Editable";

type ActivityEntry = { activity: Extract<Block, { kind: "place" }>; index: number };

/** Kanban board: each day is a vertical column with morning/afternoon/evening
 *  buckets. Read-only ordering in this pass (editing of titles/notes still
 *  works inline). Flights pinned as a strip above the board. */
export function HorizontalView({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const it = buildItinerary(blocks);
  const dates = [trip.start_date, trip.end_date].filter(Boolean).join(" – ");
  const { editing } = useEditing();
  const showScaffold = editing && isScaffoldTriggered(blocks, { destination: trip.destination });

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
        {showScaffold ? null : (
          <FlightStrip outbound={it.flights.outbound} inbound={it.flights.inbound} />
        )}
      </header>

      {showScaffold ? (
        <BlankDayScaffold blocks={blocks} />
      ) : (
        <>
      <ActivityDndContext blocks={blocks}>
        <div className="tds-board" role="list">
          {it.days.map((d) => (
            <section key={d.dayIndex} className="tds-board-col" role="listitem" data-block="day">
              <header className="tds-board-col-head">
                <div className="tds-day-no">Day {String(d.day.n).padStart(2, "0")}</div>
                <div className="tds-day-label">{d.day.label}</div>
                <div className="tds-day-date" data-placeholder={!d.day.date}>
                  {dayDateLabel(d.day.date)}
                </div>
                <PlanBCue count={d.shadows.length} />
              </header>
              {partOrder.map((part) => (
                <Bucket
                  key={part}
                  dayIndex={d.dayIndex}
                  part={part}
                  entries={d[part]}
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
      <ShadowItinerary itinerary={it} />
        </>
      )}
    </div>
  );
}

function Bucket({
  dayIndex,
  part,
  entries,
}: {
  dayIndex: number;
  part: PartOfDay;
  entries: ActivityEntry[];
}) {
  return (
    <DroppableBucket dayIndex={dayIndex} part={part} className="tds-board-bucket">
      <PartHeading part={part} />
      <div className="tds-board-bucket-list">
        {entries.map(({ activity, index }) => (
          <DraggableActivity key={index} index={index}>
            <ActivityCard activity={activity} index={index} />
          </DraggableActivity>
        ))}
        {entries.length === 0 ? <div className="tds-board-empty">—</div> : null}
      </div>
    </DroppableBucket>
  );
}