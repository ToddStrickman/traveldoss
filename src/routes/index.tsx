import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Ribbon } from "@/components/landing/Ribbon";
import { InfiniteDocs } from "@/components/landing/InfiniteDocs";

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
  return (
    <div className="relative flex min-h-screen bg-background text-foreground selection:bg-seal selection:text-paper">
      {/* Parchment grain */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.35] mix-blend-multiply"
        style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/natural-paper.png')" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{ boxShadow: "inset 0 0 220px rgba(0,0,0,0.28)" }}
      />

      <Ribbon />

      {/* Center stage */}
      <main className="relative z-10 flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center md:px-12">
        <div aria-hidden className="pointer-events-none absolute -left-16 top-1/4 h-72 w-48 rotate-12 bg-ink opacity-[0.12] blur-sm" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-12 h-72 w-72 -rotate-12 bg-ink opacity-[0.18] blur-sm" />
        <div aria-hidden className="pointer-events-none absolute right-8 top-12 h-10 w-10 rotate-45 bg-seal opacity-50 mix-blend-overlay" />

        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8 border-b border-seal/40 pb-2 text-[10px] font-bold uppercase tracking-[0.5em] text-seal"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          The Document of Your Odyssey
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="text-[16vw] leading-[0.82] tracking-tight text-ink mix-blend-multiply md:text-[10vw]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          TRAVELDOSS
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-8 max-w-xl text-base leading-relaxed text-ink/75 md:text-lg"
        >
          Pick a template. We open it as a fresh Google Doc, then pin every place
          on a routed, day-by-day map.
        </motion.p>

        {/* The stylized CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="group relative mt-14"
        >
          <Link
            to="/templates"
            className="relative z-10 inline-flex items-center gap-4 bg-ink px-14 py-6 text-2xl tracking-[0.15em] text-paper transition-colors duration-500 hover:bg-seal md:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="h-2 w-2 rotate-45 bg-seal transition-colors group-hover:bg-paper" />
            PICK A TRAVELDOSS TEMPLATE
            <span className="h-2 w-2 rotate-45 bg-seal transition-colors group-hover:bg-paper" />
          </Link>
          <div className="absolute inset-0 translate-x-2 translate-y-2 border border-ink/40 transition-transform group-hover:translate-x-1 group-hover:translate-y-1" />
        </motion.div>

        <div className="mt-14 flex items-center gap-6 opacity-70">
          <div className="h-px w-12 bg-ink" />
          <span
            className="text-[10px] font-bold uppercase tracking-[0.4em]"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Google Docs → Live Map
          </span>
          <div className="h-px w-12 bg-ink" />
        </div>

        {/* Mobile-only secondary access to the ribbon items */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4 md:hidden">
          <Link to="/login" className="border-b border-ink pb-0.5 text-[10px] font-bold uppercase tracking-[0.4em]">
            Enter
          </Link>
          <Link to="/templates" className="border-b border-seal pb-0.5 text-[10px] font-bold uppercase tracking-[0.4em] text-seal">
            Templates
          </Link>
        </div>
      </main>

      <InfiniteDocs />
    </div>
  );
}
