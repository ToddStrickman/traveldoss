import { useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
} from "motion/react";
import { Link } from "@tanstack/react-router";
import { Parallax } from "@/components/motion/Tilt";
import { capture } from "@/lib/analytics";

type Step = {
  n: string;
  kicker: string;
  title: string;
  body: string;
  visual: "template" | "paste" | "parse" | "map" | "dossier";
};

const STEPS: Step[] = [
  {
    n: "01",
    kicker: "Pick a vessel",
    title: "Choose a dossier template.",
    body: "The cards on the right are your covers. Each one is a typographic mood — same engine inside, very different feeling on the page.",
    visual: "template",
  },
  {
    n: "02",
    kicker: "Bring the mess",
    title: "Paste anything.",
    body: "A half-written note. A forwarded confirmation. A shared draft your friend keeps editing. Drop it in — punctuation optional.",
    visual: "paste",
  },
  {
    n: "03",
    kicker: "Quiet machinery",
    title: "We read it for you.",
    body: "Places, dates, reservations, room numbers, flight codes. Pulled out, tagged, and lined up in the order you'll live them.",
    visual: "parse",
  },
  {
    n: "04",
    kicker: "Find your way",
    title: "Routes appear on a map.",
    body: "Every stop pinned. Days drawn as lines. You'll see the morning walk, the long train, the detour through Sintra.",
    visual: "map",
  },
  {
    n: "05",
    kicker: "Arrive well",
    title: "Open your dossier.",
    body: "A quiet, beautifully set document — day by day, hour by hour. Yours to share, print, or keep to yourself.",
    visual: "dossier",
  },
];

export function FlowScroller() {
  return (
    <>
      <DesktopFlow />
      <MobileFlow />
    </>
  );
}

/**
 * Prev/next controls for the flow ribbon. Keyboard users get real buttons
 * (>=44px), left/right arrow keys anywhere inside the section, and a polite
 * live region announcing the step they landed on.
 */
function StepControls({
  active,
  onGo,
  className = "",
}: {
  active: number;
  onGo: (i: number) => void;
  className?: string;
}) {
  const atStart = active === 0;
  const atEnd = active === STEPS.length - 1;
  const base =
    "inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 bg-paper/80 text-ink shadow-[0_1px_0_rgba(255,255,255,0.6)_inset] backdrop-blur-md transition-opacity hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal disabled:opacity-35";
  return (
    <div className={`pointer-events-auto flex items-center gap-2 ${className}`}>
      <button
        type="button"
        className={base}
        onClick={() => onGo(active - 1)}
        disabled={atStart}
        aria-label="Previous step"
      >
        <span aria-hidden="true" className="text-base leading-none">
          ←
        </span>
      </button>
      <button
        type="button"
        className={base}
        onClick={() => onGo(active + 1)}
        disabled={atEnd}
        aria-label="Next step"
      >
        <span aria-hidden="true" className="text-base leading-none">
          →
        </span>
      </button>
      <p className="sr-only" aria-live="polite">
        {`Step ${active + 1} of ${STEPS.length}: ${STEPS[active]?.title ?? ""}`}
      </p>
    </div>
  );
}

/** Left/right arrow keys move a step while the flow section is on screen. */
function useStepKeys(
  ref: React.RefObject<HTMLElement | null>,
  active: number,
  onGo: (i: number, via: "keyboard") => void,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
      )
        return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Only claim the arrow keys while the pinned flow fills the viewport.
      if (r.top > window.innerHeight * 0.5 || r.bottom < window.innerHeight * 0.5)
        return;
      e.preventDefault();
      onGo(active + (e.key === "ArrowRight" ? 1 : -1), "keyboard");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ref, active, onGo]);
}

