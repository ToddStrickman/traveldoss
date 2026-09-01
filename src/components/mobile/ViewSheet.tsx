/**
 * ViewPill + ViewSheet — mobile view switching for /t/<slug>.
 *
 * The desktop top-center pills sit outside the thumb zone and crowd the
 * mobile top edge, so on mobile the switcher becomes a floating pill in
 * the bottom-right (public read mode only, per the IA's one-bar-per-mode
 * budget) opening a sheet with the three layouts.
 */
import * as React from "react";
import { LayoutGrid, Rows3, Columns3, Check, ChevronDown } from "lucide-react";
import { TdSheet } from "@/components/mobile/TdSheet";
import type { SkinView } from "@/lib/skins/types";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{
  value: SkinView;
  label: string;
  hint: string;
  Icon: typeof Rows3;
}> = [
  { value: "vertical", label: "Vertical", hint: "The editorial read, day by day", Icon: Rows3 },
  { value: "horizontal", label: "Horizontal", hint: "Days side by side — slide activities between them", Icon: Columns3 },
  { value: "grid", label: "Grid", hint: "The whole trip on one board", Icon: LayoutGrid },
];

export function ViewPill({
  value,
  onChange,
  className,
  variant = "floating",
}: {
  value: SkinView;
  onChange: (v: SkinView) => void;
  className?: string;
  /** floating = fixed bottom-right pill; inline = labelled trigger for bars. */
  variant?: "floating" | "inline";
}) {
  const [open, setOpen] = React.useState(false);
  const active = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

  return (
    <>
      <button
        type="button"
        data-print="hide"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Layout: ${active.label}. Change layout`}
        className={cn(
          "group",
          variant === "floating"
            ? "fixed right-4 z-50 inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-paper/90 px-4 text-ink shadow-elev backdrop-blur-md transition-colors hover:border-seal hover:text-seal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal md:hidden"
            : "inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-2 text-ink transition-[background-color,transform] hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal motion-safe:active:scale-95 sm:hidden",
          className,
        )}
        style={
          variant === "floating"
            ? { bottom: "max(76px, calc(env(safe-area-inset-bottom, 0px) + 76px))" }
            : undefined
        }
      >
        {/* Glyph tracks the active layout, so the trigger says where you are
         *  as well as that it can be changed. The seal dot is the active mark. */}
        <span className="relative inline-flex shrink-0 items-center" aria-hidden>
          <active.Icon className="h-4 w-4 text-seal" />
          {variant === "inline" ? (
            <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-seal ring-2 ring-paper" />
          ) : null}
        </span>
        {variant === "floating" ? (
          <span className="text-[10px] font-medium uppercase tracking-[0.3em]">{active.label}</span>
        ) : (
          <>
            <span className="text-[10px] font-medium uppercase tracking-[0.3em]">Layout</span>
            <ChevronDown
              className="h-3 w-3 shrink-0 text-ink-soft transition-transform group-hover:text-ink motion-safe:group-active:translate-y-0.5"
              aria-hidden
            />
          </>
        )}
      </button>


      <TdSheet open={open} onOpenChange={setOpen} title="Layout">
        <div role="radiogroup" aria-label="Layout" className="flex flex-col pb-2">
          {OPTIONS.map(({ value: v, label, hint, Icon }) => {
            const on = v === value;
            return (
              <button
                key={v}
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setOpen(false);
                  if (!on) onChange(v);
                }}
                className={cn(
                  "flex w-full items-center gap-4 border-b border-white/5 py-4 text-left transition-colors last:border-b-0",
                  "hover:text-seal focus-visible:outline-none focus-visible:text-seal focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-seal/60",
                  on ? "text-seal" : "text-ink",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-base" style={{ fontFamily: "var(--font-display)" }}>
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span>
                </span>
                {on ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </TdSheet>
    </>
  );
}
