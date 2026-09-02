/**
 * LayoutSwitcher — the labelled layout trigger, used while a visitor is
 * picking a dossier.
 *
 * Same composition as the in-dossier trigger (src/components/mobile/ViewSheet
 * .tsx): a glyph that *is* the active layout, a wax-seal dot marking it
 * active, the word LAYOUT in small caps, and a chevron announcing a chooser.
 * It sits with the cover — under it on mobile, beside it on desktop — so the
 * control is a glance away from the thing it changes.
 */
import { useState } from "react";
import { ChevronDown, Columns3, LayoutGrid, Rows3 } from "lucide-react";
import { TdSheet } from "@/components/mobile/TdSheet";
import { COVER_CAPTIONS, type CoverVariant } from "./DossierCover";

const OPTIONS: {
  value: CoverVariant;
  label: string;
  Icon: typeof Rows3;
}[] = [
  { value: "vertical", label: "Vertical", Icon: Rows3 },
  { value: "horizontal", label: "Horizontal", Icon: Columns3 },
  { value: "grid", label: "Grid", Icon: LayoutGrid },
];

export function LayoutSwitcher({
  value,
  onChange,
}: {
  value: CoverVariant;
  onChange: (mode: CoverVariant) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0]!;
  const ActiveIcon = active.Icon;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="tap inline-flex min-h-11 items-center gap-2.5 rounded-full border border-sunset-pink/55 bg-sunset-pink/[0.03] px-4 text-ink/70 transition-colors duration-300 hover:border-sunset-pink hover:bg-sunset-pink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sunset-pink/60 motion-reduce:transition-none"
      >
        <span className="relative inline-flex items-center">
          <ActiveIcon aria-hidden className="h-4 w-4" />
          <span
            aria-hidden
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-sunset-pink ring-2 ring-paper"
          />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.3em]">
          Layout
        </span>
        <span aria-hidden className="h-3 w-px bg-sunset-pink/30" />
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-seal">
          {active.label}
        </span>
        <ChevronDown aria-hidden className="h-3.5 w-3.5 text-sunset-pink/70" />
        <span className="sr-only">. Change layout</span>
      </button>

      <TdSheet
        open={open}
        onOpenChange={setOpen}
        title="Layout"
        description="Every template can be read three ways. Pick the one that fits how you travel."
      >
        <div role="radiogroup" aria-label="Layout" className="flex flex-col gap-2 pb-4">
          {OPTIONS.map(({ value: v, label, Icon }) => {
            const selected = v === value;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
                className={`tap flex min-h-11 items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-300 motion-reduce:transition-none ${
                  selected
                    ? "border-seal/50 bg-seal/10"
                    : "border-ink/10 hover:border-ink/25"
                }`}
              >
                <Icon
                  aria-hidden
                  className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-seal" : "text-ink/60"}`}
                />
                <span className="min-w-0">
                  <span
                    className={`block text-[11px] font-medium uppercase tracking-[0.3em] ${
                      selected ? "text-seal" : "text-ink"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="mt-1 block text-[13px] leading-snug text-ink-soft">
                    {COVER_CAPTIONS[v]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </TdSheet>
    </>
  );
}
