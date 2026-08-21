/**
 * AtelierTable — the dossier templates on a rotating table.
 *
 * The desktop gallery is a turntable: all covers sit on a circular arc in
 * 3D, and steering (arrows, dots, keyboard, drag-with-momentum) spins the
 * ring so covers travel through the intermediate positions with spring
 * physics — nothing pops or teleports. The whole table also tilts a few
 * degrees toward the cursor. Distance from center is conveyed by depth,
 * uniform scale, and a "shadow" dim overlay — never by squishing the
 * cover's proportions or ghosting it transparent.
 *
 * The active dossier's identity (name · personality · Open/Mint) lives in
 * a caption panel below the table that crossfades on change, so the
 * covers themselves stay pure objects.
 *
 * Every template is also emitted as a visually-hidden real link so the
 * full set stays crawlable regardless of ring position.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { SkinModule } from "@/lib/skins/registry";
import { InertRender } from "@/lib/skins/shared/views/parts";
import { DossierCoverArt, type CoverVariant } from "./DossierCover";

/** Ring geometry. Step angle × radius sets how far covers travel per stop.
 *  CARD_W is the card's TRUE rendered width — the centered cover displays
 *  at exactly scale 1 so its rasterized text stays sharp; only side covers
 *  scale, and only DOWN (upscaling a rasterized 3D layer is what made the
 *  center look fuzzy). */
const STEP_DEG = 19;
const RADIUS = 950;
const CARD_W = 356;
/** Covers beyond this many stops from center stay unrendered (cheap DOM). */
const RENDER_EACH_SIDE = 3;

