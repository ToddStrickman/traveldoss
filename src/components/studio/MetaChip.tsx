import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Plus, Check, X } from "lucide-react";

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
    if (s && e) return `${s} – ${e}`;
    return s || e || "";
  }
  if (typeof v === "string") return v;
  return "";
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
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-paper/60 px-3 py-1 text-[11px] tracking-[0.04em] text-ink-soft">
        <span className="td-eyebrow text-ink/40">{label}</span>
        <span className="text-ink">{text}</span>
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
          className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] tracking-[0.04em] transition-elegant ${
            empty
              ? "td-chip-pulse border-dashed border-seal/50 bg-seal/5 text-seal hover:bg-seal/10"
              : "border-ink/15 bg-paper/60 text-ink-soft hover:border-seal/50 hover:text-ink"
          }`}
        >
          {empty ? (
            <>
              <Plus className="h-3 w-3" />
              <span className="td-eyebrow">{emptyLabel ?? `Add ${label.toLowerCase()}`}</span>
            </>
          ) : (
            <>
              <span className="td-eyebrow text-ink/40">{label}</span>
              <span className="text-ink">{text}</span>
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
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            className={fld}
            placeholder="Start (e.g. Oct 14)"
            value={range.start}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
          />
          <input
            className={fld}
            placeholder="End (e.g. Oct 18)"
            value={range.end}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
          />
        </div>
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
