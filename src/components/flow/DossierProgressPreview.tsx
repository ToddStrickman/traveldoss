import type { CSSProperties } from "react";
import type { DossierProgressPreview as DossierProgressPreviewData } from "@/lib/itinerary/progress-preview";

function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function countLine(preview: DossierProgressPreviewData): string {
  const parts = [
    preview.counts.days ? `${preview.counts.days} day${preview.counts.days === 1 ? "" : "s"}` : null,
    preview.counts.stops ? `${preview.counts.stops} stop${preview.counts.stops === 1 ? "" : "s"}` : null,
    preview.counts.flights ? `${preview.counts.flights} flight${preview.counts.flights === 1 ? "" : "s"}` : null,
    preview.counts.hotels ? `${preview.counts.hotels} stay${preview.counts.hotels === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Structure forming";
}

export function HourglassProgress({ pct, className = "" }: { pct: number; className?: string }) {
  const clamped = clampPct(pct);
  const remaining = Math.max(0, 100 - clamped);
  const style = {
    "--td-hourglass-progress": String(clamped / 100),
    "--td-hourglass-remaining": String(remaining / 100),
  } as CSSProperties & Record<"--td-hourglass-progress" | "--td-hourglass-remaining", string>;

  return (
    <span
      className={`td-hourglass inline-flex items-center gap-2 text-seal ${className}`}
      style={style}
      role="img"
      aria-label={`${remaining}% remaining`}
    >
      <span className="td-hourglass-icon" aria-hidden>
        <span className="td-hourglass-frame" />
        <span className="td-hourglass-sand td-hourglass-sand-top" />
        <span className="td-hourglass-stream" />
        <span className="td-hourglass-sand td-hourglass-sand-bottom" />
      </span>
      <span className="font-mono text-[10px] tracking-[0.18em] text-seal/80 tabular-nums">
        {remaining}% left
      </span>
    </span>
  );
}

export function DossierProgressPreview({
  preview,
  pct,
  className = "",
}: {
  preview: DossierProgressPreviewData;
  pct: number;
  className?: string;
}) {
  const clamped = clampPct(pct);
  return (
    <section
      className={`rounded-md border border-seal/25 bg-seal/10 px-4 py-4 text-left ${className}`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="td-eyebrow text-ink/45">Dossier preview</p>
          <h3 className="td-headline mt-2 text-[1.9rem] leading-[1] text-ink sm:text-[2.25rem]">
            {preview.title}
            <span className="text-seal">.</span>
          </h3>
        </div>
        <HourglassProgress pct={clamped} className="shrink-0 pt-1" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] leading-[1.45] text-ink-soft">
        {preview.dateLine ? <span>{preview.dateLine}</span> : null}
        <span>{countLine(preview)}</span>
      </div>

      {preview.highlights.length ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 edge-fade-x">
          {preview.highlights.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="shrink-0 rounded-full border border-ink/10 bg-paper/35 px-3 py-1 text-[11px] text-ink/70"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 h-px w-full overflow-hidden bg-ink/10" aria-hidden>
        <span
          className="block h-full rounded-full bg-seal motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-linear"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </section>
  );
}

export type { DossierProgressPreviewData };