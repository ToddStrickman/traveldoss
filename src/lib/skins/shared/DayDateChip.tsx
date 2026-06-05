import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dayDateLabel } from "./views/parts";

/**
 * Inline editor for the per-day date. Click the chip to open a tiny
 * popover with both a native calendar picker (when the value parses as
 * ISO) and a free-form text input (so users can type "Day 3 — Tuesday"
 * or leave it as plain prose). Closing the popover commits the value.
 */
export function DayDateChip({
  value,
  editable,
  onChange,
}: {
  value: string;
  editable: boolean;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const display = value && value.trim() ? value.trim() : dayDateLabel(undefined);
  const placeholder = !value || !value.trim();

  if (!editable) {
    return (
      <span className="tds-day-date-chip" data-placeholder={placeholder ? "true" : undefined}>
        {display}
      </span>
    );
  }

  // ISO-ish detection so the calendar shows a meaningful starting date.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="tds-day-date-chip"
          data-placeholder={placeholder ? "true" : undefined}
          aria-label="Edit day date"
        >
          <CalendarIcon className="h-3 w-3" aria-hidden />
          <span>{display}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 border-ink/10 bg-paper text-ink"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-3">
          <label className="td-eyebrow text-ink/55">Date</label>
          <input
            type="date"
            value={iso}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-md border border-ink/15 bg-paper/60 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-seal"
          />
          <div className="td-eyebrow text-ink/40">or write free-form</div>
          <input
            type="text"
            autoFocus
            placeholder="e.g. Tuesday · Oct 15"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setOpen(false);
              }
              if (e.key === "Escape") setOpen(false);
            }}
            className="w-full rounded-md border border-ink/15 bg-paper/60 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-seal placeholder:text-ink/35"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}