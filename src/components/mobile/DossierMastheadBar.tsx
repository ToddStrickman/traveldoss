/**
 * DossierMastheadBar — mobile-only top chrome for /t/<slug>.
 *
 * Replaces three competing fixed elements (back pill, top view pills,
 * floating badges) with one calm bar: back, the trip title (which fades in
 * only after the skin's own masthead scrolls away — the skin's hero stays
 * the hero), and a Days button opening the day-jump sheet.
 *
 * Day jumping targets the shared views' `[data-block="day"]` sections;
 * `.tds-part { scroll-margin-top }` in skin.css keeps anchors clear of
 * this bar. The current trip day (when dates are known) is highlighted —
 * mid-trip readers land on *tonight*, not Day 1.
 */
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { CalendarDays } from "lucide-react";
import { TdSheet } from "@/components/mobile/TdSheet";
import type { Block } from "@/lib/skins/types";
import type { SkinView } from "@/lib/skins/types";
import { cn } from "@/lib/utils";
import { LockPill } from "@/components/studio/LockPill";
import { SharedDossierCard } from "@/components/studio/SharedDossierCard";
import { ViewPill } from "@/components/mobile/ViewSheet";

interface DayEntry {
  n: number;
  label?: string;
  date?: string;
  /** Index of the day block in the flat blocks array (DOM lookup key). */
  blockIndex: number;
}

function collectDays(blocks: Block[]): DayEntry[] {
  const days: DayEntry[] = [];
  blocks.forEach((b, i) => {
    if (b.kind === "day") {
      days.push({ n: b.n, label: b.label, date: b.date, blockIndex: i });
    }
  });
  return days;
}

