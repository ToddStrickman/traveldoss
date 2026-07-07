import type { Block, TripView } from "../../types";
import { buildItinerary } from "../itinerary";
import { useEditing } from "../Editable";
import {
  ActivityRow,
  FlightStrip,
  partOrder,
  SlotAlternativesCarousel,
} from "./parts";
import { ActivityDndContext, DraggableActivity, DroppableBucket } from "./dnd";
import { ShadowItinerary, PlanBCue } from "../ShadowItinerary";
import { BlankDayScaffold, isScaffoldTriggered } from "../BlankDayScaffold";
import { useCallback, useState } from "react";
import type { PartOfDay } from "../itinerary";
import {
  EditableHero,
  EditableDayHeader,
  PartHeaderRow,
  AddActivitySlot,
  AddDayButton,
  useAddActivity,
  useAddDay,
} from "./editing-kit";

/** Chronological vertical reading view.
 *  Outbound flight → Day 01 (morning/afternoon/evening) → … → Inbound flight. */
export function VerticalView({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const it = buildItinerary(blocks);
  const { editing } = useEditing();
  const showScaffold = editing && isScaffoldTriggered(blocks);
  const placeholderFor = (part: "morning" | "afternoon" | "evening"): string =>
    part === "morning" ? "Open Morning" : part === "afternoon" ? "Open Afternoon" : "Open Evening";

  /** Mobile-only collapse state. Keyed by dayIndex (whole day) or
   *  `${dayIndex}:${part}` (part-of-day). Presence = collapsed. */
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleCollapsed = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const addActivity = useAddActivity(blocks);
  const addDay = useAddDay(blocks);
  return (
    <div className="tds-vertical">
      <EditableHero trip={trip} />

      {showScaffold ? (
        <BlankDayScaffold blocks={blocks} />
      ) : (
        <>
      <FlightStrip outbound={it.flights.outbound} />

      {it.preface.length > 0 ? (
        <section className="tds-preface" aria-label="Trip essentials">
          {it.preface.map(({ activity, index }) => (
            <ActivityRow key={index} activity={activity} index={index} />
          ))}
        </section>
      ) : null}

      <ActivityDndContext blocks={blocks}>
      {it.days.map((d) => {
        const dayKey = `d:${d.dayIndex}`;
        const dayCollapsed = collapsed.has(dayKey);
        return (
        <section
          key={d.dayIndex}
          className="tds-day-section"
          data-block="day"
          data-collapsed={dayCollapsed || undefined}
        >
          <EditableDayHeader
            d={d}
            collapsed={dayCollapsed}
            onToggleCollapsed={() => toggleCollapsed(dayKey)}
          />
          <PlanBCue count={d.shadows.length} />

          <div className="tds-day-body">
          {partOrder.map((part) => {
            const list = d[part];
            const partKey = `p:${d.dayIndex}:${part}`;
            const partCollapsed = collapsed.has(partKey);
            // Always render the slot so the dossier reads complete even when
            // empty — a soft "Open …" placeholder fills the gap.
            return (
              <DroppableBucket
                key={part}
                dayIndex={d.dayIndex}
                part={part}
                className={`tds-part${partCollapsed ? " tds-part--collapsed" : ""}`}
              >
                <PartHeaderRow
                  part={part}
                  dayN={d.day.n}
                  collapsed={partCollapsed}
                  onToggleCollapsed={() => toggleCollapsed(partKey)}
                />
                <div className="tds-part-body">
                {list.length > 1 ? (
                  <>
                    <SlotAlternativesCarousel
                      count={list.length}
                      slotKey={`${d.dayIndex}:${part}`}
                    >
                      {list.map(({ activity, index }) => (
                        <DraggableActivity key={index} index={index}>
                          <ActivityRow activity={activity} index={index} />
                        </DraggableActivity>
                      ))}
                    </SlotAlternativesCarousel>
                    {editing ? (
                      <AddActivitySlot
                        dayIndex={d.dayIndex}
                        dayN={d.day.n}
                        part={part}
                        empty={false}
                        onAdd={addActivity}
                      />
                    ) : null}
                  </>
                ) : (
                  <div className="tds-part-rows">
                    {list.map(({ activity, index }) => (
                      <DraggableActivity key={index} index={index}>
                        <ActivityRow activity={activity} index={index} />
                      </DraggableActivity>
                    ))}
                    {list.length === 0 ? (
                      editing ? (
                        <AddActivitySlot
                          dayIndex={d.dayIndex}
                          dayN={d.day.n}
                          part={part}
                          empty
                          onAdd={addActivity}
                        />
                      ) : (
                        <div className="tds-open-slot" aria-label={`${placeholderFor(part)} — drag or add an activity`}>
                          <span className="tds-open-slot-dot" aria-hidden />
                          <span>{placeholderFor(part)}</span>
                        </div>
                      )
                    ) : null}
                    {editing && list.length > 0 ? (
                      <AddActivitySlot
                        dayIndex={d.dayIndex}
                        dayN={d.day.n}
                        part={part}
                        empty={false}
                        onAdd={addActivity}
                      />
                    ) : null}
                  </div>
                )}
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
          </div>
        </section>
        );
      })}
      </ActivityDndContext>

      {editing ? <AddDayButton onAdd={addDay} /> : null}

      <FlightStrip inbound={it.flights.inbound} />

      <ShadowItinerary itinerary={it} />
        </>
      )}
    </div>
  );
}