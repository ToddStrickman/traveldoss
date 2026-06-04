import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring } from "motion/react";
import { Link } from "@tanstack/react-router";

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
    title: "Choose a template.",
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

function DesktopFlow() {
  const containerRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Track translates horizontally across the steps.
  // We show N panels; translate from 0 to -(N-1)/N * 100%.
  const distance = -((STEPS.length - 1) / STEPS.length) * 100;
  const xRaw = useTransform(scrollYProgress, [0, 1], [`0%`, `${distance}%`]);
  const x = useSpring(xRaw, { stiffness: 120, damping: 24, mass: 0.4 });

  const progressX = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section
      ref={containerRef}
      className="relative z-10 hidden md:block"
      style={{ height: `${STEPS.length * 58}vh` }}
      aria-label="How TravelDoss works"
    >
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* Section label */}
        <div className="pointer-events-none absolute left-32 right-[340px] top-8 z-20 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.4em] text-ink/45">
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
        <div className="absolute inset-y-0 left-32 right-[340px] overflow-hidden pt-16 pb-16">
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
        <div className="pointer-events-none absolute bottom-8 left-32 right-[340px] z-20">
          <div className="mb-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.4em] text-ink/45">
            <Counter scrollYProgress={scrollYProgress} total={STEPS.length} />
            <span>Your itinerary, unfolding.</span>
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth);
        setActive(Math.min(STEPS.length - 1, Math.max(0, i)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section
      className="relative z-10 block md:hidden"
      aria-label="How TravelDoss works"
    >
      <div className="flex items-center justify-between px-6 pb-5 pt-12 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/45">
        <span className="inline-flex items-center gap-3">
          <span className="h-px w-6 bg-ink/25" />
          The Flow
        </span>
        <span>Swipe →</span>
      </div>

      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth pb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {STEPS.map((step, i) => (
          <div
            key={step.n}
            className="flex w-screen shrink-0 snap-center snap-always flex-col gap-6 px-6"
          >
            <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.45em] text-ink/45">
              <span className="text-seal">{step.n}</span>
              <span className="h-px w-8 bg-ink/20" />
              <span>{step.kicker}</span>
            </div>
            <h2
              className="text-[12vw] font-normal leading-[0.95] tracking-[-0.02em] text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {step.title}
            </h2>
            <p className="max-w-md text-[13px] leading-relaxed text-ink-soft">
              {step.body}
            </p>
            <div className="relative mt-2 h-[44vh] w-full">
              <Visual variant={step.visual} index={i} />
            </div>
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 pb-4">
        {STEPS.map((s, i) => (
          <button
            key={s.n}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to step ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? "w-8 bg-seal" : "w-1.5 bg-ink/20"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between px-6 pb-10 text-[10px] font-medium uppercase tracking-[0.4em] text-ink/45">
        <span className="inline-flex items-center gap-2">
          <span className="text-seal">{String(active + 1).padStart(2, "0")}</span>
          <span className="text-ink/30">/ {String(STEPS.length).padStart(2, "0")}</span>
        </span>
        <span>Your itinerary, unfolding.</span>
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

function Panel({ step, index, total }: { step: Step; index: number; total: number }) {
  return (
    <div
      className="flex h-full shrink-0 items-center justify-center px-6 md:px-8"
      style={{ width: `${100 / total}%` }}
    >
      <div className="grid h-full w-full max-w-6xl grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-12">
        {/* Copy */}
        <div className="space-y-6">
          <div className="flex items-center gap-4 text-[10px] font-medium uppercase tracking-[0.45em] text-ink/45">
            <span className="text-seal">{step.n}</span>
            <span className="h-px w-10 bg-ink/20" />
            <span>{step.kicker}</span>
          </div>
          <h2
            className="text-[10vw] font-normal leading-[0.95] tracking-[-0.02em] text-ink md:text-[4.5vw]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {step.title}
          </h2>
          <p className="max-w-md text-[13px] leading-relaxed text-ink-soft md:text-sm">
            {step.body}
          </p>
        </div>

        {/* Visual */}
        <div className="relative flex h-full min-h-[440px] items-center justify-center">
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
          aria-label="Browse templates"
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
            <div className="text-[9px] uppercase tracking-[0.4em] text-ink/40">Template</div>
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