import React, {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Block } from "../../types";
import { CategoryIcon, AirfareIcon, categoryLabel } from "../CategoryIcon";
import { EditableText, useEditing } from "../Editable";
import { PlaceSheet, usePointerCoarse } from "@/components/mobile/PlaceSheet";
import type { FlightBlock, ActivityBlock, PartOfDay } from "../itinerary";
import { extractUrls, prettyDomain } from "@/lib/links";
import { Pencil, Trash2 } from "lucide-react";
import { ActivityEditSheet, FlightEditSheet } from "../ActivityEditSheet";

/**
 * Inert-render mode: set when a skin renders inside an interactive wrapper
 * (gallery tiles, the landing rail's <Link> thumbnails). Anything that would
 * emit an <a> renders the same titled text as a plain span instead, so
 * thumbnails stay valid HTML (no <a>-in-<a>) and purely decorative.
 */
const InertRenderContext = createContext(false);
export function InertRender({ children }: { children: ReactNode }) {
  return <InertRenderContext.Provider value={true}>{children}</InertRenderContext.Provider>;
}
export const useInertRender = () => useContext(InertRenderContext);

/**
 * Renders free text with any raw URL replaced by a titled hyperlink:
 * stored resolved title → prettified domain. Travelers never see bare URLs.
 */
export function LinkifiedText({
  text,
  linkTitles,
}: {
  text: string;
  linkTitles?: Record<string, string>;
}) {
  const inert = useInertRender();
  const urls = extractUrls(text);
  if (urls.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let rest = text;
  urls.forEach((url, i) => {
    const at = rest.indexOf(url);
    if (at === -1) return;
    if (at > 0) parts.push(rest.slice(0, at));
    const label = linkTitles?.[url] ?? prettyDomain(url);
    parts.push(
      inert ? (
        <span key={`${url}-${i}`}>{label}</span>
      ) : (
        <a key={`${url}-${i}`} href={url} target="_blank" rel="noreferrer">
          {label}
        </a>
      ),
    );
    rest = rest.slice(at + url.length);
  });
  if (rest) parts.push(rest);
  return <>{parts}</>;
}
import { PART_LABEL } from "../itinerary";

/* ============================================================
 * Standardized activity details renderer.
 *
 * Renders all available structured fields on a place block as
 * icon-labeled key/value chips. Used by every layout (vertical
 * row, horizontal card, grid cell) so a Restaurant looks like
 * a Restaurant in every template, and an Event always shows its
 * seat / ticket info the same way.
 * ============================================================ */

function GlyphPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4z" />
    </svg>
  );
}
function GlyphPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
function GlyphGlobe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c3 3 3 15 0 18-3-3-3-15 0-18z" />
    </svg>
  );
}
function GlyphClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function GlyphTicket() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" />
      <path d="M13 6v12" strokeDasharray="1 2" />
    </svg>
  );
}
function GlyphHash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />
    </svg>
  );
}
function GlyphSeat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 10V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
      <path d="M6 12h12a2 2 0 0 1 2 2v3H4v-3a2 2 0 0 1 2-2z" />
      <path d="M7 17v3M17 17v3" />
    </svg>
  );
}
function GlyphRoute() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7" />
    </svg>
  );
}
function GlyphRuler() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3 17 14-14 4 4L7 21z" />
      <path d="m7 9 2 2M10 6l2 2M13 12l2 2M16 9l2 2" />
    </svg>
  );
}
function GlyphBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m13 2-9 13h7l-1 7 9-13h-7l1-7z" />
    </svg>
  );
}
function GlyphSparkle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </svg>
  );
}
function GlyphShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" />
    </svg>
  );
}
function GlyphTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12V4h8l10 10-8 8L3 12z" />
      <circle cx="7.5" cy="7.5" r="1.25" />
    </svg>
  );
}

/**
 * Split "Dinner · Belcanto" into a kind word and the object it describes.
 * The kind renders as a small soft kicker (distinct from the venue name) and
 * REPLACES the generic category label — killing the "WALK / Walk ·" redundancy.
 * Only the app's own " · " convention is split; hyphens/colons in real names
 * are left alone. Prefixes longer than two words are treated as names.
 */
