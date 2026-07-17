import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Plus, Check, X, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, parse, isValid } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

/** Canonical human-friendly format we store back into the free-text fields. */
const DATE_FMT = "MMM d";

/** Best-effort parse of the free-text field into a real Date (for calendar sync). */
function parseLoose(input: string): Date | undefined {
  const s = input.trim();
  if (!s) return undefined;
  const candidates = ["MMM d, yyyy", "MMM d", "MMMM d, yyyy", "MMMM d", "M/d/yyyy", "M/d/yy", "M/d", "yyyy-MM-dd"];
  for (const f of candidates) {
    const d = parse(s, f, new Date());
    if (isValid(d)) return d;
  }
  const d = new Date(s);
  return isValid(d) ? d : undefined;
}

export type MetaChipKind =
  | { kind: "text"; placeholder?: string }
  | { kind: "dateRange" }
  | { kind: "select"; options: { value: string; label: string }[] }
  | { kind: "tags"; options: string[] };

type Value =
  | string
  | { start: string; end: string }
  | string[]
  | null
  | undefined;

export type MetaChipProps = {
  label: string;
  /** Display string when a value is set. */
  value?: Value;
  /** Pulsing call-to-action when value is empty. */
  emptyLabel?: string;
  /** Tooltip / aria description. */
  hint?: string;
  editor: MetaChipKind;
  editable: boolean;
  onChange: (next: Value) => void;
};

function isEmpty(v: Value): boolean {
  if (v == null) return true;
  if (typeof v === "string") return !v.trim();
  if (Array.isArray(v)) return v.length === 0;
  return !v.start?.trim() && !v.end?.trim();
}

function display(v: Value, editor: MetaChipKind): string {
  if (isEmpty(v)) return "";
  if (editor.kind === "select" && typeof v === "string") {
    return editor.options.find((o) => o.value === v)?.label ?? v;
  }
  if (editor.kind === "tags" && Array.isArray(v)) return v.join(" · ");
  if (editor.kind === "dateRange" && v && typeof v === "object" && !Array.isArray(v)) {
    const s = v.start?.trim();
    const e = v.end?.trim();
    const fs = formatPrettyDate(s);
    const fe = formatPrettyDate(e);
    if (fs && fe) return `${fs} – ${fe}`;
    return fs || fe || "";
  }
  if (typeof v === "string") return v;
  return "";
}

/** ISO-ish date → "June 12ᵗʰ, 2026" using unicode superscript ordinals. */
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
function ordinalSup(day: number): string {
  const mod100 = day % 100;
  const mod10 = day % 10;
  if (mod100 >= 11 && mod100 <= 13) return "ᵗʰ";
  if (mod10 === 1) return "ˢᵗ";
  if (mod10 === 2) return "ⁿᵈ";
  if (mod10 === 3) return "ʳᵈ";
  return "ᵗʰ";
}
function formatPrettyDate(input?: string): string {
  if (!input) return "";
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return input; // leave free-text values untouched
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31) return input;
  return `${MONTHS[monthIdx]} ${day}${ordinalSup(day)}, ${year}`;
}

