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
import { Plus, Sun } from "lucide-react";
import { useCallback, useState } from "react";
import type { PartOfDay } from "../itinerary";

/** Chronological vertical reading view.
 *  Outbound flight → Day 01 (morning/afternoon/evening) → … → Inbound flight. */
export function VerticalView({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const it = buildItinerary(blocks);
  const {
    onBlockChange,
    editing,
    onMetaChange,
    onTripDatesChange,
    onBlockAdd,
    onBlocksReplace,
  } = useEditing();
  const showScaffold = editing && isScaffoldTriggered(blocks);
  const meta = trip.meta ?? {};
  const dateValue = { start: trip.start_date ?? "", end: trip.end_date ?? "" };
  const INTERESTS = [
    "food","wine","design","architecture","art","history",
    "nature","hiking","beaches","nightlife","shopping","kids","wellness","music",
  ];
  const placeholderFor = (part: "morning" | "afternoon" | "evening"): string =>
    part === "morning" ? "Open Morning" : part === "afternoon" ? "Open Afternoon" : "Open Evening";

  /** Tracks which empty slot has the inline editor open. */
  const [openEditor, setOpenEditor] = useState<{ dayIndex: number; part: PartOfDay } | null>(null);

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

  /** Insert a new place block into (dayIndex, part), creating the section
   *  header first when it doesn't exist yet. Reuses onBlockAdd so history /
   *  autosave / view-transition all fire the same way as any other edit.
   *  `seed` carries user-entered fields from the inline editor. */
  const addActivity = (
    dayIndex: number,
    part: PartOfDay,
    seed: Partial<Extract<Block, { kind: "place" }>> = {},
  ) => {
    const placeSeed = { name: "", category: "other" as const, ...seed };
    // Range covering just this day (up to next day block or end of list).
    let dayEnd = blocks.length;
    for (let i = dayIndex + 1; i < blocks.length; i++) {
      if (blocks[i].kind === "day") { dayEnd = i; break; }
    }
    // Look for the matching part-of-day section within the day range.
    let sectionIdx = -1;
    for (let i = dayIndex + 1; i < dayEnd; i++) {
      const b = blocks[i];
      if (b.kind === "section" && b.partOfDay === part) { sectionIdx = i; break; }
    }
    if (sectionIdx !== -1) {
      // Insert after the last existing place in this section so new entries
      // append to the bucket rather than jumping to the top.
      let insertAfter = sectionIdx;
      for (let i = sectionIdx + 1; i < dayEnd; i++) {
        const b = blocks[i];
        if (b.kind === "section") break;
        if (b.kind === "place") insertAfter = i;
      }
      onBlockAdd(insertAfter, "place", placeSeed);
      return;
    }
    // No section yet — build day slice with the missing section + place in one shot.
    const PART_ORDER: Record<PartOfDay, number> = { morning: 0, afternoon: 1, evening: 2 };
    if (!onBlocksReplace) {
      // Fallback: append a section + place at day end. Bucketing still works
      // because part-of-day is derived left-to-right from the prior section.
      onBlockAdd(dayEnd - 1, "section", { title: part[0].toUpperCase() + part.slice(1), partOfDay: part });
      onBlockAdd(dayEnd, "place", placeSeed);
      return;
    }
    // Find the correct insertion point so morning < afternoon < evening.
    let insertAt = dayEnd;
    for (let i = dayIndex + 1; i < dayEnd; i++) {
      const b = blocks[i];
      if (b.kind === "section" && b.partOfDay && PART_ORDER[b.partOfDay] > PART_ORDER[part]) {
        insertAt = i; break;
      }
    }
    const next: Block[] = blocks.slice();
    next.splice(insertAt, 0,
      { kind: "section", title: part[0].toUpperCase() + part.slice(1), partOfDay: part },
      { kind: "place", ...placeSeed },
    );
    onBlocksReplace(next);
  };

  /** Append a new day block at the end of the days list. Empty sections
   *  render as the click-to-add placeholders below, so the fresh day is
   *  immediately usable without materializing three section headers. */
  const addDay = () => {
    const usedNs = blocks.filter((b): b is Extract<Block, { kind: "day" }> => b.kind === "day").map((d) => d.n);
    const nextN = (usedNs.length ? Math.max(...usedNs) : 0) + 1;
    // Insert after the last day-related block (day + its trailing sections/places),
    // but before an inbound flight so the return leg stays at the tail.
    let insertAfter = blocks.length - 1;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (b.kind === "flight" && b.direction === "inbound") { insertAfter = i - 1; continue; }
      if (b.kind === "day" || b.kind === "section" || b.kind === "place") { insertAfter = i; break; }
    }
    onBlockAdd(insertAfter, "day", { n: nextN, label: `Day ${String(nextN).padStart(2, "0")}` });
  };
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
                      openEditor && openEditor.dayIndex === d.dayIndex && openEditor.part === part ? (
                        <InlineActivityEditor
                          part={part}
                          dayN={d.day.n}
                          onCancel={() => setOpenEditor(null)}
                          onSave={(seed) => {
                            addActivity(d.dayIndex, part, seed);
                            setOpenEditor(null);
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="tds-open-slot tds-open-slot-btn tds-open-slot-inline tap"
                          onClick={() => setOpenEditor({ dayIndex: d.dayIndex, part })}
                          aria-label={`Add another ${part} activity to Day ${d.day.n}`}
                        >
                          <span className="tds-open-slot-plus" aria-hidden><Plus size={12} /></span>
                          <span>Add another</span>
                        </button>
                      )
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
                        openEditor && openEditor.dayIndex === d.dayIndex && openEditor.part === part ? (
                          <InlineActivityEditor
                            part={part}
                            dayN={d.day.n}
                            onCancel={() => setOpenEditor(null)}
                            onSave={(seed) => {
                              addActivity(d.dayIndex, part, seed);
                              setOpenEditor(null);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="tds-open-slot tds-open-slot-btn tap"
                            onClick={() => setOpenEditor({ dayIndex: d.dayIndex, part })}
                            aria-label={`Add ${part} activity to Day ${d.day.n}`}
                          >
                            <span className="tds-open-slot-plus" aria-hidden><Plus size={12} /></span>
                            <span>Add {part} activity</span>
                          </button>
                        )
                      ) : (
                        <div className="tds-open-slot" aria-label={`${placeholderFor(part)} — drag or add an activity`}>
                          <span className="tds-open-slot-dot" aria-hidden />
                          <span>{placeholderFor(part)}</span>
                        </div>
                      )
                    ) : null}
                    {editing && list.length > 0 ? (
                      openEditor && openEditor.dayIndex === d.dayIndex && openEditor.part === part ? (
                        <InlineActivityEditor
                          part={part}
                          dayN={d.day.n}
                          onCancel={() => setOpenEditor(null)}
                          onSave={(seed) => {
                            addActivity(d.dayIndex, part, seed);
                            setOpenEditor(null);
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="tds-open-slot tds-open-slot-btn tds-open-slot-inline tap"
                          onClick={() => setOpenEditor({ dayIndex: d.dayIndex, part })}
                          aria-label={`Add another ${part} activity to Day ${d.day.n}`}
                        >
                          <span className="tds-open-slot-plus" aria-hidden><Plus size={12} /></span>
                          <span>Add another</span>
                        </button>
                      )
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

      {editing ? (
        <div className="tds-add-day-row" data-print="hide">
          <button
            type="button"
            className="tds-add-day tap"
            onClick={addDay}
            aria-label="Add another day"
          >
            <span className="tds-add-day-plus" aria-hidden><Sun size={14} /></span>
            <span>Add another day</span>
          </button>
        </div>
      ) : null}

      <FlightStrip inbound={it.flights.inbound} />

      <ShadowItinerary itinerary={it} />
        </>
      )}
    </div>
  );
}

type PlaceBlock = Extract<Block, { kind: "place" }>;
type PlaceSeed = Partial<PlaceBlock>;

const CATEGORY_OPTIONS: Array<{ value: NonNullable<PlaceBlock["category"]>; label: string }> = [
  { value: "restaurant", label: "Restaurant" },
  { value: "culture", label: "Culture" },
  { value: "walk", label: "Walk / hike" },
  { value: "event", label: "Event" },
  { value: "accommodation", label: "Stay" },
  { value: "transit", label: "Transit" },
  { value: "other", label: "Other" },
];

/**
 * Inline mini-form that replaces the "Add {part} activity" button when
 * clicked. Captures the essentials (name, time, category, note) so a
 * fresh place block lands populated in the correct day/part instead of
 * as an empty stub the user then has to edit field-by-field.
 */
function InlineActivityEditor({
  part,
  dayN,
  onSave,
  onCancel,
}: {
  part: PartOfDay;
  dayN: number;
  onSave: (seed: PlaceSeed) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState<NonNullable<PlaceBlock["category"]>>("other");
  const [note, setNote] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const seed: PlaceSeed = { name: trimmed, category };
    if (time.trim()) seed.time = time.trim();
    if (note.trim()) seed.note = note.trim();
    onSave(seed);
  };

  return (
    <form
      className="tds-inline-editor"
      data-print="hide"
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      aria-label={`Add ${part} activity to Day ${dayN}`}
    >
      <div className="tds-inline-editor-row">
        <input
          className="tds-inline-editor-input tds-inline-editor-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${part[0].toUpperCase() + part.slice(1)} activity`}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
        />
        <input
          className="tds-inline-editor-input tds-inline-editor-time"
          type="text"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="Time"
          aria-label="Time"
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
        />
        <select
          className="tds-inline-editor-input tds-inline-editor-cat"
          value={category}
          onChange={(e) => setCategory(e.target.value as NonNullable<PlaceBlock["category"]>)}
          aria-label="Category"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <textarea
        className="tds-inline-editor-input tds-inline-editor-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
        }}
      />
      <div className="tds-inline-editor-actions">
        <button
          type="button"
          className="tds-inline-editor-btn tds-inline-editor-cancel tap"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="tds-inline-editor-btn tds-inline-editor-save tap"
          disabled={!name.trim()}
        >
          Save activity
        </button>
      </div>
    </form>
  );
}