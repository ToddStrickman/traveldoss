import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Autosave status as a moment of delight instead of a timer readout:
 * a checkmark draws itself in each time a save lands ("saved" should feel
 * like a small cheers, not a log line). Timestamps are gone — the user
 * cares that their work is safe, not at which second it became safe.
 * Error and in-flight states stay text-first because those ARE log-worthy.
 */
export function SavedCheck({
  saving,
  savedAt,
  saveError,
  idleLabel = "Live",
  className,
}: {
  saving: boolean;
  savedAt: string | null;
  saveError?: boolean;
  /** Shown before the first save of the session. */
  idleLabel?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (saveError) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-red-400",
          className,
        )}
        role="alert"
      >
        <span>Not saved — retrying</span>
        <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-ink-soft",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {saving ? (
        <span>Saving…</span>
      ) : savedAt ? (
        // Keyed by savedAt: every landed save replays the draw-in, so the
        // user gets a fresh, quick "✓ saved" beat after each edit settles.
        <motion.span
          key={savedAt}
          className="inline-flex items-center gap-1.5"
          initial={reduced ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 24 }}
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 text-seal"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <motion.path
              d="M3 8.5 L6.5 12 L13 4.5"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
            />
          </svg>
          <span>Saved</span>
        </motion.span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <span>{idleLabel}</span>
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-seal" />
        </span>
      )}
    </span>
  );
}