/** Parse a stored day date (ISO-ish) to a local-midnight timestamp. */
function dayStamp(date?: string): number | null {
  if (!date) return null;
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

export function DossierMastheadBar({
  title,
  blocks,
  slug,
  canEdit = false,
  locked = false,
  onToggleLock,
  tokens,
  layout,
  onLayoutChange,
  saving = false,
  savedAt = null,
  saveError = false,
}: {
  title: string;
  blocks: Block[];
  /** Trip slug — enables the Share button in the header. */
  slug?: string;
  canEdit?: boolean;
  locked?: boolean;
  onToggleLock?: () => void;
  /** Active skin tokens — used so the bar picks up the skin's paper/ink
   *  instead of the global dark-navy defaults (breaks contrast on light skins). */
  tokens?: { bg: string; ink: string; rule: string };
  /** Current layout + setter. When provided, the bar renders an inline
   *  view switcher so mobile has the same VERTICAL/HORIZONTAL/GRID access as desktop. */
  layout?: SkinView;
  onLayoutChange?: (v: SkinView) => void;
  /** Autosave state — mirrors the desktop EditingStatusBar so mobile owners
   *  get the same "saving / synced / offline" confirmation. */
  saving?: boolean;
  savedAt?: string | null;
  saveError?: boolean;
}) {
  const days = React.useMemo(() => collectDays(blocks), [blocks]);
  const [past, setPast] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // Title appears once the skin's own hero has scrolled off. The sentinel
  // sits just after the hero region (~55vh into the document).
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: "-56px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const today = React.useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }, []);

  const currentN = React.useMemo(() => {
    for (const d of days) {
      const t = dayStamp(d.date);
      if (t !== null && t === today) return d.n;
    }
    return null;
  }, [days, today]);

  const jump = (entry: DayEntry) => {
    setOpen(false);
    // The shared views render one `section[data-block="day"]` per day, in order.
    const sections = document.querySelectorAll('section[data-block="day"]');
    const target = sections[days.findIndex((d) => d.blockIndex === entry.blockIndex)];
    if (!(target instanceof HTMLElement)) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // Two-pass correction: sections above the target use content-visibility
    // size estimates until they render, so the first scroll can land slightly
    // off on long trips. Re-anchor once layout has settled.
    window.setTimeout(() => {
      // Expected resting offset = the section's scroll-margin-top (clears
      // the fixed bar). Re-anchor only if content-visibility estimates
      // left us meaningfully off.
      const expected = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const rect = target.getBoundingClientRect();
      if (Math.abs(rect.top - expected) > 8) {
        target.scrollIntoView({ behavior: "auto", block: "start" });
      }
    }, reduce ? 80 : 480);
  };

  return (
    <>
      {/* Scroll sentinel: placed by the parent right before the skin render;
          we position it absolutely at 55vh so the bar title appears roughly
          when the hero leaves. */}
      <div ref={sentinelRef} aria-hidden className="absolute left-0 top-[55vh] h-px w-px" />

      <header
        data-print="hide"
        className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-2 border-b px-2 backdrop-blur-md md:hidden"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          background: tokens
            ? `color-mix(in oklab, ${tokens.bg} 94%, transparent)`
            : undefined,
          color: tokens?.ink,
          borderColor: tokens
            ? `color-mix(in oklab, ${tokens.rule} 40%, transparent)`
            : undefined,
        }}
      >
        <Link
          to="/"
          aria-label="Back to TravelDoss"
          className="tap inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:text-seal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal"
          style={
            tokens
              ? { color: `color-mix(in oklab, ${tokens.ink} 82%, transparent)` }
              : undefined
          }
        >
          <span aria-hidden className="text-base">←</span>
        </Link>

        <div
          aria-hidden={!past}
          className={cn(
            "min-w-0 flex-1 truncate text-center text-sm transition-opacity duration-300 motion-reduce:transition-none",
            past ? "opacity-100" : "opacity-0",
          )}
          style={{ fontFamily: "var(--font-display)", color: tokens?.ink }}
        >
          {title}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canEdit && !locked ? (
            <span
              className="hidden xs:inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.28em]"
              role={saveError ? "alert" : "status"}
              aria-live="polite"
              style={{
                color: tokens
                  ? saveError
                    ? "#ef4444"
                    : `color-mix(in oklab, ${tokens.ink} 55%, transparent)`
                  : undefined,
              }}
              title={
                saveError
                  ? "Offline — waiting"
                  : saving
                    ? "Saving…"
                    : savedAt
                      ? "All changes synced"
                      : "Auto-saves as you type"
              }
            >
              {!saveError && !saving && savedAt ? (
                // A save just landed (or holds): a small check, redrawn per
                // save (keyed by savedAt) — the mobile "quick saved" beat.
                <motion.svg
                  key={savedAt}
                  viewBox="0 0 16 16"
                  className="h-3 w-3 text-seal"
                  aria-hidden
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 24 }}
                >
                  <motion.path
                    d="M3 8.5 L6.5 12 L13 4.5"
                    initial={reducedMotion ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </motion.svg>
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    saveError ? "animate-pulse bg-red-500" : saving ? "animate-pulse bg-seal" : "bg-seal/60",
                  )}
                />
              )}
              <span className="hidden sm:inline">
                {saveError ? "Offline" : saving ? "Saving" : savedAt ? "Saved" : "Auto"}
              </span>
            </span>
          ) : null}
          {layout && onLayoutChange ? (
            <ViewPill value={layout} onChange={onLayoutChange} variant="inline" />
          ) : null}
          {days.length >= 2 ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="tap inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[10px] font-medium uppercase tracking-[0.3em] transition-colors hover:text-seal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal"
              style={
                tokens
                  ? { color: `color-mix(in oklab, ${tokens.ink} 70%, transparent)` }
                  : undefined
              }
              aria-haspopup="dialog"
              aria-label="Jump to day"
            >
              <CalendarDays className="h-4 w-4" aria-hidden />
              <span className="hidden xs:inline">Days</span>
            </button>
          ) : null}
          {canEdit && onToggleLock ? (
            <LockPill locked={locked} onToggle={onToggleLock} variant="inline" />
          ) : null}
          {slug ? <SharedDossierCard slug={slug} compact /> : null}
          {!canEdit && days.length < 2 && !layout ? (
            <div className="h-11 w-11 shrink-0" aria-hidden />
          ) : null}
        </div>
      </header>

      <TdSheet
        open={open}
        onOpenChange={setOpen}
        title="Jump to day"
        description={currentN ? "Today is highlighted." : undefined}
      >
        <nav aria-label="Days">
          <ul className="flex flex-col">
            {days.map((d) => {
              const isToday = d.n === currentN;
              return (
                <li key={d.blockIndex}>
                  <button
                    type="button"
                    onClick={() => jump(d)}
                    className={cn(
                      "flex w-full items-baseline gap-4 border-b border-white/5 py-4 text-left transition-colors last:border-b-0",
                      "hover:text-seal focus-visible:outline-none focus-visible:text-seal focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-seal/60",
                      isToday ? "text-seal" : "text-ink",
                    )}
                    aria-current={isToday ? "date" : undefined}
                  >
                    <span className="w-16 shrink-0 text-[10px] uppercase tracking-[0.35em] text-ink-soft">
                      Day {String(d.n).padStart(2, "0")}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-lg"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {d.label || `Day ${d.n}`}
                    </span>
                    {isToday ? (
                      <span className="shrink-0 text-[9px] uppercase tracking-[0.3em]">Today</span>
                    ) : d.date ? (
                      <span className="shrink-0 text-[11px] tabular-nums text-ink-soft">{d.date}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </TdSheet>
    </>
  );
}
