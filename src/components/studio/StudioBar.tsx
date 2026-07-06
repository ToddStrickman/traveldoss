import { SKINS } from "@/lib/skins/registry";
import { cn } from "@/lib/utils";
import { Undo2, Redo2, History } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type RefineHistoryEntry = {
  id: string;
  at: number;
  reason: string;
};

export function StudioBar({
  templateId,
  saving,
  savedAt,
  onTemplateChange,
  onMint,
  mintLabel,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  refineStatus,
  refineHistory,
  onRestoreRefine,
  emphasis,
  leadingSlot,
}: {
  templateId: string;
  saving: boolean;
  savedAt: string | null;
  onTemplateChange: (id: string) => void;
  onMint?: () => void;
  mintLabel?: string;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  refineStatus?: "idle" | "sharpening" | "error";
  refineHistory?: RefineHistoryEntry[];
  onRestoreRefine?: (id: string) => void;
  /** "mint" = sample/pre-mint: on phones the bar collapses to
   *  [leadingSlot] [Mint this dossier] — the IA's one-bar budget. */
  emphasis?: "mint";
  leadingSlot?: React.ReactNode;
}) {
  const mintFocus = emphasis === "mint";
  const hasRefineHistory = !!refineHistory && refineHistory.length > 0;
  return (
    <div
      data-print="hide"
      className={cn(
        "fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-paper/90 px-2 py-1.5 text-ink backdrop-blur-md sm:gap-3 sm:px-3 bottom-[max(16px,env(safe-area-inset-bottom))] max-w-[calc(100vw-16px)]",
        mintFocus && "max-sm:w-[calc(100vw-24px)] max-sm:justify-between max-sm:gap-2",
      )}
    >
      {leadingSlot}
      {(onUndo || onRedo) && (
        <>
          <div className={cn("flex items-center gap-0.5 sm:gap-1", mintFocus && "max-sm:hidden")}>
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo (⌘Z)"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-seal disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-soft sm:h-8 sm:w-8"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo"
              title="Redo (⇧⌘Z)"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-seal disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-soft sm:h-8 sm:w-8"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={!hasRefineHistory}
                  aria-label="Refinement history"
                  title="Refinement history"
                  className="hidden sm:inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-seal disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-soft sm:h-8 sm:w-8"
                >
                  <History className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="center"
                side="top"
                className="w-72 p-0 border border-white/10 bg-paper/95 text-ink backdrop-blur-md"
              >
                <div className="border-b border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-ink-soft">
                  Refinement history
                </div>
                <ul className="max-h-64 overflow-y-auto">
                  {(refineHistory ?? []).map((entry, i) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => onRestoreRefine?.(entry.id)}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-[12px] transition-colors hover:bg-ink/5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ink">
                            {i === 0 ? "Latest · " : ""}
                            {entry.reason}
                          </span>
                          <span className="block text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                            {new Date(entry.at).toLocaleTimeString()}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.3em] text-seal">
                          Restore
                        </span>
                      </button>
                    </li>
                  ))}
                  {!hasRefineHistory && (
                    <li className="px-3 py-4 text-center text-[11px] text-ink-soft">
                      No refinements yet.
                    </li>
                  )}
                </ul>
              </PopoverContent>
            </Popover>
          </div>
          <span className="hidden sm:inline-block h-4 w-px bg-white/10" />
        </>
      )}
      <label className={cn("flex shrink items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-soft min-w-0", mintFocus && "max-sm:hidden")}>
        <span className="hidden sm:inline">Dossier Template</span>
        <select
          value={templateId}
          onChange={(e) => onTemplateChange(e.target.value)}
          aria-label="Dossier Template"
          className="max-w-[88px] sm:max-w-none rounded-md border border-white/10 bg-paper/40 px-2 py-2 text-[11px] text-ink outline-none focus:border-seal sm:py-1"
        >
          {SKINS.map((s) => (
            <option key={s.meta.id} value={s.meta.id}>
              {s.meta.codename}
            </option>
          ))}
        </select>
      </label>
      <span className="hidden sm:inline-block h-4 w-px bg-white/10" />
      {refineStatus && refineStatus !== "idle" && (
        <span
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-ink-soft"
          aria-live="polite"
        >
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              refineStatus === "error" ? "bg-red-500" : "bg-seal animate-pulse"
            }`}
          />
          <span className="hidden sm:inline">
            {refineStatus === "error" ? "Refine failed" : "Sharpening…"}
          </span>
        </span>
      )}
      {onMint ? (
        <button
          type="button"
          onClick={onMint}
          aria-label="Mint your trip"
          className={cn(
            "td-mint-button td-mint-cta group relative inline-flex shrink-0 min-h-11 items-center gap-1.5 rounded-full bg-seal px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-paper transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-[11px] sm:tracking-[0.32em]",
            mintFocus && "max-sm:flex-1 max-sm:justify-center",
          )}
        >
          <span
            aria-hidden
            className="td-mint-pulse inline-block h-2 w-2 rounded-full bg-paper shadow-[0_0_10px_rgba(255,255,255,0.9)]"
          />
          <span className="relative">
            <span className="sm:hidden">
              {mintFocus ? "Mint this dossier" : mintLabel ?? "Mint"}
            </span>
            <span className="hidden sm:inline">
              {mintLabel === "Replace" ? "Replace itinerary" : "Mint your trip"}
            </span>
          </span>
          <span
            aria-hidden
            className="ml-0.5 hidden h-5 w-5 items-center justify-center rounded-full border border-paper/40 text-[11px] leading-none transition-transform duration-300 group-hover:translate-x-0.5 sm:ml-1 sm:inline-flex"
          >
            →
          </span>
        </button>
      ) : (
        <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-soft">
          <span className="hidden sm:inline">
            {saving ? "Saving…" : savedAt ? `Saved · ${new Date(savedAt).toLocaleTimeString()}` : "Live"}
          </span>
          <span className="sm:hidden" aria-label={saving ? "Saving" : "Saved"}>
            {saving ? "•••" : "✓"}
          </span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-seal align-middle" />
        </span>
      )}
    </div>
  );
}