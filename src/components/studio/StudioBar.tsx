import { SKINS } from "@/lib/skins/registry";

export function StudioBar({
  templateId,
  saving,
  savedAt,
  onTemplateChange,
  onMint,
}: {
  templateId: string;
  saving: boolean;
  savedAt: string | null;
  onTemplateChange: (id: string) => void;
  onMint?: () => void;
}) {
  return (
    <div
      data-print="hide"
      className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-paper/90 px-3 py-1.5 text-ink backdrop-blur-md"
    >
      <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-soft">
        Template
        <select
          value={templateId}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="rounded-md border border-white/10 bg-paper/40 px-2 py-1 text-[11px] text-ink outline-none focus:border-seal"
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
          className="td-mint-button td-mint-cta group relative inline-flex items-center gap-2.5 rounded-full bg-seal px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-paper transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <span
            aria-hidden
            className="td-mint-pulse inline-block h-2 w-2 rounded-full bg-paper shadow-[0_0_10px_rgba(255,255,255,0.9)]"
          />
          <span className="relative">Mint Your Trip</span>
          <span
            aria-hidden
            className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-paper/40 text-[11px] leading-none transition-transform duration-300 group-hover:translate-x-0.5"
          >
            →
          </span>
        </button>
      ) : (
        <span className="text-[10px] uppercase tracking-[0.3em] text-ink-soft">
          {saving ? "Saving…" : savedAt ? `Saved · ${new Date(savedAt).toLocaleTimeString()}` : "Live"}
          <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-seal align-middle" />
        </span>
      )}
    </div>
  );
}