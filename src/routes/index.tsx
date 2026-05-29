import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "motion/react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "TravelDoss — Plan trips in a Google Doc, see them on a map" },
      {
        name: "description",
        content:
          "Write your trip in a Google Doc. TravelDoss pins, categorizes, and routes every place by day on a live Google Map.",
      },
    ],
  }),
});

function Landing() {
  const { scrollYProgress } = useScroll();
  const heroRef = useRef<HTMLDivElement>(null);
  const horizontalRef = useRef<HTMLDivElement>(null);
  const dossierRef = useRef<HTMLDivElement>(null);

  // Hero parallax
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroTitleY = useTransform(heroProgress, [0, 1], ["0%", "60%"]);
  const heroLabelY = useTransform(heroProgress, [0, 1], ["0%", "-120%"]);
  const heroOpacity = useTransform(heroProgress, [0, 0.8], [1, 0]);

  // Horizontal scroll section
  const { scrollYProgress: hProgress } = useScroll({
    target: horizontalRef,
    offset: ["start start", "end end"],
  });
  const x = useTransform(hProgress, [0, 1], ["0%", "-75%"]);
  const xSmooth = useSpring(x, { stiffness: 100, damping: 30, mass: 0.5 });

  // Dossier closer parallax
  const { scrollYProgress: dProgress } = useScroll({
    target: dossierRef,
    offset: ["start end", "end start"],
  });
  const dossierY = useTransform(dProgress, [0, 1], ["20%", "-20%"]);

  // Top progress bar
  const progressX = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <div className="relative min-h-screen bg-background text-foreground font-light selection:bg-seal selection:text-paper">
      {/* Distressed parchment grain — global */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.35] mix-blend-multiply"
        style={{
          backgroundImage:
            "url('https://www.transparenttextures.com/patterns/natural-paper.png')",
        }}
      />
      {/* Vignette */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          boxShadow: "inset 0 0 220px rgba(0,0,0,0.28)",
        }}
      />
      {/* Scroll progress hairline */}
      <motion.div
        style={{ scaleX: progressX, transformOrigin: "0% 50%" }}
        className="fixed left-0 right-0 top-0 z-50 h-px bg-seal"
      />

      <header className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between px-8 py-6 text-[10px] uppercase tracking-[0.4em]" style={{ fontFamily: "var(--font-sans)" }}>
        <Link to="/" className="font-bold">
          Travel<span className="text-seal">·</span>Doss
        </Link>
        <nav className="hidden gap-10 md:flex">
          <a href="#approach" className="text-foreground/60 transition-colors hover:text-foreground">Approach</a>
          <a href="#method" className="text-foreground/60 transition-colors hover:text-foreground">Method</a>
          <a href="#dossier" className="text-foreground/60 transition-colors hover:text-foreground">Dossier</a>
        </nav>
        <Link to="/login" className="border-b border-foreground pb-0.5 font-bold transition-colors hover:text-seal hover:border-seal">
          Enter
        </Link>
      </header>

      {/* HERO — saga wordmark */}
      <section
        ref={heroRef}
        className="relative z-10 mx-auto flex min-h-[92vh] max-w-[1600px] flex-col items-center justify-center overflow-hidden px-8 pb-24 pt-20 text-center"
      >
        {/* Decorative "rock" silhouettes — Thorgal fragments */}
        <div aria-hidden className="pointer-events-none absolute -left-12 -top-16 h-96 w-64 rotate-12 bg-ink opacity-[0.18] blur-sm" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 -rotate-12 bg-ink opacity-25 blur-sm" />
        <div aria-hidden className="pointer-events-none absolute right-16 top-1/4 h-12 w-12 rotate-45 bg-seal opacity-60 mix-blend-overlay" />

        <motion.span
          style={{ y: heroLabelY, opacity: heroOpacity }}
          className="mb-10 border-b border-seal/30 pb-2 text-[11px] font-bold uppercase tracking-[0.4em] text-seal"
        >
          The Document of Your Odyssey
        </motion.span>

        <motion.h1
          style={{ y: heroTitleY, opacity: heroOpacity, fontFamily: "var(--font-display)" }}
          className="text-[18vw] leading-[0.82] tracking-tight text-ink mix-blend-multiply md:text-[15vw]"
        >
          TRAVELDOSS
        </motion.h1>

        <motion.p
          style={{ opacity: heroOpacity }}
          className="mt-10 max-w-xl text-lg leading-relaxed text-ink/80 md:text-xl"
          // Cinzel via font-sans default
        >
          Transform the humble text of your plans into the{" "}
          <span className="font-bold text-seal">epic saga</span> of your journey.
        </motion.p>

        <motion.div style={{ opacity: heroOpacity }} className="group relative mt-12">
          <Link
            to="/login"
            className="relative z-10 inline-block bg-ink px-10 py-4 text-2xl tracking-[0.15em] text-paper transition-colors duration-500 hover:bg-seal"
            style={{ fontFamily: "var(--font-display)" }}
          >
            BEGIN THE CHRONICLE
          </Link>
          <div className="absolute inset-0 translate-x-2 translate-y-2 border border-ink/30 transition-transform group-hover:translate-x-1 group-hover:translate-y-1" />
        </motion.div>

        <motion.div
          style={{ opacity: heroOpacity }}
          className="mt-20 flex items-center gap-6 opacity-70"
        >
          <div className="h-px w-12 bg-ink" />
          <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Google Docs → Live Map</span>
          <div className="h-px w-12 bg-ink" />
        </motion.div>
      </section>

      {/* APPROACH */}
      <section id="approach" className="relative z-10 border-t border-ink/20">
        <div className="mx-auto grid max-w-[1600px] grid-cols-12 gap-6 px-8 py-32">
          <p className="col-span-12 text-[11px] font-bold uppercase tracking-[0.4em] text-seal md:col-span-3">
            Chapter II — The Approach
          </p>
          <div className="col-span-12 md:col-span-9">
            <motion.p
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20%" }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-3xl text-3xl leading-tight tracking-tight text-ink md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              YOU ALREADY WRITE YOUR TRIPS IN A GOOGLE DOC. TRAVELDOSS LIFTS
              EVERY PLACE FROM THE PAGE AND RENDERS IT AS A ROUTED, DAY-BY-DAY MAP.
            </motion.p>
          </div>
        </div>
      </section>

      {/* HORIZONTAL SCROLL — Field notes */}
      <section
        ref={horizontalRef}
        id="dossier-notes"
        className="relative z-10 h-[400vh] border-t border-ink/20"
      >
        <div className="sticky top-0 flex h-screen items-center overflow-hidden">
          <div className="absolute left-8 top-8 z-10 text-[11px] font-bold uppercase tracking-[0.4em] text-seal">
            Chapter IV — Field Chronicles ⇢
          </div>
          <motion.div style={{ x: xSmooth }} className="flex gap-8 pl-8 pr-8">
            {[
              { n: "α", t: "Lisbon", b: "Tile-clad facades. Pastéis at dawn. Tram 28 climbs into Alfama." },
              { n: "β", t: "Kyoto", b: "Moss temples. A bowl of soba in Pontochō. Bamboo turning pale at five." },
              { n: "γ", t: "Marrakech", b: "Riad shadows. Mint tea poured high. Spice piles in the medina." },
              { n: "δ", t: "Reykjavík", b: "Black sand. Steam from the earth. Long blue hours in midwinter." },
              { n: "ε", t: "Hanoi", b: "Phở at six. Motorbikes braided through the Old Quarter." },
              { n: "ζ", t: "Oaxaca", b: "Mezcal at dusk. Copal smoke. Mole the color of dried earth." },
            ].map((c) => (
              <article
                key={c.n}
                className="group relative flex h-[70vh] w-[80vw] shrink-0 flex-col justify-between border border-ink/30 bg-card p-10 shadow-[8px_8px_0_rgba(26,26,26,0.18)] md:w-[42vw]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.4em] text-seal">{c.n}</span>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-ink/50">Saga</span>
                </div>
                <div>
                  <h3
                    className="text-6xl tracking-tight text-ink md:text-8xl"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {c.t.toUpperCase()}
                  </h3>
                  <p className="mt-6 max-w-md text-sm leading-relaxed text-ink/70" style={{ fontFamily: "var(--font-body)" }}>
                    {c.b}
                  </p>
                </div>
                <div aria-hidden className="absolute right-6 top-6 h-3 w-3 rotate-45 bg-seal opacity-70" />
              </article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* METHOD */}
      <section id="method" className="relative z-10 border-t border-ink/20">
        <div className="mx-auto grid max-w-[1600px] grid-cols-12 gap-0 px-8 py-32">
          <p className="col-span-12 mb-16 text-[11px] font-bold uppercase tracking-[0.4em] text-seal md:col-span-3 md:mb-0">
            Chapter III — The Method
          </p>
          <div className="col-span-12 grid grid-cols-1 md:col-span-9 md:grid-cols-3">
            {[
              { n: "I", t: "Write", b: "Your Doc is the only source. Notes, places, day headings." },
              { n: "II", t: "Read", b: "We parse the prose, categorize each stop, geocode silently." },
              { n: "III", t: "Route", b: "Pinned, colored, and routed by day on a live map." },
            ].map((p, i) => (
              <motion.div
                key={p.n}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.8, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="border-t border-ink/20 pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0 first:md:border-l-0 first:md:pl-0"
              >
                <div className="text-2xl font-bold tracking-[0.3em] text-seal">{p.n}</div>
                <h3 className="mt-6 text-4xl tracking-tight text-ink" style={{ fontFamily: "var(--font-display)" }}>{p.t.toUpperCase()}</h3>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink/70" style={{ fontFamily: "var(--font-body)" }}>{p.b}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* DOSSIER closer */}
      <section ref={dossierRef} id="dossier" className="relative z-10 overflow-hidden border-t border-ink/20">
        <motion.div
          style={{ y: dossierY }}
          className="mx-auto grid max-w-[1600px] grid-cols-12 gap-6 px-8 py-32"
        >
          <p className="col-span-12 text-[11px] font-bold uppercase tracking-[0.4em] text-seal md:col-span-3">
            Chapter V — Begin
          </p>
          <div className="col-span-12 md:col-span-9">
            <h2
              className="text-[12vw] leading-[0.88] tracking-tight text-ink md:text-[8vw]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              OPEN A DOC.
              <br />
              <span className="text-seal">SEE THE WORLD.</span>
            </h2>
            <Link
              to="/login"
              className="mt-12 inline-block border-b-2 border-ink pb-1 text-xs font-bold uppercase tracking-[0.4em] transition-colors hover:border-seal hover:text-seal"
            >
              Enter TravelDoss →
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-ink/20">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-8 py-6 text-[10px] font-bold uppercase tracking-[0.4em] text-ink/60">
          <span>© TravelDoss · The Saga</span>
          <span>EST. MMXXVI</span>
        </div>
      </footer>
    </div>
  );
}
