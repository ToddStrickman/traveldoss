import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Full-surface mint loader — honest by construction. The mint is ONE server
 * call the client cannot observe from outside, so this shows one active
 * operation with a rotating description of what that call actually does.
 * No timer-driven checkmarks pretending to track progress (the previous
 * version advanced fake steps every 1100ms and even claimed "Reading your
 * inbox…"); the parent unmounts the loader when the real work completes.
 */
export function GenerationLoader({
  open,
  label = "Composing your dossier",
}: {
  open: boolean;
  label?: string;
}) {
  const DETAILS = [
    "extracting days and places",
    "titling every link",
    "pinning coordinates for the map",
    "setting the type",
  ];
  const [detail, setDetail] = useState(0);

  useEffect(() => {
    if (!open) {
      setDetail(0);
      return;
    }
    const t = setInterval(() => setDetail((n) => (n + 1) % DETAILS.length), 1800);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="gen-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[70] flex min-h-[100dvh] items-center justify-center bg-paper/90 backdrop-blur-sm px-4"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="surface-card relative flex w-[min(92vw,440px)] flex-col items-center gap-6 rounded-xl px-8 py-10 text-center">
            <div className="text-[10px] font-medium uppercase tracking-[0.45em] text-ink-soft">
              Preparing your dossier
            </div>

            <div className="flex items-center gap-3">
              <motion.span
                aria-hidden
                className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-seal border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span className="text-[15px] text-ink">{label}</span>
            </div>

            {/* What the one in-flight call is doing — description, not a
                checklist; nothing is marked complete until it IS. */}
            <AnimatePresence mode="wait">
              <motion.span
                key={detail}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35 }}
                className="text-[12px] italic text-ink-soft"
              >
                — {DETAILS[detail]} —
              </motion.span>
            </AnimatePresence>

            {/* Indeterminate hairline sweep */}
            <div className="relative h-px w-full overflow-hidden bg-ink/10">
              <motion.span
                className="absolute inset-y-0 w-1/3 bg-seal"
                animate={{ left: ["-33%", "100%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
