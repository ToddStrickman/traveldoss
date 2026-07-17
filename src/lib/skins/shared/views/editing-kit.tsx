import { useCallback, useState } from "react";
import { Plus, Sun, ChevronUp, ChevronDown, Trash2, MapPin } from "lucide-react";
import { useDayMap } from "../day-map-context";
import { toast } from "sonner";
import type { Block, TripView, TripMeta } from "../../types";
import type { PartOfDay } from "../itinerary";
import { EditableText, useEditing } from "../Editable";
import { MetaChip } from "@/components/studio/MetaChip";
import { DayDateChip } from "../DayDateChip";
import { LinkifiedText, PartHeading } from "./parts";

// ---------------------------------------------------------------------------
// EDITABLE HERO — trip title, subtitle, meta rail (dates / travelers / pace /
// budget / interests). Shared by vertical, horizontal and grid views so
// editing works from any layout on mobile and desktop.
// ---------------------------------------------------------------------------

const INTERESTS = [
  "food","wine","design","architecture","art","history",
  "nature","hiking","beaches","nightlife","shopping","kids","wellness","music",
];

export function EditableHero({
  trip,
  className,
  compact,
}: {
  trip: TripView;
  className?: string;
  compact?: boolean;
}) {
  const { editing, onMetaChange, onTripDatesChange, onTripChange } = useEditing();
  const meta = trip.meta ?? {};
  const dateValue = { start: trip.start_date ?? "", end: trip.end_date ?? "" };
  return (
    <header className={className ?? "tds-hero"} data-hero-compact={compact || undefined}>
      <h1 className="tds-title tds-trip-title">
        <EditableText
          as="span"
          value={trip.destination}
          placeholder="Trip title"
          ariaLabel="Trip title"
          onChange={(v) => {
            const next = v.trim();
            if (!next) {
              // The server (and the URL slug's dignity) require a title;
              // EditableText restores the previous text on the next sync.
              toast.message("A trip needs a title", {
                description: "We kept the previous one.",
              });
              return;
            }
            onTripChange("destination", next);
          }}
        />
        <span className="tds-dot">.</span>
      </h1>
      {editing || trip.subtitle ? (
        <p className="tds-dek">
          <EditableText
            as="span"
            value={trip.subtitle ?? ""}
            placeholder="Add a subtitle"
            ariaLabel="Trip subtitle"
            onChange={(v) => onTripChange("subtitle", v.trim())}
          />
        </p>
      ) : null}
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
  );
}

// ---------------------------------------------------------------------------
// COLLAPSE TOGGLE — mobile-only cloche icon. Two variants: "day" (32px) and
// "part" (26px). Shared across views so any layout can collapse a section.
// ---------------------------------------------------------------------------