function DesktopFlow() {
  const containerRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  useEffect(() => {
    const unsub = scrollYProgress.on("change", (v) => {
      const i = Math.min(
        STEPS.length - 1,
        Math.max(0, Math.round(v * (STEPS.length - 1))),
      );
      setActive(i);
    });
    return () => unsub();
  }, [scrollYProgress]);

  // Desktop progress maps linearly across the pin distance, so step i rests at
  // i/(N-1) of it — the same position the ribbon uses for its x transform.
  const goToStep = (i: number, via: "button" | "keyboard" = "button") => {
    const el = containerRef.current;
    if (!el) return;
    const clamped = Math.min(STEPS.length - 1, Math.max(0, i));
    if (clamped === active) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const pin = Math.max(1, el.offsetHeight - window.innerHeight);
    capture("flow_step_navigated", {
      step: clamped + 1,
      from_step: active + 1,
      via,
      surface: "desktop",
    });
    window.scrollTo({
      top: top + (pin * clamped) / (STEPS.length - 1),
      behavior: reduce ? "auto" : "smooth",
    });
  };
  useStepKeys(containerRef, active, goToStep);

  // Track translates horizontally across the steps.
  // We show N panels; translate from 0 to -(N-1)/N * 100%.
  const distance = -((STEPS.length - 1) / STEPS.length) * 100;
  const xRaw = useTransform(scrollYProgress, [0, 1], [`0%`, `${distance}%`]);
  const x = useSpring(xRaw, { stiffness: 120, damping: 24, mass: 0.4 });

  const progressX = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section
      ref={containerRef}
      className="relative z-10 hidden lg:block"
      style={{ height: `${STEPS.length * 52}vh` }}
      aria-label="How TravelDoss works"
    >
      {/* Sticky viewport is intentionally shorter than 100dvh: the panel
          content (kicker + headline + copy + ~44vh visual) is finite, so a
          full-viewport sticky left huge dead space above and below. We pin
          content to a ~720px band centered vertically instead. */}
      <div className="sticky top-[max(0px,calc((100dvh-min(660px,80dvh))/2))] mx-auto h-[min(660px,80dvh)] overflow-hidden">
        {/* Section label */}
        <div className="pointer-events-none absolute left-8 right-8 top-4 z-20 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.4em] text-ink/45 md:left-12 md:right-[340px] lg:left-20 xl:left-32 xl:top-6">
          <span className="inline-flex items-center gap-3">
            <span className="h-px w-8 bg-ink/25" />
            The Flow
          </span>
          <span className="inline-flex items-center gap-3">
            Scroll to follow along
            <span className="h-px w-8 bg-ink/25" />
          </span>
        </div>

        {/* Horizontal track clipped strictly to the rail-safe area */}
        <div className="absolute inset-y-0 left-8 right-8 overflow-hidden pt-12 pb-14 md:left-12 md:right-[340px] md:pt-12 md:pb-14 lg:left-20 lg:pt-14 xl:left-32">
          <motion.div
            style={{ x, width: `${STEPS.length * 100}%` }}
            className="flex h-full"
          >
            {STEPS.map((step, i) => (
              <Panel key={step.n} step={step} index={i} total={STEPS.length} />
            ))}
          </motion.div>
        </div>

        {/* Bottom progress + counter */}
        <div className="pointer-events-none absolute bottom-4 left-8 right-8 z-20 md:left-12 md:right-[340px] lg:left-20 xl:bottom-6 xl:left-32">
          <div className="mb-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.4em] text-ink/45">
            <Counter scrollYProgress={scrollYProgress} total={STEPS.length} />
            <span className="flex items-center gap-4">
              <span>Your itinerary, unfolding.</span>
              <StepControls active={active} onGo={goToStep} />
            </span>
          </div>
          <div className="relative h-px w-full bg-ink/10">
            <motion.div
              style={{ width: progressX }}
              className="absolute left-0 top-0 h-px bg-seal"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileFlow() {
  // Scroll-pin: the section is STEPS.length viewport-heights tall and
  // holds a sticky 100dvh viewport that swaps step content based on the
  // section's scrollYProgress. That means the user MUST scroll through
  // the full 5×100dvh distance to leave the flow — there is no way to
  // jump past it — while still using the document's native scroll (no
  // hijacking, honors reduced motion, back/forward, and browser gestures).
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const unsub = scrollYProgress.on("change", (v) => {
      // Snap rest positions sit at bucket CENTRES, so the indicator picks the
      // nearest centre rather than flooring the bucket. Flooring made the
      // pill flip a step early on viewports where the settled scroll lands a
      // hair under a bucket edge (short landscape phones, tablets where
      // --tds-flow-step is 80svh); nearest-centre matches the panel actually
      // parked in the viewport at every size.
      const i = Math.min(
        STEPS.length - 1,
        Math.max(0, Math.round(v * STEPS.length - 0.5)),
      );
      setActive(i);
    });
    return () => unsub();
  }, [scrollYProgress]);

  // Same mechanic as desktop: one continuous horizontal track that slides
  // laterally with scroll progress, so the steps move as a single ribbon
  // instead of cutting between cards.
  // Each panel rests centred while its bucket is active and glides to the
  // next one across the bucket boundary, so the ribbon never sits half-way
  // between two steps at rest.
  const centers = STEPS.map((_, i) => (i + 0.5) / STEPS.length);
  const offsets = STEPS.map((_, i) => `${-(i / STEPS.length) * 100}%`);
  const xRaw = useTransform(scrollYProgress, centers, offsets, {
    clamp: true,
  });
  const x = useSpring(xRaw, { stiffness: 130, damping: 26, mass: 0.4 });

  // Scroll snapping: the document scroller only gets snap points while the
  // flow is on screen, so the rest of the page keeps free scrolling. Each
  // step has an invisible snap target one step-height apart, which lines up
  // exactly with the progress buckets above — so a flick always lands on a
  // step, never between two.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const io = new IntersectionObserver(
      ([entry]) => {
        root.style.scrollSnapType = entry.isIntersecting ? "y proximity" : "";
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      root.style.scrollSnapType = "";
    };
  }, []);

  // Snap targets are measured, not guessed: the pin distance depends on the
  // real viewport height, which on iOS never equals exactly 100svh. Computing
  // the tops in JS keeps the native snap points and goToStep() in perfect
  // agreement, so a flick rests square on a panel instead of ~100px off it.
  const [snapTops, setSnapTops] = useState<number[]>([]);
  useEffect(() => {
    let raf = 0;
    let ro: ResizeObserver | null = null;
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const pin = Math.max(1, el.offsetHeight - window.innerHeight);
      const next = STEPS.map((_, i) => (pin * (i + 0.5)) / STEPS.length);
      setSnapTops((prev) =>
        prev.length === next.length && prev.every((v, i) => v === next[i])
          ? prev
          : next,
      );
    };
    // The section mounts lazily, so the first effect tick can run before the
    // ref is attached and laid out. Retry on animation frames until it has a
    // real height, then keep it in sync: the height depends on the
    // --tds-flow-step breakpoint (100svh → 80svh in short landscape) and on
    // content reflow, so a resize listener alone leaves stale snap points
    // after rotation.
    const attach = () => {
      const el = containerRef.current;
      if (!el || el.offsetHeight <= window.innerHeight) {
        raf = requestAnimationFrame(attach);
        return;
      }
      measure();
      // Section height changes with the breakpoint and with content reflow.
      ro = new ResizeObserver(measure);
      ro.observe(el);
    };
    attach();
    window.visualViewport?.addEventListener("resize", measure);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.visualViewport?.removeEventListener("resize", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  const goToStep = (i: number, via: "button" | "keyboard" | "swipe" = "swipe") => {
    const el = containerRef.current;
    if (!el) return;
    const clamped = Math.min(STEPS.length - 1, Math.max(0, i));
    const top = el.getBoundingClientRect().top + window.scrollY;
    // Steps rest at the CENTRE of their progress bucket — that's where the
    // ribbon parks on an exact panel boundary. Progress runs over the PIN
    // distance (section height minus one viewport), not the full height, so
    // aiming at bucket starts would land the track halfway between panels.
    const pin = Math.max(1, el.offsetHeight - window.innerHeight);
    const target = top + (pin * (clamped + 0.5)) / STEPS.length;
    if (clamped !== active) {
      capture("flow_step_navigated", {
        step: clamped + 1,
        from_step: active + 1,
        via,
        surface: "mobile",
      });
    }
    window.scrollTo({
      top: target,
      behavior: reduce ? "auto" : "smooth",
    });
  };
  useStepKeys(containerRef, active, goToStep);

  // Swipe-friendly gesture: a horizontal flick advances or rewinds one step,
  // matching the lateral page-turn animation. Vertical drags are left alone
  // so native scrolling (and snapping) still works.
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (Date.now() - start.t > 800) return;
    goToStep(active + (dx < 0 ? 1 : -1), "swipe");
  };

  return (
    <section
      ref={containerRef}
      // Height uses svh (small-viewport-height) so the total scroll distance
      // stays constant while iOS shows/hides its URL bar — dvh would cause
      // the pin distance to change mid-scroll and feel like a bad snap.
      // overscroll-behavior-y:contain prevents rubber-band from leaking into
      // the next section on the last step.
      className="tds-flow-mobile relative z-10 block lg:hidden [overscroll-behavior-y:contain]"
      style={{ height: `calc(${STEPS.length} * var(--tds-flow-step, 100svh))` }}
      aria-label="How TravelDoss works"
    >
      {/* Invisible snap targets — one per step, placed at the CENTRE of each
          progress bucket measured over the pin distance, which is exactly
          where a panel sits square in the viewport. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            className="absolute left-0 h-px w-px [scroll-snap-align:start]"
            style={{ top: snapTops[i] ?? 0 }}
          />
        ))}
      </div>

      {/* Sticky uses dvh so it always fills the visible viewport, even as
          the URL bar collapses — content never leaves a strip of blank
          space under it. */}
      <div
        className="sticky top-0 h-[100dvh] max-h-[100svh] w-full overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Header rail at the very TOP: counter, progress bar, step dots and
            an explicit "keep scrolling" cue so it's obvious the section is a
            five-step walkthrough you're about to move through. Space is
            reserved (fixed height) so nothing shifts as steps change. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-30 px-5 md:pl-28 md:pr-[340px]"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 68px)" }}
        >
          <div className="flex h-9 items-center gap-3 rounded-full border border-ink/10 bg-paper/70 px-3.5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_4px_16px_-8px_rgba(0,0,0,0.25)] backdrop-blur-md">
            <span
              className="tabular-nums text-[13px] font-semibold leading-none tracking-tight text-ink"
              aria-live="polite"
            >
              <span className="text-seal">{String(active + 1).padStart(2, "0")}</span>
              <span className="text-ink/40"> / {String(STEPS.length).padStart(2, "0")}</span>
            </span>
            <span className="relative block h-1 flex-1 overflow-hidden rounded-full bg-ink/10">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-seal transition-[width] duration-300 ease-out"
                style={{ width: `${((active + 1) / STEPS.length) * 100}%` }}
              />
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5">
              {STEPS.map((s, i) => (
                <span
                  key={s.n}
                  className={`h-1.5 rounded-full transition-all ${
                    i === active ? "w-4 bg-seal" : "w-1.5 bg-ink/25"
                  }`}
                />
              ))}
            </span>
          </div>
          <div className="mt-1.5 flex h-4 items-center justify-between text-[9px] font-medium uppercase tracking-[0.35em] text-ink/50">
            <span>The Flow · 5 steps</span>
            <span
              className={`inline-flex items-center gap-1 transition-opacity duration-300 ${
                active === STEPS.length - 1 ? "opacity-0" : "opacity-100"
              }`}
            >
              Keep scrolling
              <span aria-hidden="true" className={reduce ? "" : "animate-bounce"}>
                ↓
              </span>
            </span>
          </div>
        </div>

        {/* One continuous horizontal track — the same mechanic as desktop, so
            the steps glide sideways as a single ribbon instead of cutting
            between cards. */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 148px)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 88px)",
          }}
        >
          <motion.div
            style={{ x, width: `${STEPS.length * 100}%` }}
            className="flex h-full will-change-transform"
          >
            {STEPS.map((s, i) => (
              <MobilePanel key={s.n} step={s} index={i} total={STEPS.length} />
            ))}
          </motion.div>
        </div>

        {/* Explicit prev/next controls, clear of the bottom dock. */}
        <div
          className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-5"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 28px)" }}
        >
          <StepControls active={active} onGo={(i) => goToStep(i, "button")} />
        </div>
      </div>
    </section>
  );
}

