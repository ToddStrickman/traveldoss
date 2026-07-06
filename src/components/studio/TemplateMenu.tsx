/**
 * TemplateMenu — dossier-template picker, extracted off the bottom bar.
 *
 * Template swaps are a deliberate design choice, not a per-edit action,
 * so they belong out of the writing surface. Desktop uses a floating
 * quiet chip near the LockPill; the same button also carries the
 * "Regenerate from source…" action that used to live as "Replace
 * itinerary" in the bottom bar.
 */
import * as React from "react";
import { Palette, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SKINS } from "@/lib/skins/registry";
import { cn } from "@/lib/utils";

export function TemplateMenu({
  templateId,
  onTemplateChange,
  onRegenerate,
  variant = "desktop",
  className,
}: {
  templateId: string;
  onTemplateChange: (id: string) => void;
  /** Optional secondary action — reopens the ingestion modal. */
  onRegenerate?: () => void;
  variant?: "desktop" | "inline";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const active = SKINS.find((s) => s.meta.id === templateId) ?? SKINS[0];

  const trigger =
    variant === "desktop" ? (
      <button
        type="button"
        data-print="hide"
        className={cn(
          "tap fixed right-3 top-16 z-50 hidden min-h-11 items-center gap-2 rounded-full border border-white/15 bg-paper/85 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.32em] text-ink-soft backdrop-blur-md transition-colors hover:border-seal hover:text-seal md:inline-flex md:right-4 md:top-[4.25rem]",
          className,
        )}
        aria-label="Dossier template"
      >
        <Palette className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">{active.meta.codename}</span>
      </button>
    ) : (
      <button
        type="button"
        className={cn(
          "tap flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-ink transition-colors hover:bg-ink/5",
          className,
        )}
      >
        <Palette className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm">Template</span>
          <span className="block text-[11px] text-ink-soft">{active.meta.codename}</span>
        </span>
      </button>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={variant === "desktop" ? "end" : "center"}
        side={variant === "desktop" ? "bottom" : "top"}
        className="w-64 border border-white/10 bg-paper/95 p-0 text-ink backdrop-blur-md"
      >
        <div className="border-b border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-ink-soft">
          Dossier template
        </div>
        <ul className="max-h-64 overflow-y-auto">
          {SKINS.map((s) => {
            const on = s.meta.id === templateId;
            return (
              <li key={s.meta.id}>
                <button
                  type="button"
                  onClick={() => {
                    onTemplateChange(s.meta.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[12px] transition-colors hover:bg-ink/5",
                    on && "text-seal",
                  )}
                >
                  <span className="truncate">{s.meta.codename}</span>
                  {on ? (
                    <span className="shrink-0 text-[9px] uppercase tracking-[0.3em]">Active</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {onRegenerate ? (
          <div className="border-t border-white/10 p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRegenerate();
              }}
              className="tap inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[11px] uppercase tracking-[0.28em] text-ink-soft transition-colors hover:bg-ink/5 hover:text-seal"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Regenerate from source…
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}