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
          className="td-mint-button group inline-flex items-center gap-2 rounded-full bg-seal/15 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-seal transition-colors hover:bg-seal hover:text-paper"
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-seal shadow-[0_0_8px_currentColor] group-hover:bg-paper"
          />
          Mint Your Trip
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