function Counter({
  scrollYProgress,
  total,
}: {
  scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"];
  total: number;
}) {
  const idx = useTransform(scrollYProgress, (v) =>
    String(Math.min(total, Math.max(1, Math.floor(v * total) + 1))).padStart(2, "0"),
  );
  return (
    <span className="inline-flex items-center gap-2">
      <motion.span className="text-seal">{idx}</motion.span>
      <span className="text-ink/30">/ {String(total).padStart(2, "0")}</span>
    </span>
  );
}

/** Mobile step panel — one slot on the horizontal track. Copy on top, the
 *  card visual below it, sized so the card is the dominant object on screen
 *  and there is no dead band under it. */
function MobilePanel({
  step,
  index,
  total,
}: {
  step: Step;
  index: number;
  total: number;
}) {
  return (
    <div
      className="flex h-full shrink-0 flex-col justify-start gap-3 px-5 md:pl-28 md:pr-[340px] landscape:gap-1.5"
      style={{ width: `${100 / total}%` }}
    >
      <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.45em] text-ink/50">
        <span className="text-seal">{step.n}</span>
        <span className="h-px w-8 bg-ink/25" />
        <span>{step.kicker}</span>
      </div>
      <h2
        className="text-[clamp(26px,9.5vw,40px)] font-normal leading-[0.95] tracking-[-0.02em] text-ink md:text-[clamp(36px,5.5vw,52px)] landscape:text-[clamp(20px,4.5vw,30px)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {step.title}
      </h2>
      <p className="max-w-md text-[13px] leading-relaxed text-ink-soft md:max-w-xl md:text-[15px] landscape:text-[12px] landscape:leading-snug">
        {step.body}
      </p>
      <Parallax
        depth={12}
        className="relative mt-1 min-h-0 w-full max-w-[560px] flex-1"
      >
        <Visual variant={step.visual} index={index} />
      </Parallax>
    </div>
  );
}