export function AtelierTable({
  skins,
  onPick,
  pickingId,
}: {
  skins: SkinModule[];
  onPick: (id: string) => void;
  pickingId: string | null;
}) {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // The ring's position as a fractional index. `pos` is the target; the
  // spring is what the cards actually follow — steering spins the ring
  // through every intermediate position instead of teleporting.
  const pos = useMotionValue(0);
  const ring = useSpring(pos, { stiffness: 90, damping: 18, mass: 0.9 });

  // Cursor tilt: the whole table leans a few degrees toward the mouse.
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const tiltXs = useSpring(tiltX, { stiffness: 60, damping: 16 });
  const tiltYs = useSpring(tiltY, { stiffness: 60, damping: 16 });

  const goTo = (i: number) => {
    const clamped = Math.min(skins.length - 1, Math.max(0, i));
    setActive(clamped);
    if (reducedMotion) ring.jump(clamped);
    pos.set(clamped);
  };

  // Filters can shrink the deck under the current index — stay in range.
  useEffect(() => {
    if (active > skins.length - 1) goTo(skins.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skins.length]);

  // Drag the table with momentum: while dragging the ring follows the
  // pointer 1:1; on release, velocity carries it, then it snaps to the
  // nearest stop.
  const drag = useRef<{ startX: number; startPos: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startX: e.clientX, startPos: pos.get(), moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 4) d.moved = true;
    pos.set(d.startPos - dx / (CARD_W * 1.05));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const momentum = -pos.getVelocity() * 0.12;
    goTo(Math.round(pos.get() + momentum));
  };

  const onStageMouseMove = (e: React.MouseEvent) => {
    if (reducedMotion) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tiltY.set(((e.clientX - r.left) / r.width - 0.5) * 6);
    tiltX.set(-((e.clientY - r.top) / r.height - 0.5) * 4);
  };
  const onStageMouseLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  if (skins.length === 0) return null;
  const activeSkin = skins[Math.min(active, skins.length - 1)];

  return (
    <section aria-label="Dossier templates on the atelier table" className="relative">
      {/* Crawlable full index — the ring only mounts nearby covers. */}
      <nav aria-label="All dossier templates" className="sr-only">
        {skins.map((s) => (
          <Link key={s.meta.id} to="/templates/$id" params={{ id: s.meta.id }}>
            {s.meta.codename}
          </Link>
        ))}
      </nav>

      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={`Template ${active + 1} of ${skins.length}: ${activeSkin.meta.codename}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1); }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onMouseMove={onStageMouseMove}
        onMouseLeave={onStageMouseLeave}
        className="relative cursor-grab select-none outline-none [touch-action:pan-y] active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-seal/50"
        style={{ perspective: "1500px" }}
      >
        {/* The table surface: a receding plane with a soft pool of light
            under the centered dossier. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[-10%] bottom-2 h-[44%]"
          style={{
            background:
              "radial-gradient(48% 62% at 50% 30%, rgba(235,204,140,0.10) 0%, rgba(10,16,30,0.9) 62%, rgba(6,10,20,0.98) 100%)",
            transform: "rotateX(58deg)",
            transformOrigin: "bottom",
            borderTop: "1px solid rgba(235,204,140,0.12)",
          }}
        />

        <motion.div
          className="relative flex h-[500px] items-center justify-center"
          style={{
            transformStyle: "preserve-3d",
            rotateX: tiltXs,
            rotateY: tiltYs,
          }}
        >
          {skins.map((skin, i) => (
            <RingCover
              key={skin.meta.id}
              skin={skin}
              index={i}
              ring={ring}
              isActive={i === active}
              onSelect={() => {
                if (drag.current?.moved) return;
                if (i === active) {
                  navigate({ to: "/templates/$id", params: { id: skin.meta.id } });
                } else {
                  goTo(i);
                }
              }}
            />
          ))}
        </motion.div>
      </div>

      {/* Caption panel: the active dossier introduces itself; covers on the
          table stay pure objects. Crossfades as the ring settles. */}
      <div className="mt-6 flex flex-col items-center gap-5">
        <div className="relative flex min-h-[92px] w-full max-w-xl flex-col items-center text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeSkin.meta.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-1.5"
            >
              <h3
                className="text-4xl font-normal leading-none tracking-tight text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {activeSkin.meta.codename}
                <span className="text-seal">.</span>
              </h3>
              <p
                className="text-[14px] italic text-ink-soft"
                style={{ fontFamily: "var(--font-display)" }}
              >
                "{activeSkin.meta.personality}"
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Link
                  to="/templates/$id"
                  params={{ id: activeSkin.meta.id }}
                  className="tap inline-flex min-h-11 items-center border border-ink/20 px-5 text-[10px] font-medium uppercase tracking-[0.3em] text-ink/70 transition-colors hover:border-seal hover:text-seal"
                >
                  See preview
                </Link>
                <button
                  type="button"
                  disabled={pickingId === activeSkin.meta.id}
                  onClick={() => onPick(activeSkin.meta.id)}
                  className="tap inline-flex min-h-11 items-center gap-2 border border-seal/50 bg-seal/10 px-5 text-[10px] font-medium uppercase tracking-[0.3em] text-seal transition-colors hover:bg-seal hover:text-paper disabled:cursor-wait disabled:opacity-50"
                >
                  {pickingId === activeSkin.meta.id && (
                    <span
                      aria-hidden
                      className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
                    />
                  )}
                  {pickingId === activeSkin.meta.id ? "Minting…" : "Mint this dossier"}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Steering row */}
        <div className="flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Previous template"
            className="tap inline-flex h-11 w-11 items-center justify-center border border-ink/15 text-ink/70 transition-colors hover:border-seal hover:text-seal disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div aria-hidden className="flex items-center gap-2">
            {skins.map((s, i) => (
              <button
                key={s.meta.id}
                type="button"
                tabIndex={-1}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === active ? "w-6 bg-seal" : "w-1.5 bg-ink/25 hover:bg-ink/50"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            disabled={active === skins.length - 1}
            aria-label="Next template"
            className="tap inline-flex h-11 w-11 items-center justify-center border border-ink/15 text-ink/70 transition-colors hover:border-seal hover:text-seal disabled:opacity-30"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[9px] font-medium uppercase tracking-[0.4em] text-ink/40">
          Drag the table · click a cover · {skins.length} templates
        </p>
      </div>
    </section>
  );
}

/**
 * One cover on the ring. Its transform derives from the shared spring:
 * position on the arc, facing angle, uniform scale, and depth-based
 * dimming — proportions are never squished and covers never ghost.
 */
function RingCover({
  skin,
  index,
  ring,
  isActive,
  onSelect,
}: {
  skin: SkinModule;
  index: number;
  ring: MotionValue<number>;
  isActive: boolean;
  onSelect: () => void;
}) {
  const transform = useTransform(ring, (v) => {
    const off = index - v;
    const th = (off * STEP_DEG * Math.PI) / 180;
    const x = Math.sin(th) * RADIUS;
    const z = (Math.cos(th) - 1) * RADIUS;
    const rotY = -off * STEP_DEG * 1.15;
    // Center = exactly 1 (crisp raster); neighbors only ever scale down.
    const scale = Math.min(1, Math.max(0.7, 1 - Math.abs(off) * 0.11));
    return `translate3d(${x.toFixed(1)}px, 0px, ${z.toFixed(1)}px) rotateY(${rotY.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
  });
  // Covers further from the lamp sit in shadow — dimmed, never transparent.
  const shade = useTransform(ring, (v) => Math.min(0.62, Math.abs(index - v) * 0.24));
  const zIndex = useTransform(ring, (v) => 100 - Math.round(Math.abs(index - v) * 10));
  const display = useTransform(ring, (v) =>
    Math.abs(index - v) > RENDER_EACH_SIDE + 0.5 ? "none" : "block",
  );

  return (
    <motion.div
      className="absolute"
      style={{
        width: `${CARD_W}px`,
        transform,
        zIndex,
        display,
        transformStyle: "preserve-3d",
        backfaceVisibility: "hidden",
      }}
    >
      <div
        role="button"
        tabIndex={isActive ? 0 : -1}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        aria-label={
          isActive
            ? `Open the ${skin.meta.codename} spread`
            : `Bring ${skin.meta.codename} to the center`
        }
        className="group relative block w-full cursor-pointer border border-ink/20 shadow-[0_36px_70px_-32px_rgba(0,0,0,0.85)] transition-[border-color] duration-300 hover:border-seal/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal/60"
        style={{ background: skin.tokens.bg }}
      >
        {/* The cover is a dossier object, not a shrunken demo itinerary. */}
        <div className="td-cover relative h-[380px] w-full overflow-hidden">
          <DossierCoverArt skin={skin} selected={isActive} size="lg" />
        </div>
        <div className="flex items-center justify-between border-t border-black/10 px-4 py-3">
          <span
            className="text-lg"
            style={{ fontFamily: skin.tokens.fontDisplay, color: skin.tokens.ink }}
          >
            {skin.meta.codename}
            <span style={{ color: skin.tokens.accent }}>.</span>
          </span>
        </div>
        {/* Depth dim: black wash that deepens with distance from center. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "#05070d", opacity: shade }}
        />
      </div>
    </motion.div>
  );
}

/**
 * MobileCoverRail — the atelier table's phone-native sibling. No 3D
 * theatrics that fight a touchscreen: real horizontal scroll with snap
 * points, one dossier cover per stop, the same Open/Mint pair. Honest
 * physics beat simulated ones under a thumb.
 */
export function MobileCoverRail({
  skins,
  onPick,
  pickingId,
  variant = "horizontal",
}: {
  skins: SkinModule[];
  onPick: (id: string) => void;
  pickingId: string | null;
  variant?: CoverVariant;
}) {
  return (
    <MobileCoverRailInner
      skins={skins}
      onPick={onPick}
      pickingId={pickingId}
      variant={variant}
    />
  );
}

/** One dossier cover with its title, personality line, and actions.
 *  Shared by the horizontal rail and the vertical stack. */
function CoverCard({
  skin,
  onPick,
  pickingId,
  className = "",
  variant = "horizontal",
}: {
  skin: SkinModule;
  onPick: (id: string) => void;
  pickingId: string | null;
  className?: string;
  variant?: CoverVariant;
}) {
  const busy = pickingId === skin.meta.id;
  return (
    <article
      className={`rounded-[10px] border border-ink/15 ${className}`}
      style={{ background: skin.tokens.bg }}
    >
      <div className="td-cover relative h-[300px] w-full overflow-hidden rounded-t-[10px]">
        <DossierCoverArt skin={skin} variant={variant} />
      </div>
      <div className="border-t px-4 py-3" style={{ borderColor: skin.tokens.rule }}>
        <h3
          className="text-2xl leading-none"
          style={{ fontFamily: skin.tokens.fontDisplay, color: skin.tokens.ink }}
        >
          {skin.meta.codename}
          <span style={{ color: skin.tokens.accent }}>.</span>
        </h3>
        <p
          className="mt-1.5 truncate text-[12px] italic"
          style={{ fontFamily: skin.tokens.fontDisplay, color: skin.tokens.inkSoft }}
        >
          "{skin.meta.personality}"
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Link
            to="/templates/$id"
            params={{ id: skin.meta.id }}
            className="tap inline-flex min-h-11 flex-1 items-center justify-center border text-[10px] font-medium uppercase tracking-[0.25em]"
            style={{ borderColor: skin.tokens.rule, color: skin.tokens.inkSoft }}
          >
            Preview
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPick(skin.meta.id)}
            className="tap inline-flex min-h-11 flex-1 items-center justify-center gap-2 border text-[10px] font-medium uppercase tracking-[0.25em] disabled:cursor-wait disabled:opacity-50"
            style={{ borderColor: skin.tokens.accent, color: skin.tokens.accent }}
          >
            {busy && (
              <span
                aria-hidden
                className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
              />
            )}
            {busy ? "Minting…" : "Mint"}
          </button>
        </div>
      </div>
    </article>
  );
}

/** Vertical view — the same covers stacked in one scrolling column. */
export function VerticalCoverStack({
  skins,
  onPick,
  pickingId,
}: {
  skins: SkinModule[];
  onPick: (id: string) => void;
  pickingId: string | null;
}) {
  if (skins.length === 0) return null;
  return (
    <section
      aria-label="Dossier templates, stacked covers"
      className="mx-auto flex max-w-[420px] flex-col gap-5"
    >
      {skins.map((skin) => (
        <CoverCard
          key={skin.meta.id}
          skin={skin}
          onPick={onPick}
          pickingId={pickingId}
          className="w-full"
        />
      ))}
    </section>
  );
}

function MobileCoverRailInner({
  skins,
  onPick,
  pickingId,
  variant,
}: {
  skins: SkinModule[];
  onPick: (id: string) => void;
  pickingId: string | null;
  variant: CoverVariant;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState(0);

  // Track the centred cover so the dots below reflect the thumb's position.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const mid = rail.scrollLeft + rail.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < rail.children.length; i++) {
        const el = rail.children[i] as HTMLElement;
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      setCenter(best);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    rail.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      rail.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [skins.length]);

  const scrollToIndex = (i: number) => {
    const rail = railRef.current;
    const card = rail?.children[i] as HTMLElement | undefined;
    if (!rail || !card) return;
    rail.scrollTo({
      left: card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2,
      behavior: "smooth",
    });
  };

  if (skins.length === 0) return null;
  return (
    <section aria-label="Dossier templates, swipeable covers">
      {/* Generous side padding so the first and last cover can actually
          centre under the thumb instead of clipping at the edge. */}
      <div
        ref={railRef}
        className="scroll-x -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[11vw] pb-2"
      >
        {skins.map((skin) => (
          <CoverCard
            key={skin.meta.id}
            skin={skin}
            onPick={onPick}
            pickingId={pickingId}
            variant={variant}
            className="w-[78vw] max-w-[340px] shrink-0 snap-center"
          />
        ))}
      </div>
      {skins.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          {skins.map((s, i) => (
            <button
              key={s.meta.id}
              type="button"
              onClick={() => scrollToIndex(i)}
              aria-label={`Show ${s.meta.codename}`}
              className="tap inline-flex h-6 w-6 items-center justify-center"
            >
              <span
                aria-hidden
                className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                  i === center ? "w-5 bg-seal" : "w-1.5 bg-ink/25"
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-center text-[9px] font-medium uppercase tracking-[0.4em] text-ink/40">
        Swipe the covers · {skins.length} templates
      </p>
    </section>
  );
}

/** Measured-scale live preview of a skin, same approach as the grid tiles:
 *  render the real 1400px page and shrink it to the tile. Pass `view` to
 *  pivot the preview through the product's three layouts. */
export function SkinCoverTile({
  skin,
  height,
  view = "vertical",
}: {
  skin: SkinModule;
  height: number;
  view?: import("@/lib/skins/types").SkinView;
}) {
  const { Render, previewFixture, tokens } = skin;
  const tileRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [contentH, setContentH] = useState(0);
  useEffect(() => {
    const el = tileRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / 1400);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setContentH(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);
  return (
    <div
      ref={tileRef}
      className="relative w-full overflow-y-auto overflow-x-hidden overscroll-contain"
      style={{ height: `${height}px`, background: tokens.bg }}
    >
      <div
        ref={innerRef}
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: "1400px", transform: `scale(${scale})`, pointerEvents: "none" }}
      >
        {tokens.fontUrl && <link rel="stylesheet" href={tokens.fontUrl} />}
        <InertRender>
          <Render trip={previewFixture.trip} blocks={previewFixture.blocks} view={view} />
        </InertRender>
      </div>
      {/* Spacer establishes the scrollable height that matches the scaled
          content, since the rendered inner is absolutely positioned. */}
      <div aria-hidden style={{ height: `${Math.max(0, contentH * scale)}px` }} />
      <div
        aria-hidden
        className="pointer-events-none sticky bottom-0 -mt-24 h-24 w-full"
        style={{
          background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 100%)",
        }}
      />
    </div>
  );
}
