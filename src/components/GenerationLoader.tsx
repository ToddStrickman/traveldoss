import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

/**
 * Full-surface generation loader. Crossfades through a sequence of steps
 * with the same skeuomorphic surface treatment used across the app.
 */
export function GenerationLoader({
  open,
  steps,
  stepMs = 1100,
  onDone,
}: {
  open: boolean;
  steps: string[];
  stepMs?: number;
  onDone?: () => void;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!open) {
      setI(0);
      return;
    }
    if (i >= steps.length - 1) {
      const t = setTimeout(() => onDone?.(), stepMs);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((n) => n + 1), stepMs);
    return () => clearTimeout(t);
  }, [open, i, steps.length, stepMs, onDone]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="gen-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-paper/85 backdrop-blur-sm"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="surface-card relative flex w-[min(92vw,440px)] flex-col gap-7 rounded-xl px-8 py-10">
            <div className="text-center text-[10px] font-medium uppercase tracking-[0.45em] text-ink-soft">
              Preparing your dossier
            </div>

            {/* stepped list — each step is explicit, no crossfade guessing */}
            <ol className="flex flex-col gap-3">
              {steps.map((label, idx) => {
                const state = idx < i ? "done" : idx === i ? "active" : "pending";
                return (
                  <li
                    key={label}
                    className="flex items-center gap-3 text-[14px] leading-snug"
                    aria-current={state === "active" ? "step" : undefined}
                  >
                    <span
                      aria-hidden
                      className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center"
                    >
                      {state === "done" && (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-seal text-paper">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                      {state === "active" && (
                        <motion.span
                          className="inline-block h-4 w-4 rounded-full border-2 border-seal border-t-transparent"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                      )}
                      {state === "pending" && (
                        <span className="inline-block h-4 w-4 rounded-full border border-ink/20" />
                      )}
                    </span>
                    <span
                      className={
                        state === "active"
                          ? "text-ink"
                          : state === "done"
                            ? "text-ink-soft line-through decoration-ink/20"
                            : "text-ink-soft/60"
                      }
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* hairline progress */}
            <div className="relative h-px w-full overflow-hidden bg-ink/10">
              <motion.span
                className="absolute inset-y-0 left-0 bg-seal"
                initial={false}
                animate={{ width: `${((i + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const DEFAULT_GENERATION_STEPS = [
  "Reading your inbox…",
  "Researching your destination…",
  "Designing your doc…",
];