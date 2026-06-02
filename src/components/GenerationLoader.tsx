import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

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
          <div className="surface-card relative flex w-[min(92vw,420px)] flex-col items-center gap-8 rounded-xl px-10 py-12 text-center">
            {/* breathing gold dot */}
            <motion.span
              aria-hidden
              className="block h-2 w-2 rounded-full bg-seal"
              animate={{ opacity: [0.35, 1, 0.35], scale: [0.9, 1.15, 0.9] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* crossfade label */}
            <div className="relative h-12 w-full">
              <AnimatePresence mode="wait">
                <motion.p
                  key={steps[i]}
                  initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                  transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute inset-x-0 text-lg italic leading-snug text-ink"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {steps[i]}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* hairline progress */}
            <div className="relative h-px w-full overflow-hidden bg-white/5">
              <motion.span
                className="absolute inset-y-0 left-0 bg-seal"
                initial={false}
                animate={{ width: `${((i + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>

            {/* step counter */}
            <div className="flex items-center gap-3 text-[9px] font-medium uppercase tracking-[0.45em] text-ink-soft">
              <span className="h-px w-6 bg-white/10" />
              Step {i + 1} of {steps.length}
              <span className="h-px w-6 bg-white/10" />
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