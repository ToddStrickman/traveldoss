import type { SkinView } from "@/lib/skins/types";

const OPTS: SkinView[] = ["vertical", "horizontal", "grid"];

/** Live Vertical · Horizontal · Grid control, styled from the active skin's
 *  tokens. Shared by the trip studio and the template preview so the two
 *  surfaces stay identical. Switching never mutates content; the swap runs
 *  inside a View Transition where supported (Kinetic Minimalism), skipped
 *  for prefers-reduced-motion. */
export function ViewSwitch({
  value,
  onChange,
  tokens,
  className,
}: {
  value: SkinView;
  onChange: (v: SkinView) => void;
  tokens: { bg: string; ink: string; accent: string; rule: string };
  /** Positioning wrapper classes. Defaults to the studio's fixed top pill. */
  className?: string;
}) {
  const apply = (next: SkinView) => {
    if (next === value) return;
    const run = () => onChange(next);
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (doc.startViewTransition && !reduce) {
      doc.startViewTransition(run);
    } else {
      run();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Layout"
      data-print="hide"
      className={
        className ??
        "fixed left-1/2 top-3 z-50 flex -translate-x-1/2 gap-1 rounded-full p-1 backdrop-blur-sm sm:top-4"
      }
      style={{ background: `${tokens.bg}d9`, border: `1px solid ${tokens.rule}` }}
    >
      {OPTS.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            role="radio"
            aria-checked={on}
            onClick={() => apply(o)}
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
