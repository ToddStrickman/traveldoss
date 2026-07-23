/**
 * AtelierTable — the dossier templates laid out on a dark table, browsed
 * as a 3D coverflow. Desktop-only (the grid + SkinPeek flow stays the
 * mobile experience). The centered dossier shows its live preview large
 * with mint + open actions; side covers are angled and clickable. Arrows,
 * keyboard, click and drag all steer the stack.
 *
 * Every template is also emitted as a visually-hidden real link so the
 * full set stays crawlable even though only five covers render at once.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { SkinModule } from "@/lib/skins/registry";
import { InertRender } from "@/lib/skins/shared/views/parts";

const VISIBLE_EACH_SIDE = 2;

export function AtelierTable({
  skins,
  onPick,
  pickingId,
}: {
  skins: SkinModule[];
  onPick: (id: string) => void;
  pickingId: string | null;
}) {
  const [center, setCenter] = useState(0);
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Filters can shrink the deck under the current index — stay in range.
  useEffect(() => {
    setCenter((c) => Math.min(c, Math.max(0, skins.length - 1)));
  }, [skins.length]);

  const step = (dir: number) =>
    setCenter((c) => Math.min(skins.length - 1, Math.max(0, c + dir)));

  // Pointer drag: horizontal slide past a threshold advances the stack.
  const dragX = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    dragX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragX.current === null) return;
    const dx = e.clientX - dragX.current;
    dragX.current = null;
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  };

  if (skins.length === 0) return null;
  const centered = skins[center];

  return (
    <section
      aria-label="Dossier templates on the atelier table"
      className="relative"
    >
      {/* Crawlable full index — the 3D stage only mounts five covers. */}
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
        aria-label={`Template ${center + 1} of ${skins.length}: ${centered.meta.codename}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className="relative select-none outline-none focus-visible:ring-2 focus-visible:ring-seal/50"
        style={{ perspective: "1200px" }}
      >
        {/* The table: a receding plane under the stack. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[-8%] bottom-0 h-[46%] border-t border-ink/15"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,16,30,0.9) 0%, rgba(6,10,20,0.98) 100%)",
            transform: "rotateX(55deg)",
            transformOrigin: "bottom",
          }}
        />

        <div className="relative flex h-[520px] items-center justify-center">
          {skins.map((skin, i) => {
            const off = i - center;
            if (Math.abs(off) > VISIBLE_EACH_SIDE) return null;
            const isCenter = off === 0;
            const dir = off < 0 ? 1 : -1;
            const abs = Math.abs(off);
            return (
              <div
                key={skin.meta.id}
                className="absolute"
                style={{
                  zIndex: 10 - abs,
                  transform: isCenter
                    ? "translateX(0) rotateY(0deg) translateZ(0)"
                    : `translateX(${off * 58}%) translateY(${abs * 14}px) rotateY(${dir * 42}deg) translateZ(${-170 * abs}px)`,
                  opacity: isCenter ? 1 : 0.55 - abs * 0.12,
                  transition: reducedMotion
                    ? undefined
                    : "transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.55s",
                  width: isCenter ? "min(46vw, 560px)" : "min(24vw, 300px)",
                }}
              >
                {isCenter ? (
                  <CenterDossier
                    skin={skin}
                    onPick={onPick}
                    picking={pickingId === skin.meta.id}
                  />
                ) : (
                  /* role="button" on a div, NOT a real <button>: the live
                     preview inside contains the skin's own buttons, and
                     button-in-button is invalid HTML — the parser splits
                     the SSR markup and hydration fails. Same pattern as
                     the grid's SkinCard. */
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setCenter(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setCenter(i);
                      }
                    }}
                    aria-label={`Bring ${skin.meta.codename} to the center`}
                    className="group block w-full cursor-pointer border border-ink/15 text-left transition-colors hover:border-seal/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal/50"
                    style={{ background: skin.tokens.bg }}
                  >
                    <SkinCoverTile skin={skin} height={300} />
                    <div className="border-t border-black/10 px-4 py-3">
                      <span
                        className="text-lg"
                        style={{
                          fontFamily: skin.tokens.fontDisplay,
                          color: skin.tokens.ink,
                        }}
                      >
                        {skin.meta.codename}
                        <span style={{ color: skin.tokens.accent }}>.</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Steering row */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={center === 0}
          aria-label="Previous template"
          className="tap inline-flex h-11 w-11 items-center justify-center border border-ink/15 text-ink/70 transition-colors hover:border-seal hover:text-seal disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div
          aria-hidden
          className="flex items-center gap-2"
        >
          {skins.map((s, i) => (
            <button
              key={s.meta.id}
              type="button"
              tabIndex={-1}
              onClick={() => setCenter(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === center ? "w-6 bg-seal" : "w-1.5 bg-ink/25 hover:bg-ink/50"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={center === skins.length - 1}
          aria-label="Next template"
          className="tap inline-flex h-11 w-11 items-center justify-center border border-ink/15 text-ink/70 transition-colors hover:border-seal hover:text-seal disabled:opacity-30"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function CenterDossier({
  skin,
  onPick,
  picking,
}: {
  skin: SkinModule;
  onPick: (id: string) => void;
  picking: boolean;
}) {
  const navigate = useNavigate();
  return (
    <article
      className="border border-ink/20 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]"
      style={{ background: skin.tokens.bg }}
    >
      {/* Click target, not an <a>: the preview holds the skin's own
          buttons and interactive-in-interactive breaks SSR parsing. The
          crawlable link to the spread is the "Open" CTA + sr-only nav. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate({ to: "/templates/$id", params: { id: skin.meta.id } })}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate({ to: "/templates/$id", params: { id: skin.meta.id } });
          }
        }}
        aria-label={`Open the ${skin.meta.codename} spread`}
        className="block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal/60"
      >
        <SkinCoverTile skin={skin} height={340} />
      </div>
      <div className="flex items-end justify-between gap-4 border-t px-5 py-4" style={{ borderColor: skin.tokens.rule }}>
        <div className="min-w-0">
          <h3
            className="text-3xl leading-none"
            style={{ fontFamily: skin.tokens.fontDisplay, color: skin.tokens.ink }}
          >
            {skin.meta.codename}
            <span style={{ color: skin.tokens.accent }}>.</span>
          </h3>
          <p
            className="mt-1.5 truncate text-[13px] italic"
            style={{ fontFamily: skin.tokens.fontDisplay, color: skin.tokens.inkSoft }}
          >
            "{skin.meta.personality}"
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/templates/$id"
            params={{ id: skin.meta.id }}
            className="tap inline-flex min-h-10 items-center border px-3 text-[10px] font-medium uppercase tracking-[0.25em] transition-colors"
            style={{ borderColor: skin.tokens.rule, color: skin.tokens.inkSoft }}
          >
            Open
          </Link>
          <button
            type="button"
            disabled={picking}
            onClick={() => onPick(skin.meta.id)}
            className="tap inline-flex min-h-10 items-center gap-2 border px-3 text-[10px] font-medium uppercase tracking-[0.25em] transition-colors disabled:cursor-wait disabled:opacity-50"
            style={{
              borderColor: skin.tokens.accent,
              color: skin.tokens.accent,
            }}
          >
            {picking && (
              <span
                aria-hidden
                className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
              />
            )}
            {picking ? "Minting…" : "Mint"}
          </button>
        </div>
      </div>
    </article>
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
}: {
  skins: SkinModule[];
  onPick: (id: string) => void;
  pickingId: string | null;
}) {
  if (skins.length === 0) return null;
  return (
    <section aria-label="Dossier templates, swipeable covers">
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
        {skins.map((skin) => (
          <article
            key={skin.meta.id}
            className="w-[78vw] max-w-[340px] shrink-0 snap-center border border-ink/15"
            style={{ background: skin.tokens.bg }}
          >
            <SkinCoverTile skin={skin} height={280} />
            <div
              className="border-t px-4 py-3"
              style={{ borderColor: skin.tokens.rule }}
            >
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
                  Open
                </Link>
                <button
                  type="button"
                  disabled={pickingId === skin.meta.id}
                  onClick={() => onPick(skin.meta.id)}
                  className="tap inline-flex min-h-11 flex-1 items-center justify-center gap-2 border text-[10px] font-medium uppercase tracking-[0.25em] disabled:cursor-wait disabled:opacity-50"
                  style={{ borderColor: skin.tokens.accent, color: skin.tokens.accent }}
                >
                  {pickingId === skin.meta.id && (
                    <span
                      aria-hidden
                      className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
                    />
                  )}
                  {pickingId === skin.meta.id ? "Minting…" : "Mint"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-3 text-center text-[9px] font-medium uppercase tracking-[0.4em] text-ink/40">
        Swipe the covers · {skins.length} templates
      </p>
    </section>
  );
}

/** Measured-scale live preview of a skin, same approach as the grid tiles:
 *  render the real 1400px page and shrink it to the tile. */
export function SkinCoverTile({
  skin,
  height,
}: {
  skin: SkinModule;
  height: number;
}) {
  const { Render, previewFixture, tokens } = skin;
  const tileRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
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
  return (
    <div
      ref={tileRef}
      className="relative w-full overflow-hidden"
      style={{ height: `${height}px`, background: tokens.bg }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: "1400px", transform: `scale(${scale})`, pointerEvents: "none" }}
      >
        {tokens.fontUrl && <link rel="stylesheet" href={tokens.fontUrl} />}
        <InertRender>
          <Render trip={previewFixture.trip} blocks={previewFixture.blocks} />
        </InertRender>
      </div>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.35) 100%)",
        }}
      />
    </div>
  );
}
