import type { Block, TripView } from "../../types";
import { buildItinerary } from "../itinerary";
import { ActivityCell, dayDateLabel } from "./parts";
import { ActivityDndContext, DraggableActivity, DroppableBucket } from "./dnd";
import type { PartOfDay } from "../itinerary";
import { ShadowItinerary, PlanBCue } from "../ShadowItinerary";
import { BlankDayScaffold, isScaffoldTriggered } from "../BlankDayScaffold";
import { useEditing } from "../Editable";

/** Operational table view. Flights at the very top in a 2-row table.
 *  Each day renders a 3-column table (Morning · Afternoon · Evening) where
 *  every cell exposes the full activity metadata. */
export function GridView({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const it = buildItinerary(blocks);
  const dates = [trip.start_date, trip.end_date].filter(Boolean).join(" – ");
  const { editing } = useEditing();
  const showScaffold = editing && isScaffoldTriggered(blocks);
  const flights: Array<{ leg: string; f: NonNullable<typeof it.flights.outbound> }> = [];
  if (it.flights.outbound) flights.push({ leg: "Outbound", f: it.flights.outbound });
  if (it.flights.inbound) flights.push({ leg: "Inbound", f: it.flights.inbound });

  return (
    <div className="tds-grid-view">
      <header className="tds-grid-head">
        <h1 className="tds-title tds-trip-title">
          {trip.destination}
          <span className="tds-dot">.</span>
        </h1>
        {trip.subtitle ? <p className="tds-dek">{trip.subtitle}</p> : null}
        <div className="tds-byline">
          <span>{trip.destination}</span>
          {dates ? <span>{dates}</span> : null}
        </div>
      </header>

      {showScaffold ? (
        <BlankDayScaffold blocks={blocks} />
      ) : (
        <>
      {flights.length > 0 ? (
        <section className="tds-grid-section">
          <h2 className="tds-grid-h2">Flights</h2>
          <div className="tds-table-scroll">
          <table className="tds-table tds-table-flights">
            <thead>
              <tr>
                <th>Leg</th>
                <th>Airline</th>
                <th>From → To</th>
                <th>Date</th>
                <th>Depart</th>
                <th>Arrive</th>
                <th>Conf.</th>
              </tr>
            </thead>
            <tbody>
              {flights.map(({ leg, f }) => (
                <tr key={leg}>
                  <td className="tds-td-strong">{leg}</td>
                  <td>{[f.airline, f.flightNumber].filter(Boolean).join(" ") || "—"}</td>
                  <td>{[f.from, f.to].filter(Boolean).join(" → ") || "—"}</td>
                  <td>{f.date ?? "—"}</td>
                  <td>{f.departTime ?? "—"}</td>
                  <td>{f.arriveTime ?? "—"}</td>
                  <td>{f.confirmation ?? "—"}</td>
                </tr>
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
              <ActivityCell key={index} activity={activity} />
            ))}
          </div>
        </section>
      ) : null}

      <ActivityDndContext blocks={blocks}>
      {it.days.map((d) => (
        <section key={d.dayIndex} className="tds-grid-section">
          <h2 className="tds-grid-h2">
            Day {String(d.day.n).padStart(2, "0")} · {d.day.label}
            <span className="tds-day-date" data-placeholder={!d.day.date}>
              {" · "}
              {dayDateLabel(d.day.date)}
            </span>
            <PlanBCue count={d.shadows.length} />
          </h2>
          {d.day.notes ? <p className="tds-grid-day-notes">{d.day.notes}</p> : null}
          <div className="tds-table-scroll">
          <table className="tds-table tds-table-day">
            <thead>
              <tr>
                <th>Morning</th>
                <th>Afternoon</th>
                <th>Evening</th>
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
                          {list.length === 0 ? (
                            <span className="tds-td-muted">—</span>
                          ) : (
                            list.map(({ activity, index }) => (
                              <DraggableActivity key={index} index={index}>
                                <ActivityCell activity={activity} />
                              </DraggableActivity>
                            ))
                          )}
                        </div>
                      </details>
                    </DroppableBucket>
                  );
                })}
              </tr>
            </tbody>
          </table>
          </div>
          {d.unassigned.length > 0 ? (
            <div className="tds-grid-essentials">
              {d.unassigned.map(({ activity, index }) => (
                <DraggableActivity key={index} index={index}>
                  <ActivityCell activity={activity} />
                </DraggableActivity>
              ))}
            </div>
          ) : null}
        </section>
      ))}
      </ActivityDndContext>
      <ShadowItinerary itinerary={it} />
        </>
      )}
    </div>
  );
}