export function splitActivityName(name: string): { kind?: string; rest: string } {
  const m = name.match(/^([A-Za-z][A-Za-z' ]{0,24}?)\s*·\s*(.+)$/);
  if (!m) return { rest: name };
  const kind = m[1].trim();
  if (kind.split(/\s+/).length > 2) return { rest: name };
  return { kind, rest: m[2].trim() };
}

/** Inline styled activity name: soft kind kicker + display-type object. */
export function ActivityName({ name }: { name: string }) {
  const { kind, rest } = splitActivityName(name);
  if (!kind) return <>{name}</>;
  return (
    <>
      <span className="tds-act-kind">{kind}</span>
      {rest}
    </>
  );
}

/**
 * Inline photo carousel — images living with their day/stop.
 *
 * Single image → static card. Two or more → a native scroll-snap carousel
 * that:
 *  - tracks the finger with momentum (browser-native, so vertical page
 *    scroll is never hijacked)
 *  - shows prev/next arrows (fade in on hover on pointer:fine, always
 *    visible on touch) with a 44px hit target
 *  - shows tappable pagination dots + an "N / M" counter
 *  - supports ArrowLeft/Right/Home/End when focused
 *  - lazy-loads offscreen images, eager-loads the current one, and
 *    preloads the immediate neighbours
 *  - preserves layout with skeletons + fixed aspect-ratio (no CLS)
 *  - offers a Retry when an image fails
 *  - respects prefers-reduced-motion (auto-scroll behaviour)
 *
 * Same public props/DOM class hooks as before so all existing call sites
 * and per-skin CSS keep working.
 */
type GalleryImage = import("../../types").GalleryImage;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Target number of slides per day. When a day ships fewer real photos we
 *  top the carousel up with themed Unsplash previews so the row always feels
 *  complete. The N/M counter reflects the padded total that the user actually
 *  sees on screen. */
const MIN_DAY_IMAGES = 3;

function unsplashFallbackImage(query: string, sig: number): GalleryImage {
  const q = encodeURIComponent(query.trim().slice(0, 80) || "travel");
  // `sig` keeps each padded slide visually distinct and gives every slide a
  // unique src so React keys and the failed-set stay well-behaved.
  return {
    src: `https://source.unsplash.com/featured/1200x800/?${q}&sig=${sig}`,
    alt: `Illustrative photo of ${query}`,
    license: "unsplash",
  } as GalleryImage;
}

export function ActivityImages({
  images,
  fallbackQuery,
  fallbackLabel,
  onImagesChange,
  uploadLabel,
}: {
  images?: GalleryImage[];
  /** When provided and no real images exist, render an Unsplash preview
   *  keyed off this query with a clear "preview photo" message. */
  fallbackQuery?: string;
  /** Optional short label shown alongside the preview badge, e.g. day title. */
  fallbackLabel?: string;
  /** Owner-only. When provided, an "Add photo" affordance uploads to
   *  storage and appends signed URLs to the persisted image order. */
  onImagesChange?: (next: GalleryImage[]) => void;
  /** Human label for the target (e.g. day title) used in aria/toast copy. */
  uploadLabel?: string;
}) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [retryTick, setRetryTick] = useState(0);
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);
  const realUsable = useMemo(
    () => (images ?? []).filter((im) => im.src && !failed.has(im.src)),
    [images, failed],
  );
  const usable = useMemo(() => {
    if (!fallbackQuery) return realUsable;
    if (realUsable.length >= MIN_DAY_IMAGES) return realUsable;
    const need = MIN_DAY_IMAGES - realUsable.length;
    const pads: GalleryImage[] = [];
    for (let i = 0; i < need; i++) {
      const fb = unsplashFallbackImage(fallbackQuery, i + 1);
      if (!failed.has(fb.src)) pads.push(fb);
    }
    return [...realUsable, ...pads];
  }, [realUsable, fallbackQuery, failed]);
  const realCount = realUsable.length;
  const total = usable.length;
  const isFallback = useCallback(
    (im: GalleryImage) => usable.indexOf(im) >= realCount,
    [usable, realCount],
  );
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);
  const reduced = useReducedMotion();

  // Keep active bounded when images change (e.g. an image errors out).
  useEffect(() => {
    if (active > Math.max(0, total - 1)) setActive(Math.max(0, total - 1));
  }, [total, active]);

  // Observe which slide is centred to drive dots + counter.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || total <= 1) return;
    const io = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the largest intersection ratio.
        let best: IntersectionObserverEntry | null = null;
        for (const e of entries) {
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
        if (!best || best.intersectionRatio < 0.5) return;
        const idx = Number((best.target as HTMLElement).dataset.idx);
        if (!Number.isNaN(idx)) setActive(idx);
      },
      { root: track, threshold: [0.5, 0.75, 1] },
    );
    slideRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [total]);

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(total - 1, idx));
      const el = slideRefs.current[clamped];
      if (!el) return;
      el.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "nearest",
        inline: "start",
      });
      setActive(clamped);
    },
    [total, reduced],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (total <= 1) return;
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1); }
      else if (e.key === "Home") { e.preventDefault(); goTo(0); }
      else if (e.key === "End") { e.preventDefault(); goTo(total - 1); }
    },
    [active, goTo, total],
  );

  // No real images AND no fallback query available → nothing to show.
  if (total === 0 && (!images || images.length === 0) && !fallbackQuery) return null;
  if (total === 0) {
    // Everything failed — leave a discreet retry so the layout doesn't vanish.
    return (
      <div className="tds-act-images" data-count={1} data-print="hide">
        <div className="tds-carousel-error" role="status">
          <span>Images unavailable</span>
          <button
            type="button"
            onClick={() => { setFailed(new Set()); setRetryTick((n) => n + 1); }}
            className="tds-carousel-retry"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const single = total === 1;
  const hasFallbacks = realCount < total;

  return (
    <div
      className={`tds-act-images${hasFallbacks ? " tds-act-images--padded" : ""}`}
      data-count={Math.min(total, 3)}
      data-carousel={single ? undefined : ""}
      role={single ? undefined : "group"}
      aria-roledescription={single ? undefined : "carousel"}
      aria-label={single ? undefined : `Photos, ${total} total`}
      onKeyDown={single ? undefined : onKeyDown}
    >
      <div className="tds-carousel-track" ref={trackRef} tabIndex={single ? -1 : 0}>
        {usable.map((im, i) => {
          const eager = i === 0 || Math.abs(i - active) <= 1;
          const fallback = isFallback(im);
          return (
            <CarouselSlide
              key={`${im.src}#${retryTick}`}
              ref={(el) => { slideRefs.current[i] = el; }}
              image={im}
              index={i}
              total={total}
              eager={eager}
              fallback={fallback}
              fallbackLabel={fallback ? fallbackLabel : undefined}
              onError={() => setFailed((prev) => new Set(prev).add(im.src))}
              onOpen={() => setLightboxAt(i)}
            />
          );
        })}
      </div>

      {!single && (
        <>
          <button
            type="button"
            className="tds-carousel-nav tds-carousel-nav--prev tap"
            data-print="hide"
            aria-label="Previous photo"
            onClick={(e) => { e.stopPropagation(); goTo(active - 1); }}
            disabled={active === 0}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button
            type="button"
            className="tds-carousel-nav tds-carousel-nav--next tap"
            data-print="hide"
            aria-label="Next photo"
            onClick={(e) => { e.stopPropagation(); goTo(active + 1); }}
            disabled={active === total - 1}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <div className="tds-carousel-counter" aria-live="polite" data-print="hide">
            {active + 1} / {total}
          </div>
          <div className="tds-carousel-dots" role="tablist" aria-label="Choose photo" data-print="hide">
            {usable.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Photo ${i + 1} of ${total}`}
                className="tds-carousel-dot"
                data-active={i === active || undefined}
                onClick={(e) => { e.stopPropagation(); goTo(i); }}
              />
            ))}
          </div>
        </>
      )}
      {lightboxAt != null ? (
        <CarouselLightbox
          images={usable}
          startIndex={lightboxAt}
          onClose={() => setLightboxAt(null)}
          fallbackQuery={fallbackQuery}
        />
      ) : null}
    </div>
  );
}

const CarouselSlide = (() => {
  type Props = {
    image: GalleryImage;
    index: number;
    total: number;
    eager: boolean;
    fallback?: boolean;
    fallbackLabel?: string;
    onError: () => void;
    onOpen?: () => void;
  };
  const Component = (
    { image, index, total, eager, fallback, fallbackLabel, onError, onOpen }: Props,
    ref: React.Ref<HTMLElement>,
  ) => {
    const [loaded, setLoaded] = useState(false);
    return (
      <figure
        ref={ref as React.Ref<HTMLElement>}
        className={`tds-act-image tds-carousel-slide${fallback ? " tds-carousel-slide--fallback" : ""}`}
        data-idx={index}
        data-loaded={loaded || undefined}
        aria-roledescription={total > 1 ? "slide" : undefined}
        aria-label={
          total > 1
            ? `${index + 1} of ${total}${fallback ? " (preview photo)" : ""}`
            : undefined
        }
      >
        <button
          type="button"
          className="tds-carousel-open"
          data-print="hide"
          aria-label={`Open photo ${index + 1}${total > 1 ? ` of ${total}` : ""} in fullscreen viewer`}
          onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
        >
          <img
            src={image.src}
            alt={image.alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
            style={
              image.focalPoint
                ? { objectPosition: `${image.focalPoint.x * 100}% ${image.focalPoint.y * 100}%` }
                : undefined
            }
            onLoad={() => setLoaded(true)}
            onError={onError}
          />
          {fallback ? (
            <span className="tds-carousel-fallback-badge" data-print="hide">
              Preview{fallbackLabel ? ` · ${fallbackLabel}` : ""} · add your own
            </span>
          ) : null}
        </button>
      </figure>
    );
  };
  Component.displayName = "CarouselSlide";
  // eslint-disable-next-line react/display-name
  return React.forwardRef(Component);
})();

/** Fullscreen lightbox for the day-image carousel. Tap-to-open, prev/next
 *  controls, keyboard navigation, click-to-toggle zoom (1x <-> 2.25x),
 *  drag-to-pan while zoomed, wheel-to-zoom on desktop, Esc to close. */
function CarouselLightbox({
  images,
  startIndex,
  onClose,
  fallbackQuery,
}: {
  images: GalleryImage[];
  startIndex: number;
  onClose: () => void;
  /** When provided, the failure state offers a one-tap Unsplash fallback. */
  fallbackQuery?: string;
}) {
  const n = images.length;
  const [idx, setIdx] = useState(() => Math.min(Math.max(startIndex, 0), Math.max(n - 1, 0)));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number; id: number } | null>(null);
  // Touch swipe (only when not zoomed) — separate from pan drag which owns
  // pointer movement while zoomed in.
  const swipe = useRef<{ x: number; y: number; id: number; t: number } | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<Record<number, "loading" | "ok" | "error">>({});

  const go = useCallback(
    (delta: number) => {
      if (n === 0) return;
      setIdx((i) => ((i + delta) % n + n) % n);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    },
    [n],
  );

  const toggleZoom = useCallback(() => {
    setZoom((z) => (z > 1 ? 1 : 2.25));
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom((z) => Math.min(4, z + 0.5)); }
      else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => {
          const next = Math.max(1, z - 0.5);
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
      }
      else if (e.key === "0") { e.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // Preload neighbours so next/previous navigation feels instant.
  useEffect(() => {
    if (n <= 1) return;
    const offsets = n > 2 ? [1, -1, 2, -2] : [1, -1];
    const preloaded: HTMLImageElement[] = [];
    for (const off of offsets) {
      const src = images[(idx + off + n) % n]?.src;
      if (!src) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      preloaded.push(img);
    }
    return () => { preloaded.length = 0; };
  }, [idx, images, n]);

  if (n === 0) return null;
  const baseImage = images[idx];
  const currentSrc = overrides[idx] ?? baseImage.src;
  const currentStatus = status[idx] ?? "loading";
  const setIdxStatus = (s: "loading" | "ok" | "error") =>
    setStatus((prev) => (prev[idx] === s ? prev : { ...prev, [idx]: s }));
  const retry = () => {
    const base = baseImage.src;
    const sep = base.includes("?") ? "&" : "?";
    setOverrides((prev) => ({ ...prev, [idx]: `${base}${sep}retry=${Date.now()}` }));
    setIdxStatus("loading");
  };
  const useFallback = () => {
    if (!fallbackQuery) return;
    const fb = unsplashFallbackImage(fallbackQuery, idx + 1);
    setOverrides((prev) => ({ ...prev, [idx]: fb.src }));
    setIdxStatus("loading");
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 20) return;
    e.preventDefault();
    setZoom((z) => {
      const next = Math.max(1, Math.min(4, z + (e.deltaY < 0 ? 0.25 : -0.25)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) {
      if (e.pointerType === "touch" || e.pointerType === "pen") {
        swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, t: Date.now() };
      }
      return;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
    const s = swipe.current;
    if (s && s.id === e.pointerId) {
      swipe.current = null;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const dt = Date.now() - s.t;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 800) {
        go(dx < 0 ? 1 : -1);
      }
    }
  };
  const onPointerCancel = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
    if (swipe.current?.id === e.pointerId) swipe.current = null;
  };

  return (
    <div
      className="tds-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${idx + 1} of ${n}`}
      data-print="hide"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="tds-lightbox-bar">
        <span className="tds-lightbox-counter" aria-live="polite">{idx + 1} / {n}</span>
        <div className="tds-lightbox-tools">
          <button
            type="button"
            className="tds-lightbox-btn tap"
            aria-label="Zoom out"
            disabled={zoom <= 1}
            onClick={(e) => {
              e.stopPropagation();
              setZoom((z) => {
                const next = Math.max(1, z - 0.5);
                if (next === 1) setPan({ x: 0, y: 0 });
                return next;
              });
            }}
          >−</button>
          <span className="tds-lightbox-zoom">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="tds-lightbox-btn tap"
            aria-label="Zoom in"
            disabled={zoom >= 4}
            onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(4, z + 0.5)); }}
          >+</button>
          <button
            type="button"
            className="tds-lightbox-btn tds-lightbox-close tap"
            aria-label="Close viewer"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >×</button>
        </div>
      </div>

      <div
        className="tds-lightbox-stage"
        onWheel={onWheel}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <img
          src={currentSrc}
          alt={baseImage.alt}
          draggable={false}
          className="tds-lightbox-img"
          data-zoomed={zoom > 1 || undefined}
          data-hidden={currentStatus === "error" || undefined}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            cursor: zoom > 1 ? (drag.current ? "grabbing" : "grab") : "zoom-in",
          }}
          onDoubleClick={toggleZoom}
          onClick={(e) => { e.stopPropagation(); toggleZoom(); }}
          onLoad={() => setIdxStatus("ok")}
          onError={() => setIdxStatus("error")}
        />
        {currentStatus === "error" ? (
          <div className="tds-lightbox-error" role="alert" onClick={(e) => e.stopPropagation()}>
            <div className="tds-lightbox-error-title">This photo didn't load</div>
            <p className="tds-lightbox-error-body">
              Check your connection, or swap in a preview image for now.
            </p>
            <div className="tds-lightbox-error-actions">
              <button
                type="button"
                className="tds-lightbox-btn tap"
                onClick={(e) => { e.stopPropagation(); retry(); }}
              >
                Retry
              </button>
              {fallbackQuery ? (
                <button
                  type="button"
                  className="tds-lightbox-btn tap"
                  onClick={(e) => { e.stopPropagation(); useFallback(); }}
                >
                  Use preview photo
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {n > 1 ? (
        <>
          <button
            type="button"
            className="tds-lightbox-nav tds-lightbox-nav--prev tap"
            aria-label="Previous photo"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button
            type="button"
            className="tds-lightbox-nav tds-lightbox-nav--next tap"
            aria-label="Next photo"
            onClick={(e) => { e.stopPropagation(); go(1); }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </>
      ) : null}

      {baseImage.caption ? <div className="tds-lightbox-caption">{baseImage.caption}</div> : null}
    </div>
  );
}

type DetailRow = {
  key: string;
  label: string;
  value: string;
  glyph: ReactNode;
  href?: string;
};

function buildDetailRows(a: ActivityBlock): DetailRow[] {
  const rows: DetailRow[] = [];
  const push = (k: string, label: string, value: string | undefined, glyph: ReactNode, href?: string) => {
    if (!value) return;
    rows.push({ key: k, label, value, glyph, href });
  };

  // Universal contact / location
  push("address", "Address", a.address, <GlyphPin />, a.mapsUrl);
  push("phone", "Phone", a.phone, <GlyphPhone />, a.phone ? `tel:${a.phone.replace(/[^+\d]/g, "")}` : undefined);
  // Links never display as raw URLs: resolved title → place name → domain.
  push(
    "website",
    "Website",
    a.website ? a.websiteTitle ?? a.name ?? prettyDomain(a.website) : undefined,
    <GlyphGlobe />,
    a.website,
  );
  push("hours", "Hours", a.hours, <GlyphClock />);
  push("reservation", "Reference", a.reservation, <GlyphHash />);

  // Transit
  push("vendor", "Vendor", a.vendor, <GlyphTag />);
  push("pickup", "Pickup", a.pickup, <GlyphPin />);
  push("dropoff", "Drop-off", a.dropoff, <GlyphPin />);

  // Restaurant
  push("dressCode", "Dress code", a.dressCode, <GlyphTag />);
  push("mustOrder", "Must-order", a.mustOrder, <GlyphSparkle />);

  // Walk / hike
  push("trailhead", "Trailhead", a.trailhead, <GlyphRoute />, a.mapsUrl);
  push("distance", "Distance", a.distance, <GlyphRuler />);
  push("duration", "Duration", a.duration, <GlyphClock />);
  push("difficulty", "Difficulty", a.difficulty, <GlyphBolt />);
  push("waypoints", "Waypoints", a.waypoints, <GlyphRoute />);
  push("prep", "Prep", a.prep, <GlyphShield />);

  // Event
  push("venue", "Venue", a.venue, <GlyphPin />);
  push("doorOpen", "Doors", a.doorOpen, <GlyphClock />);
  push(
    "ticketLink",
    "Ticket",
    a.ticketLink ? a.ticketLinkTitle ?? prettyDomain(a.ticketLink) : undefined,
    <GlyphTicket />,
    a.ticketLink,
  );
  push("seat", "Seat", a.seat, <GlyphSeat />);
  push("venueRules", "Rules", a.venueRules, <GlyphShield />);

  // Accommodation
  push("checkIn", "Check-in", a.checkIn, <GlyphClock />);
  push("checkOut", "Check-out", a.checkOut, <GlyphClock />);
  push("amenities", "Amenities", a.amenities, <GlyphSparkle />);

  // Culture
  push("ticketRequirement", "Tickets", a.ticketRequirement, <GlyphTicket />);
  push("tourDetails", "Tour", a.tourDetails, <GlyphRoute />);

  return rows;
}

/**
 * Compact chip list — used inside the kanban card + vertical row to surface
 * the top few standardized fields without dominating the layout.
 */
export function ActivityChips({ activity, max = 3 }: { activity: ActivityBlock; max?: number }) {
  const rows = buildDetailRows(activity).slice(0, max);
  if (rows.length === 0) return null;
  return (
    <ul className="tds-act-chips" aria-label="Details">
      {rows.map((r) => (
        <li key={r.key} className="tds-act-chip" title={`${r.label}: ${r.value}`}>
          <span className="tds-act-chip-glyph" aria-hidden>{r.glyph}</span>
          <span className="tds-act-chip-value">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Full structured details list — used in the grid cell. Shows every available
 * field as an icon-labeled key/value pair with phone / link / map affordances.
 */
export function ActivityDetails({ activity }: { activity: ActivityBlock }) {
  const rows = buildDetailRows(activity);
  return <DetailRowsList rows={rows} />;
}

function DetailRowsList({ rows }: { rows: DetailRow[] }) {
  const inert = useInertRender();
  if (rows.length === 0) return null;
  return (
    <dl className="tds-act-details" aria-label="Details">
      {rows.map((r) => (
        <div key={r.key} className="tds-act-detail">
          <dt>
            <span className="tds-act-detail-glyph" aria-hidden>{r.glyph}</span>
            <span className="tds-act-detail-label">{r.label}</span>
          </dt>
          <dd>
            {r.href && !inert ? (
              <a href={r.href} target={r.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                {r.value}
              </a>
            ) : (
              r.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Compact flight row used at the top of every view. */
export function FlightStrip({
  outbound,
  inbound,
  outboundIndex,
  inboundIndex,
}: {
  outbound?: FlightBlock;
  inbound?: FlightBlock;
  outboundIndex?: number;
  inboundIndex?: number;
}) {
  if (!outbound && !inbound) return null;
  return (
    <div className="tds-flightstrip" data-block="flightstrip" data-print="hide-empty">
      {outbound ? <FlightRow flight={outbound} label="Departure" index={outboundIndex} /> : null}
      {inbound ? <FlightRow flight={inbound} label="Return" index={inboundIndex} /> : null}
    </div>
  );
}

function FlightRow({
  flight,
  label,
  index,
}: {
  flight: FlightBlock;
  label: string;
  index?: number;
}) {
  const { editing } = useEditing();
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const route = [flight.from, flight.to].filter(Boolean).join(" → ");
  const carrier = [flight.airline, flight.flightNumber].filter(Boolean).join(" ");
  const fields: Array<{ label: string; value: string }> = [];
  if (carrier) fields.push({ label: "Carrier", value: carrier });
  if (flight.date) fields.push({ label: "Date", value: flight.date });
  if (flight.departTime) fields.push({ label: "Depart", value: flight.departTime });
  if (flight.arriveTime) fields.push({ label: "Arrive", value: flight.arriveTime });
  if (flight.seat) fields.push({ label: "Seat", value: flight.seat });
  if (flight.confirmation) fields.push({ label: "Conf.", value: flight.confirmation });

  return (
    <div className="tds-flightstrip-row">
      <div className="tds-flightstrip-leg">
        <span className="tds-flightstrip-icon" aria-hidden>
          <AirfareIcon />
        </span>
        <span className="tds-flightstrip-label">{label}</span>
        {/* Flights were the last fully-locked block kind: no editor existed
            anywhere, and a blank-flow flight ghost yielded a permanent "—"
            row. The pencil opens the shared FlightEditSheet. */}
        {editing && index != null ? (
          <>
            <button
              type="button"
              className="tds-act-delete tap"
              data-print="hide"
              onClick={(e) => {
                e.stopPropagation();
                setEditSheetOpen(true);
              }}
              aria-label={`Edit ${label.toLowerCase()} flight`}
              title="Edit flight details"
            >
              <Pencil size={13} aria-hidden />
            </button>
            {editSheetOpen ? (
              <FlightEditSheet
                flight={flight}
                index={index}
                open={editSheetOpen}
                onOpenChange={setEditSheetOpen}
              />
            ) : null}
          </>
        ) : null}
      </div>
      <div className="tds-flightstrip-route" aria-label={`Route ${route || "unknown"}`}>
        {route || "—"}
      </div>
      <dl className="tds-flightstrip-fields">
        {fields.map((f) => (
          <div key={f.label} className="tds-flightstrip-field">
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A single editable activity row for the vertical reading view. */
export function ActivityRow({
  activity,
  index,
}: {
  activity: ActivityBlock;
  index: number;
}) {
  const { onBlockChange, onBlockRemove, editing } = useEditing();
  // Read mode on touch: the row is a tap target opening the acting sheet
  // (call / map / website / copy). Editing keeps inline text behavior.
  const coarse = usePointerCoarse();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const tappable =
    coarse && !editing &&
    !!(activity.address || activity.phone || activity.website || activity.note || activity.hours);
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const label = activity.name?.trim() || "this activity";
    if (typeof window !== "undefined" && !window.confirm(`Delete "${label}"?`)) return;
    onBlockRemove(index);
  };
  return (
    <div
      className="tds-act-row"
      data-block="activity"
      data-block-index={index}
      data-tappable={tappable || undefined}
      onClick={tappable ? () => setSheetOpen(true) : undefined}
      onKeyDown={tappable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSheetOpen(true); } } : undefined}
      role={tappable ? "button" : undefined}
      tabIndex={tappable ? 0 : undefined}
    >
      {tappable ? (
        <PlaceSheet activity={activity} open={sheetOpen} onOpenChange={setSheetOpen} />
      ) : null}
      <div className="tds-act-time">{activity.time ?? ""}</div>
      <div className="tds-act-icon">
        <CategoryIcon category={activity.category} className="tds-cat-icon" />
      </div>
      <div className="tds-act-body">
        <div className="tds-act-title">
          {editing ? (
            <EditableText
              as="span"
              value={activity.name}
              placeholder="Activity"
              onChange={(v) => onBlockChange(index, { name: v } as Partial<Block>)}
            />
          ) : (
            <ActivityName name={activity.name} />
          )}
        </div>
        <ActivityImages images={activity.images} />
        <ActivityChips activity={activity} max={3} />
        {activity.note ? (
          <div className="tds-act-meta tds-act-note">
            {editing ? (
              <EditableText
                as="span"
                multiline
                value={activity.note}
                placeholder="Note"
                onChange={(v) => onBlockChange(index, { note: v } as Partial<Block>)}
              />
            ) : (
              <LinkifiedText text={activity.note} linkTitles={activity.linkTitles} />
            )}
          </div>
        ) : null}
      </div>
      {editing ? (
        <>
          <button
            type="button"
            className="tds-act-delete tap"
            data-print="hide"
            onClick={(e) => {
              e.stopPropagation();
              setEditSheetOpen(true);
            }}
            aria-label={`Edit details of ${activity.name?.trim() || "activity"}`}
            title="Edit all details"
          >
            <Pencil size={14} aria-hidden />
          </button>
          <button
            type="button"
            className="tds-act-delete tap"
            data-print="hide"
            onClick={handleDelete}
            aria-label={`Delete ${activity.name?.trim() || "activity"}`}
            title="Delete activity"
          >
            <Trash2 size={14} aria-hidden />
          </button>
          {editSheetOpen ? (
            <ActivityEditSheet
              activity={activity}
              index={index}
              open={editSheetOpen}
              onOpenChange={setEditSheetOpen}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Compact kanban-card variant of an activity for the horizontal board. */
export function ActivityCard({ activity, index }: { activity: ActivityBlock; index: number }) {
  const { onBlockChange, editing } = useEditing();
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  return (
    <div className="tds-act-card" data-block="activity-card" data-block-index={index}>
      <div className="tds-act-card-head">
        <CategoryIcon category={activity.category} className="tds-cat-icon" />
        {activity.time ? <span className="tds-act-card-time">{activity.time}</span> : null}
        <span className="tds-act-card-cat">{categoryLabel(activity.category)}</span>
        {editing ? (
          <>
            <button
              type="button"
              className="tds-act-delete tap"
              data-print="hide"
              style={{ marginLeft: "auto" }}
              onClick={(e) => {
                e.stopPropagation();
                setEditSheetOpen(true);
              }}
              aria-label={`Edit details of ${activity.name?.trim() || "activity"}`}
              title="Edit all details"
            >
              <Pencil size={13} aria-hidden />
            </button>
            <ActivityEditSheet
              activity={activity}
              index={index}
              open={editSheetOpen}
              onOpenChange={setEditSheetOpen}
            />
          </>
        ) : null}
      </div>
      <div className="tds-act-card-title">
        {editing ? (
          <EditableText
            as="span"
            value={activity.name}
            placeholder="Activity"
            onChange={(v) => onBlockChange(index, { name: v } as Partial<Block>)}
          />
        ) : (
          <ActivityName name={activity.name} />
        )}
      </div>
      <ActivityChips activity={activity} max={2} />
      {activity.note ? (
        <div className="tds-act-card-note">
          <LinkifiedText text={activity.note} linkTitles={activity.linkTitles} />
        </div>
      ) : null}
    </div>
  );
}

/** Grid cell — calm by default: kind kicker, name, address, note. Every
 *  other field folds into a "+ N details" disclosure (progressive
 *  disclosure keeps the day matrix scannable without losing anything). */
export function ActivityCell({ activity, index }: { activity: ActivityBlock; index?: number }) {
  const inert = useInertRender();
  const { editing } = useEditing();
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const { kind, rest } = splitActivityName(activity.name);
  const rows = buildDetailRows(activity);
  const address = rows.find((r) => r.key === "address");
  const more = rows.filter((r) => r.key !== "address");
  return (
    <div className="tds-act-cell" data-block-index={index}>
      <div className="tds-act-cell-head">
        <CategoryIcon category={activity.category} className="tds-cat-icon" />
        {/* The name's own kind word wins; the generic category label is
            redundant with it ("Walk ·" vs WALK) and steps aside. */}
        <span className="tds-act-cell-cat">{kind ?? categoryLabel(activity.category)}</span>
        {activity.time ? <span className="tds-act-cell-time">{activity.time}</span> : null}
        {editing && index != null ? (
          <>
            <button
              type="button"
              className="tds-act-delete tap"
              data-print="hide"
              style={{ marginLeft: "auto" }}
              onClick={(e) => {
                e.stopPropagation();
                setEditSheetOpen(true);
              }}
              aria-label={`Edit details of ${activity.name?.trim() || "activity"}`}
              title="Edit all details"
            >
              <Pencil size={12} aria-hidden />
            </button>
            <ActivityEditSheet
              activity={activity}
              index={index}
              open={editSheetOpen}
              onOpenChange={setEditSheetOpen}
            />
          </>
        ) : null}
      </div>
      <div className="tds-act-cell-name">{rest}</div>
      {address ? (
        <div className="tds-act-cell-line tds-act-cell-muted">
          {address.href && !inert ? (
            <a href={address.href} target="_blank" rel="noreferrer">
              {address.value}
            </a>
          ) : (
            address.value
          )}
        </div>
      ) : null}
      {activity.note ? (
        <div className="tds-act-cell-note">
          <LinkifiedText text={activity.note} linkTitles={activity.linkTitles} />
        </div>
      ) : null}
      {more.length > 0 ? (
        <details className="tds-act-more">
          <summary>
            <span className="tds-more-closed">+ {more.length} detail{more.length === 1 ? "" : "s"}</span>
            <span className="tds-more-open">− details</span>
          </summary>
          <DetailRowsList rows={more} />
        </details>
      ) : null}
    </div>
  );
}

export function PartHeading({ part }: { part: PartOfDay }) {
  return (
    <div className="tds-part-head" data-part={part}>
      <span className="tds-part-rule" aria-hidden />
      <span className="tds-part-label">{PART_LABEL[part]}</span>
    </div>
  );
}

export const partOrder: PartOfDay[] = ["morning", "afternoon", "evening"];

/**
 * Format the date shown next to a day header. Returns the user-supplied
 * value when set, otherwise a stable placeholder so missing dates aren't
 * invisible — users need to know to fill them in.
 */
export function dayDateLabel(date?: string): string {
  return date && date.trim() ? date.trim() : "TBD (MM/DD/YY)";
}

/**
 * Horizontal scroll-snap carousel of activity options inside a single
 * part-of-day slot. When a slot has more than one block (e.g. an
 * experience + a planned aperitivo + a farewell dinner the user might
 * pick between), the cards live in a swipeable row instead of stacked.
 * The first child is treated as the primary suggestion visually; users
 * can scroll/swipe to compare alternatives. Drag-and-drop on each child
 * still works (the items are still positioned in document order).
 */
/* ------------------------------------------------------------------
 * Slot selection context — remembers the chosen alternative for every
 * slot (e.g. "2:morning") so the user can flip through other days and
 * come back to the same picks. Also stores a per-slot side-by-side
 * compare toggle. Backed by sessionStorage so the picks survive
 * navigation within the tab. Mounted by <SkinFrame>.
 * ------------------------------------------------------------------ */

type SlotSelectionState = {
  picks: Record<string, number>;
  compare: Record<string, boolean>;
};
type SlotSelectionApi = SlotSelectionState & {
  setPick: (slotKey: string, index: number) => void;
  toggleCompare: (slotKey: string) => void;
};

const STORAGE_KEY = "tds:slot-selection:v1";

const SlotSelectionContext = createContext<SlotSelectionApi | null>(null);

export function SlotSelectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SlotSelectionState>(() => {
    if (typeof window === "undefined") return { picks: {}, compare: {} };
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return { picks: {}, compare: {} };
      const parsed = JSON.parse(raw) as Partial<SlotSelectionState>;
      return {
        picks: parsed.picks ?? {},
        compare: parsed.compare ?? {},
      };
    } catch {
      return { picks: {}, compare: {} };
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state]);

  const api = useMemo<SlotSelectionApi>(
    () => ({
      ...state,
      setPick: (slotKey, index) =>
        setState((prev) => ({ ...prev, picks: { ...prev.picks, [slotKey]: index } })),
      toggleCompare: (slotKey) =>
        setState((prev) => ({
          ...prev,
          compare: { ...prev.compare, [slotKey]: !prev.compare[slotKey] },
        })),
    }),
    [state],
  );

  return <SlotSelectionContext.Provider value={api}>{children}</SlotSelectionContext.Provider>;
}

function useSlotSelection(slotKey: string | undefined, total: number) {
  const ctx = useContext(SlotSelectionContext);
  const [fallback, setFallback] = useState(0);
  const [fallbackCompare, setFallbackCompare] = useState(false);
  if (!ctx || !slotKey) {
    return {
      index: Math.min(fallback, Math.max(0, total - 1)),
      compare: fallbackCompare,
      setIndex: setFallback,
      toggleCompare: () => setFallbackCompare((v) => !v),
    };
  }
  const raw = ctx.picks[slotKey] ?? 0;
  const index = total > 0 ? ((raw % total) + total) % total : 0;
  return {
    index,
    compare: !!ctx.compare[slotKey],
    setIndex: (i: number) => ctx.setPick(slotKey, i),
    toggleCompare: () => ctx.toggleCompare(slotKey),
  };
}

/**
 * Click-to-compare carousel of alternative options for a single slot.
 *
 * - Keyboard: ← / → cycle, Home / End jump to ends, Enter / Space confirm
 *   the currently focused dot.
 * - Persistence: selection is stored by `slotKey` so picks survive while
 *   the user reviews other days.
 * - Side-by-side: a small toggle renders the active option next to the
 *   following one so two alternatives can be compared at once.
 * - Diff cue: any non-primary option is tagged "Alt of Option 1" to make
 *   optionality obvious at a glance.
 */
export function SlotAlternativesCarousel({
  count,
  children,
  slotKey,
}: {
  count: number;
  children: React.ReactNode;
  slotKey?: string;
}) {
  const items = Children.toArray(children);
  const total = items.length || count;
  const { index, compare, setIndex, toggleCompare } = useSlotSelection(slotKey, total);
  const safeIndex = total > 0 ? ((index % total) + total) % total : 0;
  const rootRef = useRef<HTMLDivElement | null>(null);

  const go = useCallback(
    (delta: number) => setIndex(((safeIndex + delta) % total + total) % total),
    [setIndex, safeIndex, total],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (total <= 1) return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        go(-1);
        break;
      case "ArrowRight":
      case "Enter":
        e.preventDefault();
        go(1);
        break;
      case "Home":
        e.preventDefault();
        setIndex(0);
        break;
      case "End":
        e.preventDefault();
        setIndex(total - 1);
        break;
      default:
        break;
    }
  };

  const compareIndex = total > 1 ? (safeIndex + 1) % total : safeIndex;

  return (
    <div
      ref={rootRef}
      className="tds-slot-carousel"
      data-count={total}
      data-compare={compare && total > 1 ? "true" : undefined}
      role="group"
      aria-label={`${total} alternative${total === 1 ? "" : "s"}`}
      tabIndex={total > 1 ? 0 : -1}
      onKeyDown={onKeyDown}
    >
      {total > 1 ? (
        <div className="tds-slot-carousel-meta">
          <span className="tds-slot-carousel-pill">
            Option {safeIndex + 1} of {total}
            {safeIndex > 0 ? <span className="tds-slot-carousel-diff"> · alt of Option 1</span> : null}
          </span>
          <div className="tds-slot-carousel-nav" aria-hidden={false}>
            <button
              type="button"
              className="tds-slot-carousel-btn"
              onClick={() => go(-1)}
              aria-label="Previous alternative"
            >
              ‹
            </button>
            <div className="tds-slot-carousel-dots" role="tablist">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === safeIndex}
                  aria-label={`Show alternative ${i + 1}`}
                  className={`tds-slot-carousel-dot${i === safeIndex ? " is-active" : ""}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className="tds-slot-carousel-btn"
              onClick={() => go(1)}
              aria-label="Next alternative"
            >
              ›
            </button>
            <button
              type="button"
              className={`tds-slot-carousel-compare${compare ? " is-active" : ""}`}
              onClick={toggleCompare}
              aria-pressed={compare}
              title="Show two alternatives side-by-side"
            >
              {compare ? "Exit compare" : "Compare side-by-side"}
            </button>
            <span className="tds-slot-carousel-hint">← → keys · Enter to cycle</span>
          </div>
        </div>
      ) : null}
      {compare && total > 1 ? (
        <div className="tds-slot-carousel-split" role="presentation">
          <div className="tds-slot-carousel-pane" data-pane="a" aria-label={`Option ${safeIndex + 1}`}>
            <div className="tds-slot-carousel-pane-tag">Option {safeIndex + 1}</div>
            {items[safeIndex]}
          </div>
          <div className="tds-slot-carousel-pane" data-pane="b" aria-label={`Option ${compareIndex + 1}`}>
            <div className="tds-slot-carousel-pane-tag">Option {compareIndex + 1}</div>
            {items[compareIndex]}
          </div>
        </div>
      ) : (
        <div className="tds-slot-carousel-stage">
          {total > 0 ? items[safeIndex] : children}
        </div>
      )}
    </div>
  );
}