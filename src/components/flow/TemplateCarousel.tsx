/**
 * TemplateCarousel — stage 1 of the compose flow.
 *
 * Choosing a dossier should feel like sliding a leather-bound volume off a
 * shelf: the centred cover stands upright and full size, its neighbours tilt
 * away in perspective. One tap chooses (no confirm button); the pick plays a
 * short seal-press before the flow advances.
 *
 * Everything below reduces to a plain crossfade under prefers-reduced-motion,
 * and every card slot has fixed dimensions so CLS stays 0.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { SKINS } from "@/lib/skins/registry";
import type { SkinModule } from "@/lib/skins/types";
import { trackTemplatePreviewed } from "@/lib/analytics";
import { SandDrift } from "./SandDrift";
import { DossierCoverArt } from "./DossierCover";

/** Card slot geometry — fixed, so the row never reflows. */
const CARD_W = 212;
const CARD_H = 312;
const GAP = 18;

export function TemplateCarousel({
  activeId,
  onPick,
}: {
  /** Currently chosen skin, if the user is coming back to change it. */
  activeId?: string | null;
  onPick: (skin: SkinModule, index: number) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const initialIndex = Math.max(
    0,
    SKINS.findIndex((s) => s.meta.id === activeId),
  );
  const [center, setCenter] = useState(initialIndex);
  const [stamped, setStamped] = useState<string | null>(null);
  const lastPreviewed = useRef<string | null>(null);

  const scrollTo = useCallback((i: number, smooth = true) => {
    const rail = railRef.current;
    const card = rail?.children[i] as HTMLElement | undefined;
    if (!rail || !card) return;
    const left = card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2;
    rail.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Centre the incoming choice without animating on first paint.
  useEffect(() => {
    scrollTo(initialIndex, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track which card sits in the middle of the rail.
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
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setCenter(best);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    rail.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      rail.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Throttled to the settled centre only, so a swipe doesn't spray events.
  useEffect(() => {
    const skin = SKINS[center];
    if (!skin) return;
    const t = setTimeout(() => {
      if (lastPreviewed.current === skin.meta.id) return;
      lastPreviewed.current = skin.meta.id;
      trackTemplatePreviewed(skin.meta.id);
    }, 400);
    return () => clearTimeout(t);
  }, [center]);

  function choose(i: number) {
    const skin = SKINS[i];
    if (!skin) return;
    if (i !== center) {
      scrollTo(i);
      return;
    }
    // Seal-press flourish, then advance.
    setStamped(skin.meta.id);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => onPick(skin, i), reduce ? 0 : 420);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollTo(Math.min(SKINS.length - 1, center + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollTo(Math.max(0, center - 1));
    }
  }

  const active = SKINS[center];

  return (
    <div className="relative flex w-full min-w-0 max-w-full flex-col overflow-hidden">
      {/* Sand echo — ties this moment to the wordmark that opened the site. */}
      <SandDrift className="pointer-events-none absolute inset-x-0 top-6 h-[260px] opacity-60" />

      <div className="relative px-5 pt-8 sm:px-8 md:px-10">
        <div className="td-eyebrow flex items-center gap-3 text-ink/55">
          <span className="h-px w-8 bg-ink/25" />
          Step one
        </div>
        <h2 className="td-headline mt-3 text-[2rem] font-normal leading-[1.05] tracking-[-0.022em] text-ink sm:text-[2.4rem]">
          Pick your <span className="italic text-ink/80">dossier</span>
          <span className="text-seal">.</span>
        </h2>
        <p className="mt-2 max-w-md text-[14px] leading-[1.55] text-ink-soft">
          Eleven bound volumes, each with its own paper, ink, and temperament.
          Slide through and tap the one you want to compose in.
        </p>
      </div>

      {/* Rail */}
      <div className="relative mt-6 w-full min-w-0">
        <div
          ref={railRef}
          role="listbox"
          aria-label="Dossier templates"
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="td-coverflow flex w-full min-w-0 snap-x snap-mandatory items-center overflow-x-auto scroll-smooth px-[calc(50%-106px)] pb-6 pt-2 outline-none focus-visible:ring-2 focus-visible:ring-seal/60 motion-reduce:scroll-auto"
          style={{ gap: `${GAP}px`, scrollbarWidth: "none" }}
        >
          {SKINS.map((skin, i) => (
            <Cover
              key={skin.meta.id}
              skin={skin}
              offset={i - center}
              selected={i === center}
              stamped={stamped === skin.meta.id}
              onClick={() => choose(i)}
            />
          ))}
        </div>

        {/* Persistent arrows — 44px targets, visible on every breakpoint. */}
        <RailArrow side="left" disabled={center === 0} onClick={() => scrollTo(center - 1)} />
        <RailArrow
          side="right"
          disabled={center >= SKINS.length - 1}
          onClick={() => scrollTo(center + 1)}
        />
      </div>

      {/* Caption — fixed height so the crossfade never shifts layout. */}
      <div className="relative flex h-[58px] flex-col items-center justify-center px-6 text-center">
        {active ? (
          <>
            <div
              key={active.meta.id}
              className="td-caption-fade text-[15px] italic leading-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "color-mix(in oklab, var(--seal) 78%, var(--ink))",
              }}
            >
              {active.meta.personality}.
            </div>
            <div className="td-eyebrow mt-1.5 text-ink/45">
              {active.meta.tags.join(" · ")}
            </div>
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-2">
        {SKINS.map((s, i) => (
          <span
            key={s.meta.id}
            aria-hidden
            className={`h-1 rounded-full transition-all duration-300 ${
              i === center ? "w-5 bg-seal" : "w-1 bg-ink/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function RailArrow({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous template" : "Next template"}
      className={`td-rail-arrow absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-ink/15 bg-paper/80 text-ink/70 backdrop-blur-md hover:border-seal hover:text-seal disabled:opacity-25 ${
        side === "left" ? "left-1 sm:left-3" : "right-1 sm:right-3"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d={side === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** One dossier cover, drawn entirely from that skin's own tokens. */
function Cover({
  skin,
  offset,
  selected,
  stamped,
  onClick,
}: {
  skin: SkinModule;
  offset: number;
  selected: boolean;
  stamped: boolean;
  onClick: () => void;
}) {
  const t = skin.tokens;
  const clamped = Math.max(-3, Math.min(3, offset));
  const abs = Math.abs(clamped);
  return (
    <div
      className="td-cover-slot snap-center"
      style={{
        width: `${CARD_W}px`,
        height: `${CARD_H}px`,
        // Cover-flow perspective: neighbours tilt away and dim.
        ["--tilt" as string]: `${clamped * -16}deg`,
        ["--push" as string]: `${abs * -6}px`,
        ["--scale" as string]: `${selected ? 1 : Math.max(0.82, 1 - abs * 0.07)}`,
        ["--fade" as string]: `${selected ? 1 : Math.max(0.42, 1 - abs * 0.22)}`,
      }}
    >
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onClick}
        className={`td-cover group relative block h-full w-full overflow-hidden rounded-[10px] text-left ${
          stamped ? "td-cover-stamped" : ""
        } ${selected ? "td-cover-selected" : ""}`}
        style={{
          background: t.bg,
          color: t.ink,
          border: `1px solid ${t.rule}`,
          boxShadow: selected
            ? "0 22px 48px -18px rgba(0,0,0,0.7), 0 0 0 1px color-mix(in oklab, var(--seal) 45%, transparent)"
            : "0 10px 24px -14px rgba(0,0,0,0.6)",
        }}
      >
        <DossierCoverArt skin={skin} selected={selected} />
      </button>
    </div>
  );
}