export function CollapseToggle({
  collapsed,
  onToggle,
  label,
  variant,
}: {
  collapsed: boolean;
  onToggle: () => void;
  label: string;
  variant: "day" | "part";
}) {
  return (
    <button
      type="button"
      className={`tds-collapse-btn tds-collapse-btn--${variant} tap`}
      data-print="hide"
      data-collapsed={collapsed || undefined}
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
      title={`${collapsed ? "Expand" : "Collapse"} ${label}`}
    >
      <svg
        className="tds-cloche"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
        focusable="false"
      >
        <g className="tds-cloche-steam">
          <path d="M12 18 Q13 16 12 14" />
          <path d="M16 19 Q17 17 16 15" />
          <path d="M20 18 Q21 16 20 14" />
        </g>
        <path className="tds-cloche-plate" d="M6 24 L26 24" />
        <path className="tds-cloche-plate tds-cloche-plate--soft" d="M4 25 L28 25" />
        <g className="tds-cloche-dome">
          <circle className="tds-cloche-knob" cx="16" cy="11" r="1.5" />
          <path className="tds-cloche-arc" d="M8 23 C8 15 12 12 16 12 C20 12 24 15 24 23" />
          <path className="tds-cloche-hand tds-cloche-hand--stem" d="M16 3 L16 10" />
          <path className="tds-cloche-hand" d="M14.5 5.5 L16 4.5 L17.5 5.5" />
        </g>
      </svg>
      {/* Universal chevron — carries the "collapsible" affordance for users
          who don't yet read the cloche as a control. Rotates on state. */}
      <svg
        className="tds-collapse-caret"
        viewBox="0 0 12 12"
        aria-hidden
        focusable="false"
      >
        <path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// EDITABLE DAY HEADER — day number, label (editable), date chip, optional
// notes (editable in edit mode). Optional collapse toggle for mobile.
// ---------------------------------------------------------------------------

export function EditableDayHeader({
  d,
  onToggleCollapsed,
  collapsed,
  showNotes = true,
  showCollapse = true,
  className = "tds-day-head",
  onMoveDay,
  canMoveUp = false,
  canMoveDown = false,
  onDeleteDay,
}: {
  d: { day: { n: number; label: string; date?: string; notes?: string; linkTitles?: Record<string, string> }; dayIndex: number };
  onToggleCollapsed?: () => void;
  collapsed?: boolean;
  showNotes?: boolean;
  showCollapse?: boolean;
  className?: string;
  onMoveDay?: (direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onDeleteDay?: () => void;
}) {
  const { onBlockChange, editing } = useEditing();
  const dayMap = useDayMap();
  return (
    <header className={className}>
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
        {/* Embedded per-day map (owner correction: in the day header, not a
            hovering FAB). Always visible when the day has located stops —
            including while the day is collapsed. */}
        {dayMap && dayMap.locatedDays.has(d.day.n) ? (
          <button
            type="button"
            className="tds-daymap-btn tap"
            data-print="hide"
            onClick={() => dayMap.openMap(d.day.n)}
            aria-label={`Open the map for Day ${d.day.n}`}
            title={`Map — Day ${String(d.day.n).padStart(2, "0")}`}
          >
            <MapPin size={12} aria-hidden />
            <span>Map</span>
          </button>
        ) : null}
        {editing && onMoveDay ? (
          <DayReorderControls
            onMove={onMoveDay}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            dayN={d.day.n}
            onDelete={onDeleteDay}
          />
        ) : null}
        {showCollapse && onToggleCollapsed ? (
          <CollapseToggle
            collapsed={!!collapsed}
            onToggle={onToggleCollapsed}
            label={`Day ${d.day.n}`}
            variant="day"
          />
        ) : null}
      </div>
      {showNotes && (editing || d.day.notes) ? (
        <div className="tds-day-notes">
          {editing ? (
            <EditableText
              as="span"
              multiline
              value={d.day.notes ?? ""}
              placeholder="Notes for the day"
              onChange={(v) => onBlockChange(d.dayIndex, { notes: v } as Partial<Block>)}
            />
          ) : d.day.notes ? (
            <LinkifiedText text={d.day.notes} linkTitles={d.day.linkTitles} />
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

// ---------------------------------------------------------------------------
// ADD-ACTIVITY HELPERS — insert a place into (day, part) creating the
// part-of-day section header first if it doesn't exist. Adding a day appends
// a new day block after the last day/section/place but before any inbound
// flight so the return leg stays at the tail.
// ---------------------------------------------------------------------------

type PlaceBlock = Extract<Block, { kind: "place" }>;
type PlaceSeed = Partial<PlaceBlock>;

export function useAddActivity(blocks: Block[]) {
  const { onBlockAdd, onBlocksReplace } = useEditing();
  return useCallback((dayIndex: number, part: PartOfDay, seed: PlaceSeed = {}) => {
    const placeSeed = { name: "", category: "other" as const, ...seed };
    let dayEnd = blocks.length;
    for (let i = dayIndex + 1; i < blocks.length; i++) {
      if (blocks[i].kind === "day") { dayEnd = i; break; }
    }
    let sectionIdx = -1;
    for (let i = dayIndex + 1; i < dayEnd; i++) {
      const b = blocks[i];
      if (b.kind === "section" && b.partOfDay === part) { sectionIdx = i; break; }
    }
    if (sectionIdx !== -1) {
      let insertAfter = sectionIdx;
      for (let i = sectionIdx + 1; i < dayEnd; i++) {
        const b = blocks[i];
        if (b.kind === "section") break;
        if (b.kind === "place") insertAfter = i;
      }
      onBlockAdd(insertAfter, "place", placeSeed);
      return;
    }
    const PART_ORDER: Record<PartOfDay, number> = { morning: 0, afternoon: 1, evening: 2 };
    if (!onBlocksReplace) {
      onBlockAdd(dayEnd - 1, "section", { title: part[0].toUpperCase() + part.slice(1), partOfDay: part });
      onBlockAdd(dayEnd, "place", placeSeed);
      return;
    }
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
  }, [blocks, onBlockAdd, onBlocksReplace]);
}

export function useAddDay(blocks: Block[]) {
  const { onBlockAdd } = useEditing();
  return useCallback(() => {
    const usedNs = blocks
      .filter((b): b is Extract<Block, { kind: "day" }> => b.kind === "day")
      .map((d) => d.n);
    const nextN = (usedNs.length ? Math.max(...usedNs) : 0) + 1;
    let insertAfter = blocks.length - 1;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (b.kind === "flight" && b.direction === "inbound") { insertAfter = i - 1; continue; }
      if (b.kind === "day" || b.kind === "section" || b.kind === "place") { insertAfter = i; break; }
    }
    onBlockAdd(insertAfter, "day", { n: nextN, label: `Day ${String(nextN).padStart(2, "0")}` });
  }, [blocks, onBlockAdd]);
}

/** Slice out the run of blocks belonging to `dayIndex` (from the day marker
 *  up to but not including the next day marker or the inbound flight) and
 *  swap it with the adjacent day-run in `direction` (-1 up, +1 down). */
export function useMoveDay(blocks: Block[]) {
  const { onBlocksReplace } = useEditing();
  return useCallback((dayIndex: number, direction: -1 | 1) => {
    if (!onBlocksReplace) return;
    if (blocks[dayIndex]?.kind !== "day") return;
    // Collect all day-run boundaries.
    const boundaries: number[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.kind === "day") boundaries.push(i);
      else if (b.kind === "flight" && b.direction === "inbound") { boundaries.push(i); break; }
    }
    if (boundaries[boundaries.length - 1] !== blocks.length &&
        blocks[boundaries[boundaries.length - 1]]?.kind !== "flight") {
      boundaries.push(blocks.length);
    } else if (blocks[boundaries[boundaries.length - 1]]?.kind === "flight") {
      // inbound flight already anchors the tail; leave as-is.
    } else {
      boundaries.push(blocks.length);
    }
    const dayPos = boundaries.indexOf(dayIndex);
    if (dayPos < 0) return;
    const neighbourPos = dayPos + direction;
    // Must have a same-kind (day) neighbour to swap with.
    if (neighbourPos < 0 || neighbourPos >= boundaries.length) return;
    const neighbourStart = boundaries[neighbourPos];
    if (blocks[neighbourStart]?.kind !== "day") return;

    const aStart = Math.min(dayIndex, neighbourStart);
    const aEndPos = boundaries.indexOf(aStart) + 1;
    const aEnd = boundaries[aEndPos];
    const bStart = aEnd;
    const bEndPos = boundaries.indexOf(bStart) + 1;
    const bEnd = boundaries[bEndPos];
    if (aEnd == null || bEnd == null) return;

    const runA = blocks.slice(aStart, aEnd);
    const runB = blocks.slice(bStart, bEnd);
    const next = [
      ...blocks.slice(0, aStart),
      ...runB,
      ...runA,
      ...blocks.slice(bEnd),
    ];
    onBlocksReplace(next);
  }, [blocks, onBlocksReplace]);
}

/** Delete a day and its entire run (day marker + sections + places up to
 *  the next day marker or the inbound flight). No-op if the day isn't
 *  found. Fires a toast so the user has a clear undo-anchor moment. */
export function useDeleteDay(blocks: Block[]) {
  const { onBlocksReplace } = useEditing();
  return useCallback((dayIndex: number) => {
    if (!onBlocksReplace) return;
    const target = blocks[dayIndex];
    if (!target || target.kind !== "day") return;
    let end = blocks.length;
    for (let i = dayIndex + 1; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.kind === "day") { end = i; break; }
      if (b.kind === "flight" && b.direction === "inbound") { end = i; break; }
    }
    const removed = blocks.slice(dayIndex, end);
    const next = [...blocks.slice(0, dayIndex), ...blocks.slice(end)];
    onBlocksReplace(next);
    const activityCount = removed.filter((b) => b.kind === "place").length;
    toast.success(`Day ${target.n} removed`, {
      description: activityCount > 0
        ? `${activityCount} ${activityCount === 1 ? "activity" : "activities"} cleared with the day.`
        : "That empty day is off the itinerary.",
      duration: 2600,
    });
  }, [blocks, onBlocksReplace]);
}

/** Mobile-only up/down arrows shown in the day header to reorder days.
 *  Kept off desktop via CSS (`.tds-day-reorder` — see skin.css). */
export function DayReorderControls({
  onMove,
  canMoveUp,
  canMoveDown,
  dayN,
  onDelete,
}: {
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dayN: number;
  onDelete?: () => void;
}) {
  return (
    <div className="tds-day-reorder" data-print="hide" role="group" aria-label={`Reorder Day ${dayN}`}>
      <button
        type="button"
        className="tds-day-reorder-btn tap"
        onClick={() => onMove(-1)}
        disabled={!canMoveUp}
        aria-label={`Move Day ${dayN} earlier`}
      >
        <ChevronUp size={14} aria-hidden />
      </button>
      <button
        type="button"
        className="tds-day-reorder-btn tap"
        onClick={() => onMove(1)}
        disabled={!canMoveDown}
        aria-label={`Move Day ${dayN} later`}
      >
        <ChevronDown size={14} aria-hidden />
      </button>
      {onDelete ? (
        <button
          type="button"
          className="tds-day-reorder-btn tds-day-delete-btn tap"
          onClick={() => {
            if (typeof window !== "undefined" && !window.confirm(`Delete Day ${dayN}? Activities on this day will be removed.`)) return;
            onDelete();
          }}
          aria-label={`Delete Day ${dayN}`}
        >
          <Trash2 size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function AddDayButton({ onAdd, label = "Add another day" }: { onAdd: () => void; label?: string }) {
  const [burst, setBurst] = useState(false);
  const handleClick = useCallback(() => {
    onAdd();
    setBurst(true);
    // Sun-burst animation runs for 600ms; keep DOM attr in sync.
    window.setTimeout(() => setBurst(false), 650);
    toast.success("Day added", {
      description: "A fresh sunrise on your itinerary.",
      duration: 2200,
    });
  }, [onAdd]);
  return (
    <div className="tds-add-day-row" data-print="hide">
      <button
        type="button"
        className="tds-add-day tap"
        onClick={handleClick}
        aria-label={label}
        data-burst={burst || undefined}
      >
        <span className="tds-add-day-plus" aria-hidden><Sun size={14} /></span>
        <span>{label}</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADD-ACTIVITY SLOT — a single control that shows either the "add" button
// or, when opened, an inline editor that captures name / time / category /
// note and inserts a fully-populated place into the correct bucket. Works in
// every view because it's driven by (dayIndex, part).
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: Array<{ value: NonNullable<PlaceBlock["category"]>; label: string }> = [
  { value: "restaurant", label: "Restaurant" },
  { value: "culture", label: "Culture" },
  { value: "walk", label: "Walk / hike" },
  { value: "event", label: "Event" },
  { value: "accommodation", label: "Stay" },
  { value: "transit", label: "Transit" },
  { value: "other", label: "Other" },
];

export type AddSlotSize = "row" | "card" | "cell";

export function AddActivitySlot({
  dayIndex,
  dayN,
  part,
  empty,
  size = "row",
  onAdd,
}: {
  dayIndex: number;
  dayN: number;
  part: PartOfDay;
  /** If true, uses the primary "Add {part} activity" label; else "Add another". */
  empty: boolean;
  size?: AddSlotSize;
  onAdd: (dayIndex: number, part: PartOfDay, seed: PlaceSeed) => void;
}) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <InlineActivityEditor
        part={part}
        dayN={dayN}
        onCancel={() => setOpen(false)}
        onSave={(seed) => { onAdd(dayIndex, part, seed); setOpen(false); }}
      />
    );
  }
  const label = empty ? `Add ${part} activity` : "Add another";
  const ariaLabel = empty
    ? `Add ${part} activity to Day ${dayN}`
    : `Add another ${part} activity to Day ${dayN}`;
  return (
    <button
      type="button"
      className={`tds-open-slot tds-open-slot-btn ${empty ? "" : "tds-open-slot-inline"} tds-open-slot--${size} tap`}
      onClick={() => setOpen(true)}
      aria-label={ariaLabel}
      data-print="hide"
    >
      <span className="tds-open-slot-plus" aria-hidden><Plus size={12} /></span>
      <span>{label}</span>
    </button>
  );
}

export function InlineActivityEditor({
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
        <button type="button" className="tds-inline-editor-btn tds-inline-editor-cancel tap" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="tds-inline-editor-btn tds-inline-editor-save tap" disabled={!name.trim()}>
          Save activity
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// PART-OF-DAY HEADER ROW — heading + collapse toggle in one flex row so any
// view can drop it above its bucket.
// ---------------------------------------------------------------------------

export function PartHeaderRow({
  part,
  dayN,
  collapsed,
  onToggleCollapsed,
  showCollapse = true,
}: {
  part: PartOfDay;
  dayN: number;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  showCollapse?: boolean;
}) {
  return (
    <div className="tds-part-header-row">
      <PartHeading part={part} />
      {showCollapse && onToggleCollapsed ? (
        <CollapseToggle
          collapsed={!!collapsed}
          onToggle={onToggleCollapsed}
          label={`${part[0].toUpperCase() + part.slice(1)} on Day ${dayN}`}
          variant="part"
        />
      ) : null}
    </div>
  );
}