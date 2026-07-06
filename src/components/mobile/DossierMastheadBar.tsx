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
import { CalendarDays } from "lucide-react";
import { TdSheet } from "@/components/mobile/TdSheet";
import type { Block } from "@/lib/skins/types";
import { cn } from "@/lib/utils";

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
}: {
  title: string;
  blocks: Block[];
}) {
  const days = React.useMemo(() => collectDays(blocks), [blocks]);
  const [past, setPast] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

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
  };

  return (
    <>
      {/* Scroll sentinel: placed by the parent right before the skin render;
          we position it absolutely at 55vh so the bar title appears roughly
          when the hero leaves. */}
      <div ref={sentinelRef} aria-hidden className="absolute left-0 top-[55vh] h-px w-px" />

      <header
        data-print="hide"
        className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-2 border-b border-white/10 bg-paper/90 px-2 backdrop-blur-md md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <Link
          to="/"
          aria-label="Back to TravelDoss"
          className="tap inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:text-seal"
        >
          <span aria-hidden className="text-base">←</span>
        </Link>

        <div
          aria-hidden={!past}
          className={cn(
            "min-w-0 flex-1 truncate text-center text-sm text-ink transition-opacity duration-300",
            past ? "opacity-100" : "opacity-0",
          )}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </div>

        {days.length >= 2 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="tap inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[10px] font-medium uppercase tracking-[0.3em] text-ink-soft transition-colors hover:text-seal"
            aria-haspopup="dialog"
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            Days
          </button>
        ) : (
          <div className="h-11 w-11 shrink-0" aria-hidden />
        )}
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
                      "hover:text-seal focus-visible:outline-none focus-visible:text-seal",
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
