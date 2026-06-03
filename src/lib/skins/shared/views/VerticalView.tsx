import type { Block, TripView } from "../../types";
import { buildItinerary } from "../itinerary";
import { EditableText, useEditing } from "../Editable";
import { ActivityRow, FlightStrip, PartHeading, partOrder } from "./parts";
import { ActivityDndContext, DraggableActivity, DroppableBucket } from "./dnd";

/** Chronological vertical reading view.
 *  Outbound flight → Day 01 (morning/afternoon/evening) → … → Inbound flight. */
export function VerticalView({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const it = buildItinerary(blocks);
  const { onBlockChange, editing } = useEditing();
  const dates = [trip.start_date, trip.end_date].filter(Boolean).join(" – ");
  return (
    <div className="tds-vertical">
      <header className="tds-hero">
        <h1 className="tds-title tds-trip-title">
          <EditableText
            as="span"
            value={trip.destination}
            placeholder="Trip title"
            onChange={() => {}}
          />
          <span className="tds-dot">.</span>
        </h1>
        {trip.subtitle ? <p className="tds-dek">{trip.subtitle}</p> : null}
        <div className="tds-byline">
          <span>{trip.destination}</span>
          {dates ? <span>{dates}</span> : null}
        </div>
      </header>

      <FlightStrip outbound={it.flights.outbound} />

      {it.preface.length > 0 ? (
        <section className="tds-preface" aria-label="Trip essentials">
          {it.preface.map(({ activity, index }) => (
            <ActivityRow key={index} activity={activity} index={index} />
          ))}
        </section>
      ) : null}

      <ActivityDndContext blocks={blocks}>
      {it.days.map((d) => (
        <section key={d.dayIndex} className="tds-day-section" data-block="day">
          <header className="tds-day-head">
            <div className="tds-day-no">Day {String(d.day.n).padStart(2, "0")}</div>
            <div className="tds-day-label">
              <EditableText
                as="span"
                value={d.day.label}
                placeholder="Day label"
                onChange={(v) => onBlockChange(d.dayIndex, { label: v } as Partial<Block>)}
              />
            </div>
            {d.day.notes ? (
              <div className="tds-day-notes">
                <EditableText
                  as="span"
                  multiline
                  value={d.day.notes}
                  placeholder="Notes for the day"
                  onChange={(v) => onBlockChange(d.dayIndex, { notes: v } as Partial<Block>)}
                />
              </div>
            ) : null}
          </header>

          {partOrder.map((part) => {
            const list = d[part];
            if (list.length === 0 && !editing) return null;
            return (
              <DroppableBucket
                key={part}
                dayIndex={d.dayIndex}
                part={part}
                className="tds-part"
              >
                <PartHeading part={part} />
                <div className="tds-part-rows">
                  {list.map(({ activity, index }) => (
                    <DraggableActivity key={index} index={index}>
                      <ActivityRow activity={activity} index={index} />
                    </DraggableActivity>
                  ))}
                  {list.length === 0 ? (
                    <div className="tds-board-empty">Drop activity here</div>
                  ) : null}
                </div>
              </DroppableBucket>
            );
          })}

          {d.unassigned.length > 0 ? (
            <div className="tds-part-rows">
              {d.unassigned.map(({ activity, index }) => (
                <DraggableActivity key={index} index={index}>
                  <ActivityRow activity={activity} index={index} />
                </DraggableActivity>
              ))}
            </div>
          ) : null}
        </section>
      ))}
      </ActivityDndContext>

      <FlightStrip inbound={it.flights.inbound} />
    </div>
  );
}