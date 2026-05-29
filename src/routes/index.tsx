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
    <div className="min-h-screen bg-background text-foreground font-light">
      {/* Scroll progress hairline */}
      <motion.div
        style={{ scaleX: progressX, transformOrigin: "0% 50%" }}
        className="fixed left-0 right-0 top-0 z-50 h-px bg-foreground"
      />
      {/* Hairline top rule */}
      <div className="h-px w-full bg-border" />

      <header className="mx-auto flex max-w-[1600px] items-center justify-between px-8 py-6 text-xs uppercase tracking-[0.2em]">
        <Link to="/" className="font-normal">
          Travel<span className="text-muted-foreground">/</span>Doss
        </Link>
        <nav className="hidden gap-10 md:flex">
          <a href="#approach" className="text-muted-foreground transition-colors hover:text-foreground">
            Approach
          </a>
          <a href="#method" className="text-muted-foreground transition-colors hover:text-foreground">
            Method
          </a>
          <a href="#dossier" className="text-muted-foreground transition-colors hover:text-foreground">
            Dossier
          </a>
        </nav>
        <Link
          to="/login"
          className="border-b border-foreground pb-0.5 font-normal transition-opacity hover:opacity-60"
        >
          Enter
        </Link>
      </header>

      {/* HERO — letter-spaced display type, vast whitespace */}
      <section
        ref={heroRef}
        className="relative mx-auto flex min-h-[88vh] max-w-[1600px] flex-col justify-between overflow-hidden px-8 pb-16 pt-32 md:pt-48"
      >
        <div className="grid grid-cols-12 items-end gap-6">
          <motion.p
            style={{ y: heroLabelY, opacity: heroOpacity }}
            className="col-span-12 text-xs uppercase tracking-[0.3em] text-muted-foreground md:col-span-3"
          >
            001 — Itinerary as document
          </motion.p>
          <motion.h1
            style={{ y: heroTitleY, opacity: heroOpacity }}
            className="col-span-12 text-[14vw] font-extralight leading-[0.9] tracking-[-0.04em] md:col-span-9 md:text-[11vw]"
          >
            <span className="block">The shape</span>
            <span className="block pl-[18vw]">of a journey.</span>
          </motion.h1>
        </div>

        <div className="mt-24 grid grid-cols-12 gap-6 border-t border-border pt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span className="col-span-6 md:col-span-3">Est. 2026</span>
          <span className="col-span-6 md:col-span-3">Doc · Map · Route</span>
          <span className="hidden md:col-span-3 md:block">For the writer-traveler</span>
          <span className="hidden md:col-span-3 md:block text-right">Scroll ↓</span>
        </div>
      </section>

      {/* APPROACH */}
      <section id="approach" className="border-t border-border">
        <div className="mx-auto grid max-w-[1600px] grid-cols-12 gap-6 px-8 py-32">
          <p className="col-span-12 text-xs uppercase tracking-[0.3em] text-muted-foreground md:col-span-3">
            002 — Approach
          </p>
          <div className="col-span-12 md:col-span-9">
            <motion.p
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20%" }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-3xl text-3xl font-extralight leading-tight tracking-tight md:text-5xl"
            >
              You already write your trips in a Google Doc. TravelDoss reads
              that document, lifts every place from the page, and renders it as
              a routed, day-by-day map.
            </motion.p>
          </div>
        </div>
      </section>

      {/* HORIZONTAL SCROLL — Field notes */}
      <section
        ref={horizontalRef}
        id="dossier-notes"
        className="relative h-[400vh] border-t border-border"
      >
        <div className="sticky top-0 flex h-screen items-center overflow-hidden">
          <div className="absolute left-8 top-8 z-10 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            004 — Field notes · drag right ⇢
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
                className="flex h-[70vh] w-[80vw] shrink-0 flex-col justify-between border border-border bg-card p-10 md:w-[42vw]"
              >
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {c.n}
                </div>
                <div>
                  <h3 className="text-6xl font-extralight tracking-[-0.03em] md:text-8xl">
                    {c.t}
                  </h3>
                  <p className="mt-6 max-w-md text-sm font-light leading-relaxed text-muted-foreground">
                    {c.b}
                  </p>
                </div>
              </article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* METHOD — three pillars as numbered editorial blocks */}
      <section id="method" className="border-t border-border">
        <div className="mx-auto grid max-w-[1600px] grid-cols-12 gap-0 px-8 py-32">
          <p className="col-span-12 mb-16 text-xs uppercase tracking-[0.3em] text-muted-foreground md:col-span-3 md:mb-0">
            003 — Method
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
                className="border-t border-border pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0 first:md:border-l-0 first:md:pl-0"
              >
                <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{p.n}</div>
                <h3 className="mt-6 text-2xl font-light tracking-tight">{p.t}</h3>
                <p className="mt-3 max-w-xs text-sm font-light leading-relaxed text-muted-foreground">{p.b}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* DOSSIER closer */}
      <section ref={dossierRef} id="dossier" className="overflow-hidden border-t border-border">
        <motion.div
          style={{ y: dossierY }}
          className="mx-auto grid max-w-[1600px] grid-cols-12 gap-6 px-8 py-32"
        >
          <p className="col-span-12 text-xs uppercase tracking-[0.3em] text-muted-foreground md:col-span-3">
            005 — Begin
          </p>
          <div className="col-span-12 md:col-span-9">
            <h2 className="text-[10vw] font-extralight leading-[0.95] tracking-[-0.03em] md:text-[7vw]">
              Open a doc.
              <br />
              <span className="text-muted-foreground">See the world.</span>
            </h2>
            <Link
              to="/login"
              className="mt-12 inline-block border-b border-foreground pb-1 text-xs uppercase tracking-[0.3em] transition-opacity hover:opacity-60"
            >
              Enter TravelDoss →
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-8 py-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span>© TravelDoss</span>
          <span>MMXXVI</span>
        </div>
      </footer>
    </div>
  );
}
