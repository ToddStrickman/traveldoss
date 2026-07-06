/**
 * UnlockBanner — one-shot notice above the blank scaffold telling the
 * owner they've entered edit mode. Session-remembered so it never
 * nags twice on the same visit.
 */
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sparkles, X } from "lucide-react";

const KEY = "td:unlock-banner-dismissed";

export function UnlockBanner({ visible }: { visible: boolean }) {
  const reduce = useReducedMotion();
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem(KEY) === "1") setDismissed(true);
  }, []);

  const show = visible && !dismissed;

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          data-print="hide"
          initial={{ opacity: 0, y: reduce ? 0 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="mx-auto mb-4 flex max-w-3xl items-center gap-3 rounded-full border border-seal/40 bg-paper/90 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-ink backdrop-blur-md"
          role="status"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-seal" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            Editing on — tap any dashed slot to add real content.
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setDismissed(true);
              try {
                sessionStorage.setItem(KEY, "1");
              } catch {
                /* ignore */
              }
            }}
            className="tap inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:text-seal"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}