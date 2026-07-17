import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronLeft, ChevronRight, Images, Info, X } from "lucide-react";
import type { Block, GalleryImage, TripView } from "../../types";
import { useInertRender } from "../views/parts";
import { useEditing } from "../Editable";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * CoverflowGallery — the iPod-style photo carousel (PRD: one centered hero
 * card, flanking cards scaled + rotated into 3D, swipe/drag/arrow/keyboard
 * navigation, wrap-around, reduced-motion crossfade). One component, two
 * mounts: inline in the Vertical view, fullscreen overlay from the rainbow
 * gallery icon in Horizontal/Grid. Themed entirely by the active template's
 * --tds-* tokens; zero animation libraries (CSS transforms + one pointer
 * handler).
 */

/** Deep-link (PRD 5.3): ?gallery=<index> opens the overlay on that photo.
 *  Managed via history.replaceState so it works on every route without
 *  router coupling. */
export function readGalleryParam(): number | null {
  const raw = new URLSearchParams(window.location.search).get("gallery");
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
export function writeGalleryParam(index: number | null): void {
  const url = new URL(window.location.href);
  if (index == null) url.searchParams.delete("gallery");
  else url.searchParams.set("gallery", String(index));
  window.history.replaceState(window.history.state, "", url);
}

// A single hero image still deserves an entry point — owners uploading
// one photo expect to see it open in the gallery overlay.
const MIN_IMAGES = 1;
const MAX_IMAGES = 24;
/** Licenses that do not require visible credit (record still stored). */
const NO_CREDIT = /^(cc0|pdm|public domain|pexels|pixabay)/i;

/** Collect the trip's gallery: explicit gallery blocks first, then the
 *  fallback aggregation (hero image), deduped by src, capped. */
export function collectGalleryImages(trip: TripView, blocks: Block[]): { title?: string; images: GalleryImage[] } {
  const images: GalleryImage[] = [];
  let title: string | undefined;
  for (const b of blocks) {
    if (b.kind === "gallery") {
      title = title ?? b.title;
      images.push(...b.images);
    }
  }
  if (images.length === 0 && trip.hero_image_url) {
    images.push({ src: trip.hero_image_url, alt: `${trip.destination} hero image` });
  }
  // PRD 2.2 fallback aggregation: day + place images join the pool so the
  // coverflow always reflects everything pictured in the itinerary.
  for (const b of blocks) {
    if ((b.kind === "place" || b.kind === "day") && b.images?.length) {
      images.push(...b.images);
    }
  }
  const seen = new Set<string>();
  const deduped = images.filter((im) => {
    if (!im.src || seen.has(im.src)) return false;
    seen.add(im.src);
    return true;
  });
  return { title, images: deduped.slice(0, MAX_IMAGES) };
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export function CoverflowGallery({
  images,
  title,
  mode,
  onClose,
  onOpenOverlay,
  initialIndex = 0,
}: {
  images: GalleryImage[];
  title?: string;
  mode: "inline" | "overlay";
  /** Overlay only: close handler (Escape / X / backdrop / swipe-down). */
  onClose?: () => void;
  /** Inline only: invoked when the center card is tapped on touch devices. */
  onOpenOverlay?: (index: number) => void;
  initialIndex?: number;
}) {
  const n = images.length;
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(n - 1, 0)));
  const [drag, setDrag] = useState(0); // fractional cards, -1..1 while dragging
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [creditFor, setCreditFor] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const ptr = useRef<{
    id: number;
    x0: number;
    y0: number;
    t0: number;
    claimed: boolean;
    dy: number;
  } | null>(null);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => ((i + delta) % n + n) % n);
      setDrag(0);
      try {
        navigator.vibrate?.(8);
      } catch {
        /* unsupported */
      }
    },
    [n],
  );

  // Keyboard: arrows step, Home/End jump, Escape closes overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode === "overlay" && e.key === "Escape") {
        onClose?.();
        return;
      }
      // Inline: only react when the gallery (or a child) has focus.
      if (mode === "inline" && !trackRef.current?.closest("[data-gallery]")?.contains(document.activeElement)) {
        return;
      }
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(n - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, n, mode, onClose]);

  // Overlay: lock body scroll while open.
  useEffect(() => {
    if (mode !== "overlay") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mode]);

  // ── Pointer drag: cards track the finger 1:1; snap or flick on release ──
  const cardWidth = () => {
    const track = trackRef.current;
    if (!track) return 320;
    const card = track.querySelector<HTMLElement>("[data-card-pos='0']");
    return card?.offsetWidth ?? Math.min(track.offsetWidth * 0.6, 320);
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (reduced) return;
    ptr.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), claimed: false, dy: 0 };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const p = ptr.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x0;
    const dy = e.clientY - p.y0;
    p.dy = dy;
    if (!p.claimed) {
      // Claim only on clear horizontal intent so vertical page scroll survives.
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        p.claimed = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } else {
        return;
      }
    }
    e.preventDefault();
    setDrag(Math.max(-1, Math.min(1, -dx / cardWidth())));
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const p = ptr.current;
    if (!p || p.id !== e.pointerId) return;
    ptr.current = null;
    if (!p.claimed) {
      // Overlay swipe-down dismissal: fast vertical fling anywhere.
      if (mode === "overlay" && p.dy > 40) {
        const vy = p.dy / Math.max(1, performance.now() - p.t0);
        if (vy > 0.5) {
          onClose?.();
          return;
        }
      }
      return;
    }
    const dx = e.clientX - p.x0;
    const dt = Math.max(1, performance.now() - p.t0);
    const vx = dx / dt; // px per ms
    // A flick advances exactly one card; coverflow steps, never free-scrolls.
    if (Math.abs(vx) > 0.4) go(vx < 0 ? 1 : -1);
    else if (Math.abs(drag) > 0.5) go(drag > 0 ? 1 : -1);
    else setDrag(0);
  };

  // Wide overlay cards vs. inline cards — CSS handles sizing via mode attr.
  const visible = useMemo(() => {
    // Pre-render center ± 2 for instant transitions (PRD 3.1).
    const out: Array<{ image: GalleryImage; i: number; pos: number }> = [];
    for (let d = -2; d <= 2; d++) {
      if (n === 0) break;
      const i = ((index + d) % n + n) % n;
      // On tiny sets avoid rendering the same image twice.
      if (out.some((o) => o.i === i)) continue;
      out.push({ image: images[i], i, pos: d });
    }
    return out;
  }, [images, index, n]);

  if (n < MIN_IMAGES) return null;

  const needsCredit = (im: GalleryImage) => !!im.license && !NO_CREDIT.test(im.license);

  const counter = (
    <div className="tds-gal-counter" aria-label={`Photo ${index + 1} of ${n}`}>
      <span className="tds-gal-counter-now">{String(index + 1).padStart(2, "0")}</span>
      <span className="tds-gal-counter-total">/{String(n).padStart(2, "0")}</span>
    </div>
  );

  const dashes = (
    <div className="tds-gal-dashes" aria-hidden>
      {images.slice(0, Math.min(n, 8)).map((_, i) => {
        const active = n <= 8 ? i === index : i === Math.min(index, 7);
        const compressed = n > 8 && i === 7;
        return (
          <span
            key={i}
            className={`tds-gal-dash${active ? " is-active" : ""}${compressed ? " is-compressed" : ""}`}
          />
        );
      })}
    </div>
  );

  const stage = (
    <div
      ref={trackRef}
      className="tds-gal-track"
      role="region"
      aria-roledescription="carousel"
      aria-label={title ?? "Trip photo gallery"}
      data-reduced={reduced || undefined}
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        ptr.current = null;
        setDrag(0);
      }}
    >
      {visible.map(({ image, i, pos }) => {
        const p = pos - drag; // fractional position during drag
        const abs = Math.abs(p);
        const scale = abs < 1 ? 1 - 0.18 * abs : 0.82 - 0.12 * Math.min(abs - 1, 1);
        const rotate = Math.max(-18, Math.min(18, p * -18));
        const translate = p * 62; // % of card width
        const opacity = abs >= 2 ? 0 : abs > 1 ? 0.9 - (abs - 1) * 0.9 : 1 - 0.1 * abs;
        const isCenter = pos === 0;
        const broken = failed.has(i);
        return (
          <button
            key={`${image.src}-${i}`}
            type="button"
            data-card-pos={pos}
            className="tds-gal-card"
            role="group"
            aria-label={`Photo ${i + 1} of ${n}: ${image.alt}`}
            aria-current={isCenter || undefined}
            aria-hidden={Math.abs(pos) >= 2 || undefined}
            tabIndex={isCenter ? 0 : -1}
            style={{
              transform: `translate(-50%, -50%) translateX(${translate}%) rotateY(${rotate}deg) scale(${scale})`,
              opacity,
              zIndex: 10 - Math.round(abs * 2),
              pointerEvents: abs >= 2 ? "none" : undefined,
              filter: abs > 0.5 && !reduced ? "blur(0.5px)" : undefined,
              transition: ptr.current?.claimed
                ? "none"
                : reduced
                  ? "opacity 200ms ease"
                  : "transform 450ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms ease",
            }}
            onClick={() => {
              if (Math.abs(drag) > 0.05) return; // it was a drag, not a tap
              if (!isCenter) go(pos);
              else if (mode === "inline") onOpenOverlay?.(index);
            }}
          >
            {broken ? (
              <span className="tds-gal-card-fallback">{image.caption ?? image.alt}</span>
            ) : (
              <img
                src={image.src}
                alt={image.alt}
                loading={Math.abs(pos) <= 1 ? "eager" : "lazy"}
                draggable={false}
                style={
                  image.focalPoint
                    ? { objectPosition: `${image.focalPoint.x * 100}% ${image.focalPoint.y * 100}%` }
                    : undefined
                }
                onError={() => setFailed((prev) => new Set(prev).add(i))}
              />
            )}
            {image.caption ? <span className="tds-gal-caption">{image.caption}</span> : null}
            {isCenter && needsCredit(image) ? (
              <span
                role="button"
                tabIndex={0}
                className="tds-gal-credit-btn"
                aria-label="Photo attribution"
                onClick={(e) => {
                  e.stopPropagation();
                  setCreditFor(creditFor === i ? null : i);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setCreditFor(creditFor === i ? null : i);
                  }
                }}
              >
                <Info size={12} aria-hidden />
              </span>
            ) : null}
            {isCenter && creditFor === i ? (
              <span className="tds-gal-credit" onClick={(e) => e.stopPropagation()}>
                Photo{image.creator ? `: ${image.creator}` : ""} · {image.license}
                {image.sourcePageUrl ? (
                  <>
                    {" · "}
                    <a href={image.sourcePageUrl} target="_blank" rel="noreferrer">
                      source
                    </a>
                  </>
                ) : null}
              </span>
            ) : null}
          </button>
        );
      })}
      <button type="button" className="tds-gal-arrow tds-gal-arrow-left" aria-label="Previous photo" onClick={() => go(-1)}>
        <ChevronLeft size={16} aria-hidden />
      </button>
      <button type="button" className="tds-gal-arrow tds-gal-arrow-right" aria-label="Next photo" onClick={() => go(1)}>
        <ChevronRight size={16} aria-hidden />
      </button>
    </div>
  );

  const announcer = (
    <span className="tds-gal-sr" aria-live="polite">
      {`Photo ${index + 1} of ${n}${images[index]?.alt ? `: ${images[index].alt}` : ""}`}
    </span>
  );
  const sourcedFooter = images.some((im) => im.provider) ? (
    <div className="tds-gal-sourced">Some photos via Openverse / Wikimedia Commons</div>
  ) : null;

  if (mode === "overlay") {
    return (
      <div
        className="tds-gal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Trip photo gallery"}
        data-print="hide"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <button type="button" className="tds-gal-close" aria-label="Close gallery" onClick={onClose}>
          <X size={16} aria-hidden />
        </button>
        <div className="tds-gal-overlay-counter">{counter}</div>
        <div className="tds-gal-overlay-stage">{stage}</div>
        {dashes}
        {sourcedFooter}
        {announcer}
      </div>
    );
  }

  return (
    <section className="tds-gal" data-gallery data-block="gallery" aria-label={title ?? "Trip photo gallery"}>
      <header className="tds-gal-head">
        <h2 className="tds-gal-title">{title ?? "The Trip in Pictures"}</h2>
        {counter}
      </header>
      {stage}
      {dashes}
      {announcer}
    </section>
  );
}

