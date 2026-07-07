import type { Block, TripView, TripMeta } from "../../types";
import { buildItinerary } from "../itinerary";
import { EditableText, useEditing } from "../Editable";
import {
  ActivityRow,
  FlightStrip,
  LinkifiedText,
  PartHeading,
  partOrder,
  SlotAlternativesCarousel,
} from "./parts";
import { ActivityDndContext, DraggableActivity, DroppableBucket } from "./dnd";
import { ShadowItinerary, PlanBCue } from "../ShadowItinerary";
import { MetaChip } from "@/components/studio/MetaChip";
import { DayDateChip } from "../DayDateChip";
import { BlankDayScaffold, isScaffoldTriggered } from "../BlankDayScaffold";

/** Chronological vertical reading view.
 *  Outbound flight → Day 01 (morning/afternoon/evening) → … → Inbound flight. */
export function VerticalView({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const it = buildItinerary(blocks);
  const { onBlockChange, editing, onMetaChange, onTripDatesChange } = useEditing();
  const showScaffold = editing && isScaffoldTriggered(blocks);
  const meta = trip.meta ?? {};
  const dateValue = { start: trip.start_date ?? "", end: trip.end_date ?? "" };
  const INTERESTS = [
    "food","wine","design","architecture","art","history",
    "nature","hiking","beaches","nightlife","shopping","kids","wellness","music",
  ];
  const placeholderFor = (part: "morning" | "afternoon" | "evening"): string =>
    part === "morning" ? "Open Morning" : part === "afternoon" ? "Open Afternoon" : "Open Evening";
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
        <div className="tds-meta-rail" data-print="hide">
          <MetaChip
            label="Dates"
            value={dateValue}
            emptyLabel="Add dates"
            editor={{ kind: "dateRange" }}
            editable={editing && !!onTripDatesChange}
            onChange={(v) => {
              if (!onTripDatesChange) return;
              const r = (v && typeof v === "object" && !Array.isArray(v))
                ? v
                : { start: "", end: "" };
              onTripDatesChange(r.start, r.end);
            }}
          />
          <MetaChip
            label="Travelers"
            value={meta.travelers}
            emptyLabel="Add travelers"
            editor={{ kind: "text", placeholder: "e.g. 2 adults" }}
            editable={editing && !!onMetaChange}
            onChange={(v) => onMetaChange?.({ travelers: typeof v === "string" ? v : "" })}
          />
          <MetaChip
            label="Pace"
            value={meta.pace}
            emptyLabel="Add pace"
            editor={{
              kind: "select",
              options: [
                { value: "relaxed", label: "Relaxed" },
                { value: "balanced", label: "Balanced" },
                { value: "packed", label: "Packed" },
              ],
            }}
            editable={editing && !!onMetaChange}
            onChange={(v) =>
              onMetaChange?.({
                pace: (typeof v === "string" && v ? v : undefined) as TripMeta["pace"],
              })
            }
          />
          <MetaChip
            label="Budget"
            value={meta.budget}
            emptyLabel="Add budget"
            editor={{
              kind: "select",
              options: [
                { value: "shoestring", label: "Shoestring" },
                { value: "moderate", label: "Moderate" },
                { value: "elevated", label: "Elevated" },
                { value: "luxury", label: "Luxury" },
              ],
            }}
            editable={editing && !!onMetaChange}
            onChange={(v) =>
              onMetaChange?.({
                budget: (typeof v === "string" && v ? v : undefined) as TripMeta["budget"],
              })
            }
          />
          <MetaChip
            label="Interests"
            value={meta.interests}
            emptyLabel="Add interests"
            editor={{ kind: "tags", options: INTERESTS }}
            editable={editing && !!onMetaChange}
            onChange={(v) => onMetaChange?.({ interests: Array.isArray(v) ? v : [] })}
          />
        </div>
      </header>

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
      {it.days.map((d) => (
        <section key={d.dayIndex} className="tds-day-section" data-block="day">
          <header className="tds-day-head">
            <div className="tds-day-headline">
              <div className="tds-day-no">Day {String(d.day.n).padStart(2, "0")}</div>
              <div className="tds-day-label">
                <EditableText
                  as="span"
                  value={d.day.label}
                  placeholder="Day label"
                  onChange={(v) => onBlockChange(d.dayIndex, { label: v } as Partial<Block>)}
                />
              </div>
              <DayDateChip
                value={d.day.date ?? ""}
                editable={editing}
                onChange={(v) => onBlockChange(d.dayIndex, { date: v } as Partial<Block>)}
              />
            </div>
            <PlanBCue count={d.shadows.length} />
            {d.day.notes ? (
              <div className="tds-day-notes">
                {editing ? (
                  <EditableText
                    as="span"
                    multiline
                    value={d.day.notes}
                    placeholder="Notes for the day"
                    onChange={(v) => onBlockChange(d.dayIndex, { notes: v } as Partial<Block>)}
                  />
                ) : (
                  <LinkifiedText text={d.day.notes} linkTitles={d.day.linkTitles} />
                )}
              </div>
            ) : null}
          </header>

          {partOrder.map((part) => {
            const list = d[part];
            // Always render the slot so the dossier reads complete even when
            // empty — a soft "Open …" placeholder fills the gap.
            return (
              <DroppableBucket
                key={part}
                dayIndex={d.dayIndex}
                part={part}
                className="tds-part"
              >
                <PartHeading part={part} />
                {list.length > 1 ? (
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
                ) : (
                  <div className="tds-part-rows">
                    {list.map(({ activity, index }) => (
                      <DraggableActivity key={index} index={index}>
                        <ActivityRow activity={activity} index={index} />
                      </DraggableActivity>
                    ))}
                    {list.length === 0 ? (
                      <div className="tds-open-slot" aria-label={`${placeholderFor(part)} — drag or add an activity`}>
                        <span className="tds-open-slot-dot" aria-hidden />
                        <span>{placeholderFor(part)}</span>
                      </div>
                    ) : null}
                  </div>
                )}
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

      <ShadowItinerary itinerary={it} />
        </>
      )}
    </div>
  );
}