export function MetaChip(props: MetaChipProps) {
  const { label, value, emptyLabel, hint, editor, editable, onChange } = props;
  const [open, setOpen] = useState(false);
  const empty = isEmpty(value);
  const text = display(value, editor);

  // Static (read-only) chip when not editable: render value or hide if empty.
  if (!editable) {
    if (empty) return null;
    return (
      <span
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] tracking-[0.04em]"
        style={{
          borderColor: "color-mix(in oklab, var(--tds-ink) 18%, transparent)",
          background: "color-mix(in oklab, var(--tds-ink) 4%, var(--tds-bg))",
          color: "color-mix(in oklab, var(--tds-soft) 40%, var(--tds-ink))",
        }}
      >
        <span className="td-eyebrow shrink-0" style={{ color: "color-mix(in oklab, var(--tds-soft) 55%, var(--tds-ink))" }}>{label}</span>
        <span className="min-w-0 truncate" style={{ color: "var(--tds-ink)" }}>{text}</span>
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={hint ?? `Edit ${label}`}
          data-empty={empty ? "true" : "false"}
          className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 tracking-[0.04em] transition-elegant ${
            empty ? "td-chip-pulse border-dashed text-[11.5px]" : "text-[11px]"
          }`}
          style={
            empty
              ? {
                  borderColor: "color-mix(in oklab, var(--tds-accent) 60%, transparent)",
                  background: "color-mix(in oklab, var(--tds-accent) 12%, var(--tds-bg))",
                  color: "var(--tds-ink)",
                }
              : {
                  borderColor: "color-mix(in oklab, var(--tds-ink) 18%, transparent)",
                  background: "color-mix(in oklab, var(--tds-ink) 4%, var(--tds-bg))",
                  color: "color-mix(in oklab, var(--tds-soft) 40%, var(--tds-ink))",
                }
          }
        >
          {empty ? (
            <>
              <Plus className="h-3 w-3" strokeWidth={2.25} style={{ color: "var(--tds-accent)" }} />
              <span className="td-eyebrow font-medium" style={{ color: "var(--tds-ink)" }}>
                {emptyLabel ?? `Add ${label.toLowerCase()}`}
              </span>
            </>
          ) : (
            <>
              <span className="td-eyebrow" style={{ color: "color-mix(in oklab, var(--tds-soft) 55%, var(--tds-ink))" }}>{label}</span>
              <span style={{ color: "var(--tds-ink)" }}>{text}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 border-ink/10 bg-paper text-ink">
        <ChipEditor
          label={label}
          editor={editor}
          value={value}
          onSave={(v) => {
            onChange(v);
            setOpen(false);
          }}
          onClear={() => {
            onChange(editor.kind === "tags" ? [] : editor.kind === "dateRange" ? { start: "", end: "" } : "");
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

function ChipEditor({
  label,
  editor,
  value,
  onSave,
  onClear,
  onCancel,
}: {
  label: string;
  editor: MetaChipKind;
  value: Value;
  onSave: (v: Value) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  // Local drafts per editor variant.
  const [text, setText] = useState<string>(
    editor.kind === "text" || editor.kind === "select"
      ? typeof value === "string"
        ? value
        : ""
      : "",
  );
  const [range, setRange] = useState<{ start: string; end: string }>(
    editor.kind === "dateRange" && value && typeof value === "object" && !Array.isArray(value)
      ? { start: value.start ?? "", end: value.end ?? "" }
      : { start: "", end: "" },
  );
  const [tags, setTags] = useState<string[]>(
    editor.kind === "tags" && Array.isArray(value) ? value : [],
  );

  const fld =
    "w-full rounded-md border border-ink/15 bg-paper/60 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-seal placeholder:text-ink/35";

  function handleSave() {
    if (editor.kind === "dateRange") onSave(range);
    else if (editor.kind === "tags") onSave(tags);
    else onSave(text.trim());
  }

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="td-eyebrow text-ink/55">{label}</div>

      {editor.kind === "text" && (
        <input
          autoFocus
          className={fld}
          placeholder={editor.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}

      {editor.kind === "dateRange" && (
        <DateRangeEditor range={range} setRange={setRange} fld={fld} />
      )}

      {editor.kind === "select" && (
        <div className="flex flex-wrap gap-1.5">
          {editor.options.map((o) => {
            const on = text === o.value;
            return (
              <button
                type="button"
                key={o.value}
                onClick={() => setText(o.value)}
                className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] transition-elegant ${
                  on
                    ? "border-seal bg-seal/15 text-seal"
                    : "border-ink/15 bg-paper/40 text-ink-soft hover:border-seal/50 hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}

      {editor.kind === "tags" && (
        <div className="flex flex-wrap gap-1.5">
          {editor.options.map((t) => {
            const on = tags.includes(t);
            return (
              <button
                type="button"
                key={t}
                onClick={() => toggleTag(t)}
                className={`rounded-full border px-2.5 py-1 text-[11px] tracking-[0.05em] transition-elegant ${
                  on
                    ? "border-seal bg-seal/15 text-seal"
                    : "border-ink/15 bg-paper/40 text-ink-soft hover:border-seal/50 hover:text-ink"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onClear}
          className="td-eyebrow inline-flex items-center gap-1 text-ink/45 hover:text-ink"
        >
          <X className="h-3 w-3" /> Clear
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="td-eyebrow text-ink/45 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-md border border-seal/40 bg-seal/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.3em] text-seal transition-elegant hover:bg-seal hover:text-paper"
          >
            <Check className="h-3 w-3" /> Save
          </button>
        </div>
      </div>
    </form>
  );
}