function Panel({ step, index, total }: { step: Step; index: number; total: number }) {
  return (
    <div
      className="flex h-full shrink-0 items-center justify-center px-6 md:px-6 lg:px-8"
      style={{ width: `${100 / total}%` }}
    >
      <div className="grid h-full w-full max-w-6xl grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-10 lg:gap-12">
        {/* Copy */}
        <div className="space-y-5 md:space-y-6">
          <div className="flex items-center gap-4 text-[10px] font-medium uppercase tracking-[0.45em] text-ink/45">
            <span className="text-seal">{step.n}</span>
            <span className="h-px w-10 bg-ink/20" />
            <span>{step.kicker}</span>
          </div>
          <h2
            className="text-[clamp(2.25rem,4.5vw,3.5rem)] font-normal leading-[0.95] tracking-[-0.02em] text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {step.title}
          </h2>
          <p className="max-w-md text-[13px] leading-relaxed text-ink-soft md:text-sm">
            {step.body}
          </p>
        </div>

        {/* Visual — capped height + centered so cards never stretch to fill
            the full viewport on large screens (was h-full → over-expanded). */}
        <div className="relative mx-auto flex h-[44vh] max-h-[460px] min-h-[300px] w-full max-w-[440px] items-center justify-center">
          <Visual variant={step.visual} index={index} />
        </div>
      </div>
    </div>
  );
}

