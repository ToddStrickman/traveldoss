import type { Block, TripView } from "../../types";
import { buildItinerary } from "../itinerary";
import { ActivityCell } from "./parts";
import { ActivityDndContext, DraggableActivity, DroppableBucket } from "./dnd";
import type { PartOfDay } from "../itinerary";
import { ShadowItinerary, PlanBCue } from "../ShadowItinerary";
import { BlankDayScaffold, isScaffoldTriggered } from "../BlankDayScaffold";
import { useEditing } from "../Editable";
import { Sunrise, Sun, Moon } from "lucide-react";
import { useCallback, useState } from "react";
import {
  EditableHero,
  EditableDayHeader,
  AddActivitySlot,
  AddDayButton,
  useAddActivity,
  useAddDay,
  CollapseToggle,
} from "./editing-kit";

const PART_ICON: Record<PartOfDay, typeof Sunrise> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
};
const PART_LABEL: Record<PartOfDay, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

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
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const togglePart = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const flights: Array<{ leg: string; f: NonNullable<typeof it.flights.outbound> }> = [];
  if (it.flights.outbound) flights.push({ leg: "Outbound", f: it.flights.outbound });
  if (it.flights.inbound) flights.push({ leg: "Inbound", f: it.flights.inbound });

  return (
    <div className="tds-grid-view">
      <EditableHero trip={trip} className="tds-hero tds-grid-head" />

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
        <section key={d.dayIndex} className="tds-grid-section" data-block="day">
          <EditableDayHeader d={d} className="tds-grid-day-head" showCollapse={false} />
          <PlanBCue count={d.shadows.length} />

          {/* Desktop: dense 3-col table. Hidden on mobile via CSS. */}
          <div className="tds-table-scroll tds-grid-desktop-only">
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
                          {list.length === 0 && !editing ? (
                            <span className="tds-td-muted">—</span>
                          ) : (
                            list.map(({ activity, index }) => (
                              <DraggableActivity key={index} index={index}>
                                <ActivityCell activity={activity} />
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
                        <ActivityCell activity={activity} />
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
                  <ActivityCell activity={activity} />
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
