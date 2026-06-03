import { SKINS } from "@/lib/skins/registry";
import { Undo2, Redo2 } from "lucide-react";

export function StudioBar({
  templateId,
  saving,
  savedAt,
  onTemplateChange,
  onMint,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  templateId: string;
  saving: boolean;
  savedAt: string | null;
  onTemplateChange: (id: string) => void;
  onMint?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  return (
    <div
      data-print="hide"
      className="fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-paper/90 px-2.5 py-1.5 text-ink backdrop-blur-md sm:gap-3 sm:px-3 bottom-[max(16px,env(safe-area-inset-bottom))] max-w-[calc(100vw-24px)]"
    >
      {(onUndo || onRedo) && (
        <>
          <div className="flex items-center gap-0.5 sm:gap-1">
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
          </div>
          <span className="h-4 w-px bg-white/10" />
        </>
      )}
      <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-soft">
        <span className="hidden sm:inline">Template</span>
        <select
          value={templateId}
          onChange={(e) => onTemplateChange(e.target.value)}
          aria-label="Template"
          className="max-w-[120px] rounded-md border border-white/10 bg-paper/40 px-2 py-2 text-[11px] text-ink outline-none focus:border-seal sm:max-w-none sm:py-1"
        >
          {SKINS.map((s) => (
            <option key={s.meta.id} value={s.meta.id}>
              {s.meta.codename}
            </option>
          ))}
        </select>
      </label>
      <span className="h-4 w-px bg-white/10" />
      {onMint ? (
        <button
          type="button"
          onClick={onMint}
          aria-label="Mint your trip"
          className="td-mint-button td-mint-cta group relative inline-flex min-h-11 items-center gap-2 rounded-full bg-seal px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-paper transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-[11px] sm:tracking-[0.32em]"
        >
          <span
            aria-hidden
            className="td-mint-pulse inline-block h-2 w-2 rounded-full bg-paper shadow-[0_0_10px_rgba(255,255,255,0.9)]"
          />
          <span className="relative">
            <span className="sm:hidden">Mint</span>
            <span className="hidden sm:inline">Mint Your Trip</span>
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