/** Rainbow-ring gallery icon (PRD 5.1) — the compact entry point used in
 *  Horizontal Board and Grid views. Glyph stays currentColor so the ring is
 *  the rainbow signal on light and dark templates alike. */
export function GalleryIconButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="tds-gal-fab"
      data-print="hide"
      aria-label={`View trip gallery (${count} photos)`}
      title={`View trip gallery (${count} photos)`}
      onClick={onClick}
    >
      <Images size={18} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

/** Overlay-from-icon mount used by SkinFrame in Horizontal/Grid views. */
export function GalleryOverlayButton({ trip, blocks }: { trip: TripView; blocks: Block[] }) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const btnRef = useRef<HTMLSpanElement | null>(null);
  const { editing } = useEditing();
  const isMobile = useIsMobile();
  const { title, images } = useMemo(() => collectGalleryImages(trip, blocks), [trip, blocks]);
  const usable = images.length >= MIN_IMAGES;
  // Deep-link (PRD 5.3): ?gallery=N opens directly on that photo.
  useEffect(() => {
    if (!usable) return;
    const fromUrl = readGalleryParam();
    if (fromUrl != null) setOpenAt(Math.min(fromUrl, images.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usable]);
  if (!usable) return null;
  // Same rule as the Live Map: phone editing is dense — chrome yields.
  if (editing && isMobile) return null;
  const close = () => {
    setOpenAt(null);
    writeGalleryParam(null);
    // Focus returns to the launching icon on close (PRD 5.3 / 7).
    btnRef.current?.querySelector("button")?.focus();
  };
  return (
    <>
      <span ref={btnRef}>
        <GalleryIconButton
          count={images.length}
          onClick={() => {
            setOpenAt(0);
            writeGalleryParam(0);
          }}
        />
      </span>
      {openAt != null ? (
        <CoverflowGallery
          images={images}
          title={title}
          mode="overlay"
          initialIndex={openAt}
          onClose={close}
        />
      ) : null}
    </>
  );
}
