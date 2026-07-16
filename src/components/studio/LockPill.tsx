/**
 * LockPill — global Lock/Unlock toggle for the dossier canvas.
 *
 * When locked, editables render as static (via editingCtx.editing = false);
 * when unlocked, the canvas becomes interactive. Mobile defaults to locked
 * so a stray finger can't grab a card; desktop defaults to unlocked so
 * clicking straight into a field just works.
 *
 * The visual chrome is minimal by design (Kinetic Minimalism): a small
 * subtle-contrast pill with a Framer Motion crossfade between the two
 * states. `Cmd/Ctrl+E` mirrors the click.
 */
import * as React from "react";
import { Lock, Unlock } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function LockPill({
  locked,
  onToggle,
  variant = "desktop",
  className,
}: {
  locked: boolean;
  onToggle: () => void;
  /** "desktop" = floating top-right pill; "inline" = plain button (for the mobile bar). */
  variant?: "desktop" | "inline";
  className?: string;
}) {
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToggle]);

  const label = locked ? "Edit" : "Done";
  const srLabel = locked ? "Unlock editing" : "Lock editing";
  const Icon = locked ? Lock : Unlock;

  const base =
    "tap inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-[10px] font-medium uppercase tracking-[0.32em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal";
  const desktopChrome =
    variant === "desktop"
      ? cn(
          "fixed right-3 top-3 z-50 hidden border backdrop-blur-md md:inline-flex md:right-4 md:top-4",
          locked
            ? "border-white/15 bg-paper/85 text-ink-soft hover:border-seal hover:text-seal"
            : "border-seal bg-seal/95 text-paper hover:bg-seal",
        )
      : locked
          ? "text-ink-soft hover:text-seal"
          : "text-seal";

  return (
    <button
      type="button"
      onClick={onToggle}
      data-print="hide"
      data-locked={locked ? "true" : "false"}
      aria-pressed={!locked}
      title={`${srLabel} (⌘/Ctrl+E)`}
      aria-label={srLabel}
      className={cn(base, desktopChrome, className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={locked ? "locked" : "unlocked"}
          initial={{ opacity: 0, y: reduce ? 0 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : 4 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="inline-flex items-center gap-2"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          <span>{label}</span>
        </motion.span>
      </AnimatePresence>
    </button>
  );
}