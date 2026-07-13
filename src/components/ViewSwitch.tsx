import type { SkinView } from "@/lib/skins/types";

/**
 * The three-layout pivot (vertical · horizontal · grid) — the product's
 * signature move, so it must exist on EVERY surface that renders a dossier:
 * the studio, and the sample preview (SkinPeek). Extracted from t.$slug so
 * no surface grows its own diverging copy again.
 *
 * Default className is the studio's fixed top pill (md+ — the mobile studio
 * pivots via DossierMastheadBar); pass className to embed it in-flow.
 */
export function ViewSwitch({
  value,
  onChange,
  tokens,
  className,
}: {
  value: SkinView;
  onChange: (v: SkinView) => void;
  tokens: { bg: string; ink: string; accent: string; rule: string };
  className?: string;
}) {
  const opts: SkinView[] = ["vertical", "horizontal", "grid"];
  return (
    <div
      role="radiogroup"
      aria-label="Layout"
      data-print="hide"
      className={
        className ??
        "fixed left-1/2 top-3 z-50 hidden -translate-x-1/2 gap-1 rounded-full p-1 backdrop-blur-sm sm:top-4 md:flex"
      }
      style={{ background: `${tokens.bg}d9`, border: `1px solid ${tokens.rule}` }}
    >
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
  );
}