function Visual({ variant, index }: { variant: Step["visual"]; index: number }) {
  const base = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: false, amount: 0.4 },
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const, delay: 0.1 },
  };

  if (variant === "template") {
    return (
      <motion.div {...base} className="relative h-full w-full">
        <Link
          to="/templates"
          aria-label="Browse dossier templates"
          className="absolute inset-0 z-20 cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-seal/60"
        />
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ y: 30, opacity: 0, rotate: 0 }}
            whileInView={{
              y: i * -10,
              opacity: 1,
              rotate: (i - 1) * 4,
            }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.8, delay: 0.15 * i, ease: [0.22, 1, 0.36, 1] }}
            className="surface-card absolute left-1/2 top-1/2 h-[70%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-paper/95 p-6 shadow-2xl"
            style={{ zIndex: 10 - i }}
          >
            <div className="text-[9px] uppercase tracking-[0.4em] text-ink/40">Dossier Template</div>
            <div
              className="mt-3 text-3xl text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {["Epictetus", "Orsino", "Marguerite"][i]}
              <span className="text-seal">.</span>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-px w-full bg-ink/10" />
              <div className="h-2 w-3/4 bg-ink/10" />
              <div className="h-2 w-1/2 bg-ink/10" />
            </div>
          </motion.div>
        ))}
      </motion.div>
    );
  }

  if (variant === "paste") {
    const lines = [
      "fri eve — TAP TP204 LIS 21:55",
      "stay: Memmo Príncipe Real (3n)",
      "sat: pastéis @ Manteigaria, tram 28",
      "sun: day trip — Sintra? maybe Cascais",
      "mon brunch w/ João, 11ish",
    ];
    return (
      <motion.div
        {...base}
        className="surface-card relative h-full w-full overflow-hidden rounded-md border border-white/10 bg-paper/95 p-6 shadow-2xl"
      >
        <div className="text-[9px] uppercase tracking-[0.4em] text-ink/40">Untitled note</div>
        <div className="mt-4 space-y-3 font-mono text-[12px] leading-relaxed text-ink/80">
          {lines.map((l, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.1 }}
            >
              <span className="mr-3 text-ink/30">{String(i + 1).padStart(2, "0")}</span>
              {l}
            </motion.div>
          ))}
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
            className="inline-block h-3 w-2 translate-y-0.5 bg-seal"
          />
        </div>
      </motion.div>
    );
  }

  if (variant === "parse") {
    const tags = [
      { label: "Flight", val: "TAP TP204" },
      { label: "Hotel", val: "Memmo Príncipe Real" },
      { label: "Food", val: "Manteigaria" },
      { label: "Transit", val: "Tram 28" },
      { label: "Day trip", val: "Sintra" },
      { label: "Meeting", val: "Brunch · João" },
    ];
    return (
      <motion.div {...base} className="relative h-full w-full">
        <div className="absolute inset-0 grid grid-cols-2 content-center gap-3">
          {tags.map((t, i) => (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="surface-card rounded-md border border-white/10 bg-paper/95 px-4 py-3"
            >
              <div className="text-[8px] uppercase tracking-[0.4em] text-seal">{t.label}</div>
              <div className="mt-1 text-[13px] text-ink" style={{ fontFamily: "var(--font-display)" }}>
                {t.val}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (variant === "map") {
    return (
      <motion.div
        {...base}
        className="surface-card relative h-full w-full overflow-hidden rounded-md border border-white/10 bg-[#0f1a2e] p-0 shadow-2xl"
      >
        {/* faux map grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* route path */}
        <svg viewBox="0 0 400 320" className="absolute inset-0 h-full w-full">
          <motion.path
            d="M40,260 C 100,180 160,220 200,150 S 320,90 360,60"
            fill="none"
            stroke="var(--seal)"
            strokeWidth="1.5"
            strokeDasharray="4 6"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 1.8, ease: "easeInOut" }}
          />
          {[
            { cx: 40, cy: 260, label: "Day 1" },
            { cx: 200, cy: 150, label: "Day 2" },
            { cx: 360, cy: 60, label: "Day 3" },
          ].map((p, i) => (
            <motion.g
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.35 }}
            >
              <circle cx={p.cx} cy={p.cy} r="7" fill="var(--seal)" />
              <circle cx={p.cx} cy={p.cy} r="14" fill="none" stroke="var(--seal)" strokeOpacity="0.4" />
              <text
                x={p.cx + 18}
                y={p.cy + 4}
                fill="rgba(255,255,255,0.7)"
                fontSize="10"
                fontFamily="Inter, sans-serif"
                style={{ letterSpacing: "0.2em", textTransform: "uppercase" }}
              >
                {p.label}
              </text>
            </motion.g>
          ))}
        </svg>
        <div className="absolute bottom-4 left-4 text-[9px] uppercase tracking-[0.4em] text-white/40">
          Lisbon · 3 days · 11 stops
        </div>
      </motion.div>
    );
  }

  // dossier
  return (
    <motion.div {...base} className="relative h-full w-full">
      <motion.div
        initial={{ rotate: -2, y: 10 }}
        whileInView={{ rotate: 0, y: 0 }}
        viewport={{ once: false, amount: 0.4 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="surface-card absolute inset-0 overflow-hidden rounded-md border border-white/10 bg-paper p-8 shadow-2xl"
      >
        <div className="flex items-start justify-between text-[9px] uppercase tracking-[0.4em] text-ink/40">
          <span>Lisbon Dossier</span>
          <span>№ 001</span>
        </div>
        <div
          className="mt-6 text-5xl text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Lisbon<span className="text-seal">.</span>
        </div>
        <div className="mt-1 text-[11px] italic text-ink/50">Three slow days along the Tagus.</div>

        <div className="mt-6 space-y-3">
          {["Day 01 — Arrive", "Day 02 — Wander", "Day 03 — Sintra"].map((d, i) => (
            <motion.div
              key={d}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.12 }}
              className="border-l border-seal/60 pl-3"
            >
              <div className="text-[10px] uppercase tracking-[0.3em] text-ink/50">{d}</div>
              <div className="mt-1 h-1.5 w-3/4 bg-ink/10" />
              <div className="mt-1 h-1.5 w-1/2 bg-ink/10" />
            </motion.div>
          ))}
        </div>

        <div className="absolute bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-seal text-[9px] uppercase tracking-[0.3em] text-paper">
          Seal
        </div>
      </motion.div>
    </motion.div>
  );
}