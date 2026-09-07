import { MapPinned } from "lucide-react";
import type { SkinView } from "@/lib/skins/types";

/**
 * The three-layout pivot (vertical · horizontal · grid) — the product's
 * signature move, so it must exist on EVERY surface that renders a dossier:
 * the studio, and the sample preview (SkinPeek). Extracted from t.$slug so
 * no surface grows its own diverging copy again.
 *
 * When `onOpenMap` is provided the pill grows a fourth segment: the Live
 * Map is a lens on the same content, so it sits with the other lenses
 * (owner decision 2026-09-07; never a hovering button).
 *
 * Default className is the studio's fixed top pill (md+ — the mobile studio
 * pivots via DossierMastheadBar); pass className to embed it in-flow.
 */
export function ViewSwitch({
  value,
  onChange,
  tokens,
  className,
  onOpenMap,
  mapOpen = false,
}: {
  value: SkinView;
  onChange: (v: SkinView) => void;
  tokens: { bg: string; ink: string; accent: string; rule: string };
  className?: string;
  /** Renders the Map segment. Omit on surfaces with nothing to map. */
  onOpenMap?: () => void;
  mapOpen?: boolean;
}) {
  const opts: SkinView[] = ["vertical", "horizontal", "grid"];
  return (
    <div
      data-print="hide"
      className={
        className ??
        "fixed left-1/2 top-3 z-50 hidden -translate-x-1/2 items-center gap-1 rounded-full p-1 backdrop-blur-sm sm:top-4 md:flex"
      }
      style={{ background: `${tokens.bg}d9`, border: `1px solid ${tokens.rule}` }}
    >
      <div role="radiogroup" aria-label="Layout" className="flex items-center gap-1">
        {opts.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors sm:px-4 sm:py-2.5"
              style={{ color: on ? tokens.bg : tokens.ink, background: on ? tokens.accent : "transparent" }}
            >
              {o}
            </button>
          );
        })}
      </div>
      {onOpenMap ? (
        <>
          <span aria-hidden className="mx-0.5 h-5 w-px" style={{ background: tokens.rule }} />
          <button
            type="button"
            onClick={onOpenMap}
            aria-haspopup="dialog"
            aria-expanded={mapOpen}
            aria-controls="live-map"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors sm:px-4 sm:py-2.5"
            style={{ color: mapOpen ? tokens.bg : tokens.ink, background: mapOpen ? tokens.accent : "transparent" }}
          >
            <MapPinned className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Map
          </button>
        </>
      ) : null}
    </div>
  );
}