function DateRangeEditor({
  range,
  setRange,
  fld,
}: {
  range: { start: string; end: string };
  setRange: (updater: (r: { start: string; end: string }) => { start: string; end: string }) => void;
  fld: string;
}) {
  const [openPicker, setOpenPicker] = useState<null | "start" | "end">(null);
  const selected: DateRange | undefined = (() => {
    const from = parseLoose(range.start);
    const to = parseLoose(range.end);
    if (!from && !to) return undefined;
    return { from, to };
  })();

  const calendar = (which: "start" | "end") => (
    <Popover
      open={openPicker === which}
      onOpenChange={(o) => setOpenPicker(o ? which : null)}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={which === "start" ? "Pick start date from calendar" : "Pick end date from calendar"}
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-ink/15 bg-paper/60 px-2 text-ink-soft transition-elegant hover:border-seal/60 hover:text-seal"
        >
          <CalendarIcon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        className="w-[min(20rem,calc(100vw-1.5rem))] max-h-[min(80vh,32rem)] overflow-y-auto overscroll-contain border-ink/10 bg-paper p-0 text-ink"
      >
        <div className="flex flex-col">
          <Calendar
            mode="range"
            numberOfMonths={1}
            selected={selected}
            onSelect={(r) => {
              // Fill both fields as the range fills; on a partial pick don't
              // wipe a previously-typed date the user still wants to keep.
              setRange((prev) => ({
                start: r?.from ? format(r.from, DATE_FMT) : prev.start,
                end: r?.to ? format(r.to, DATE_FMT) : r?.from ? "" : prev.end,
              }));
            }}
            defaultMonth={selected?.from ?? selected?.to ?? new Date()}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
          <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-ink/10 bg-paper/95 px-3 py-2 backdrop-blur">
            <span className="td-eyebrow text-[10px] text-ink/55">
              {selected?.from && selected?.to
                ? `${format(selected.from, DATE_FMT)} – ${format(selected.to, DATE_FMT)}`
                : selected?.from
                  ? `${format(selected.from, DATE_FMT)} – …`
                  : "Select a range"}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setRange(() => ({ start: "", end: "" }));
                }}
                className="td-eyebrow text-[10px] text-ink/45 hover:text-ink"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpenPicker(null)}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-seal/40 bg-seal/15 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-seal transition-elegant hover:bg-seal hover:text-paper"
              >
                <Check className="h-3 w-3" /> Apply
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-2">
        <input
          autoFocus
          className={cn(fld, "flex-1")}
          placeholder="Start (e.g. Oct 14)"
          value={range.start}
          onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
        />
        {calendar("start")}
      </div>
      <div className="flex items-stretch gap-2">
        <input
          className={cn(fld, "flex-1")}
          placeholder="End (e.g. Oct 18)"
          value={range.end}
          onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
        />
        {calendar("end")}
      </div>
      <p className="text-[10.5px] leading-snug text-ink/45">
        Type freely or pick from the calendar — either works.
      </p>
    </div>
  );
}
