import type { Block, TripView } from "../../types";
import { buildItinerary } from "../itinerary";
import { ActivityCell } from "./parts";
import { ActivityDndContext, DraggableActivity, DroppableBucket } from "./dnd";
import type { PartOfDay } from "../itinerary";
import { ShadowItinerary, PlanBCue } from "../ShadowItinerary";
import { BlankDayScaffold, isScaffoldTriggered } from "../BlankDayScaffold";
import { useEditing } from "../Editable";
import { Sunrise, Sun, Moon, Pencil } from "lucide-react";
import { FlightEditSheet } from "../ActivityEditSheet";
import { useCallback, useState } from "react";
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
  return (
    <tr>
      <td className="tds-td-strong">
        <span className="inline-flex items-center gap-1.5">
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
      <td>{[f.airline, f.flightNumber].filter(Boolean).join(" ") || "—"}</td>
      <td>{[f.from, f.to].filter(Boolean).join(" → ") || "—"}</td>
      <td>{f.date ?? "—"}</td>
      <td>{f.departTime ?? "—"}</td>
      <td>{f.arriveTime ?? "—"}</td>
      <td>{f.confirmation ?? "—"}</td>
    </tr>
  );
}

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
        <section key={d.dayIndex} className="tds-grid-section" data-block="day">
          <EditableDayHeader
            d={d}
            className="tds-grid-day-head"
            showCollapse={false}
            onMoveDay={(dir) => moveDay(d.dayIndex, dir)}
            canMoveUp={dPos > 0}
            canMoveDown={dPos < it.days.length - 1}
            onDeleteDay={() => deleteDay(d.dayIndex)}
          />
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
