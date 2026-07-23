import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * A route-line scrollbar that sits ABOVE a horizontal scroller — because
 * the native bar lives at the container's bottom, below the fold, and
 * "scroll down to scroll sideways" is nobody's idea of intuitive.
 *
 * The metaphor is a travel route: a dotted path with a paper plane as the
 * thumb. Drag the plane, click anywhere on the route to jump, or scroll
 * the target normally — the two stay in sync both ways. Renders nothing
 * until the target actually overflows. The plane's hit area is a 44px
 * square on touch.
 */
export function TopScrollbar({
  targetRef,
  ariaLabel = "Scroll days",
}: {
  targetRef: RefObject<HTMLElement | null>;
  ariaLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLButtonElement | null>(null);
  const [metrics, setMetrics] = useState<{ ratio: number; thumbPct: number } | null>(null);
  const drag = useRef<{ pointerId: number; startX: number; startLeft: number } | null>(null);

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow <= 4) {
      setMetrics(null);
      return;
    }
    setMetrics({
      ratio: el.scrollLeft / overflow,
      thumbPct: Math.max(10, (el.clientWidth / el.scrollWidth) * 100),
    });
  }, [targetRef]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    // Content changes (a day added) shift scrollWidth without a resize.
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(measure) : null;
    mo?.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", measure);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [targetRef, measure]);

  const scrollToRatio = useCallback(
    (ratio: number) => {
      const el = targetRef.current;
      if (!el) return;
      const overflow = el.scrollWidth - el.clientWidth;
      el.scrollLeft = Math.max(0, Math.min(1, ratio)) * overflow;
    },
    [targetRef],
  );

  // Hooks all live ABOVE this bail-out — metrics flipping null↔set must
  // never change the hook count.
  const dragStyleBackup = useRef<{ snap: string; behavior: string } | null>(null);

  if (!metrics) return null;

  const onTrackPointerDown = (e: React.PointerEvent) => {
    if (e.target === thumbRef.current || thumbRef.current?.contains(e.target as Node)) return;
    const track = trackRef.current;
    if (!track) return;
    const r = track.getBoundingClientRect();
    const thumbFrac = metrics.thumbPct / 100;
    const ratio = ((e.clientX - r.left) / r.width - thumbFrac / 2) / (1 - thumbFrac);
    scrollToRatio(ratio);
  };

  const onThumbPointerDown = (e: React.PointerEvent) => {
    const el = targetRef.current;
    if (!el) return;
    e.preventDefault();
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startLeft: el.scrollLeft };
    // A dragged surface must track the hand 1:1: scroll-snap quantizes
    // every mid-drag assignment and scroll-behavior:smooth turns each one
    // into a glide that lags the pointer. Suspend both for the drag;
    // restore on release so the board settles onto a column.
    dragStyleBackup.current = {
      snap: el.style.scrollSnapType,
      behavior: el.style.scrollBehavior,
    };
    el.style.scrollSnapType = "none";
    el.style.scrollBehavior = "auto";
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onThumbPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = targetRef.current;
    const track = trackRef.current;
    if (!d || d.pointerId !== e.pointerId || !el || !track) return;
    const overflow = el.scrollWidth - el.clientWidth;
    const usable = track.clientWidth * (1 - metrics.thumbPct / 100);
    if (usable <= 0) return;
    el.scrollLeft = d.startLeft + ((e.clientX - d.startX) / usable) * overflow;
  };
  const onThumbPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    const el = targetRef.current;
    if (el && dragStyleBackup.current) {
      el.style.scrollSnapType = dragStyleBackup.current.snap;
      el.style.scrollBehavior = dragStyleBackup.current.behavior;
      dragStyleBackup.current = null;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const el = targetRef.current;
    if (!el) return;
    const page = el.clientWidth * 0.8;
    if (e.key === "ArrowRight") { e.preventDefault(); el.scrollBy({ left: page, behavior: "smooth" }); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); el.scrollBy({ left: -page, behavior: "smooth" }); }
    else if (e.key === "Home") { e.preventDefault(); el.scrollTo({ left: 0, behavior: "smooth" }); }
    else if (e.key === "End") { e.preventDefault(); el.scrollTo({ left: el.scrollWidth, behavior: "smooth" }); }
  };

  const left = metrics.ratio * (100 - metrics.thumbPct);

  return (
    <div
      ref={trackRef}
      className="tds-topscroll"
      data-print="hide"
      onPointerDown={onTrackPointerDown}
      role="scrollbar"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      aria-valuenow={Math.round(metrics.ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="tds-topscroll-route" aria-hidden />
      <button
        ref={thumbRef}
        type="button"
        className="tds-topscroll-thumb tap"
        style={{ left: `${left}%`, width: `${metrics.thumbPct}%` }}
        onPointerDown={onThumbPointerDown}
        onPointerMove={onThumbPointerMove}
        onPointerUp={onThumbPointerUp}
        onPointerCancel={onThumbPointerUp}
        onKeyDown={onKeyDown}
        aria-label={`${ariaLabel} — drag, or use arrow keys`}
      >
        {/* Paper plane rides the leading edge of the thumb — the traveler
            en route across the itinerary. */}
        <svg
          className="tds-topscroll-plane"
          viewBox="0 0 24 24"
          aria-hidden
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3.5 12 L20.5 4 L14 20 L11.5 13.5 Z" />
          <path d="M11.5 13.5 L20.5 4" />
        </svg>
      </button>
    </div>
  );
}
