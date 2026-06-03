import type { Block, TripView } from "../../types";
import { buildItinerary } from "../itinerary";
import { ActivityCard, FlightStrip, PartHeading, partOrder } from "./parts";

/** Kanban board: each day is a vertical column with morning/afternoon/evening
 *  buckets. Read-only ordering in this pass (editing of titles/notes still
 *  works inline). Flights pinned as a strip above the board. */
export function HorizontalView({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const it = buildItinerary(blocks);
  const dates = [trip.start_date, trip.end_date].filter(Boolean).join(" – ");
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

      <div className="tds-board" role="list">
        {it.days.map((d) => (
          <section key={d.dayIndex} className="tds-board-col" role="listitem" data-block="day">
            <header className="tds-board-col-head">
              <div className="tds-day-no">Day {String(d.day.n).padStart(2, "0")}</div>
              <div className="tds-day-label">{d.day.label}</div>
            </header>
            {partOrder.map((part) => (
              <div key={part} className="tds-board-bucket" data-part={part}>
                <PartHeading part={part} />
                <div className="tds-board-bucket-list">
                  {d[part].map(({ activity, index }) => (
                    <ActivityCard key={index} activity={activity} index={index} />
                  ))}
                  {d[part].length === 0 ? (
                    <div className="tds-board-empty">—</div>
                  ) : null}
                </div>
              </div>
            ))}
            {d.unassigned.length > 0 ? (
              <div className="tds-board-bucket">
                <div className="tds-board-bucket-list">
                  {d.unassigned.map(({ activity, index }) => (
                    <ActivityCard key={index} activity={activity} index={index} />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}