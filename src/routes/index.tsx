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
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-seal/40">
      {/* Ambient gradient orbs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-32 top-1/4 h-[520px] w-[520px] rounded-full opacity-60 blur-[120px]"
             style={{ background: "radial-gradient(circle, oklch(0.6 0.2 250 / 0.6), transparent 70%)" }} />
        <div className="absolute -right-20 top-2/3 h-[460px] w-[460px] rounded-full opacity-50 blur-[120px]"
             style={{ background: "radial-gradient(circle, oklch(0.65 0.2 285 / 0.55), transparent 70%)" }} />
        <div className="absolute left-1/3 -bottom-32 h-[400px] w-[400px] rounded-full opacity-40 blur-[120px]"
             style={{ background: "radial-gradient(circle, oklch(0.7 0.18 215 / 0.5), transparent 70%)" }} />
      </div>
      {/* Subtle grid */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-[0.08]"
           style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />

      <Ribbon />

      {/* Center stage */}
      <main className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] flex-col items-center justify-center px-6 py-16 text-center md:pl-32 md:pr-[340px]">
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.35em] text-ink/70 backdrop-blur-xl"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-seal shadow-[0_0_8px_oklch(0.72_0.17_245)]" />
          Plan trips. Live on a map.
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="text-[14vw] font-semibold leading-[0.9] tracking-[-0.04em] md:text-[7.5vw]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="bg-gradient-to-br from-white via-white to-white/50 bg-clip-text text-transparent">Travel</span>
          <span className="bg-gradient-to-br from-seal via-seal-soft to-seal bg-clip-text text-transparent">Doss</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-8 max-w-xl text-base leading-relaxed text-ink/65 md:text-lg"
        >
          Pick a template. We open it as a fresh Google Doc, then pin every
          place on a routed, day-by-day map.
        </motion.p>

        {/* Glass CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative mt-12"
        >
          <div aria-hidden className="absolute inset-0 -z-10 rounded-full opacity-70 blur-2xl"
               style={{ background: "var(--gradient-blue)" }} />
          <Link
            to="/templates"
            className="group relative inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.08] px-9 py-5 text-sm font-semibold uppercase tracking-[0.25em] text-ink shadow-[0_8px_32px_rgba(80,120,255,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl transition-all duration-500 hover:scale-[1.03] hover:bg-white/[0.12] hover:shadow-[0_12px_48px_rgba(80,120,255,0.55),inset_0_1px_0_rgba(255,255,255,0.2)] md:text-base"
          >
            <span className="relative h-2 w-2 rounded-full bg-seal">
              <span className="absolute inset-0 animate-ping rounded-full bg-seal" />
            </span>
            Pick TravelDoss Template
            <svg className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </motion.div>

        <div className="mt-14 flex items-center gap-4 text-[10px] font-medium uppercase tracking-[0.35em] text-ink/40">
          <div className="h-px w-10 bg-white/20" />
          Google Docs → Live Map
          <div className="h-px w-10 bg-white/20" />
        </div>

        {/* Mobile-only quick chips */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 md:hidden">
          {[
            { to: "/app" as const, label: "Browse Places" },
            { to: "/templates" as const, label: "Templates" },
            { to: "/app" as const, label: "Past Trips" },
          ].map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.25em] text-ink/70 backdrop-blur-xl"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </main>

      <InfiniteDocs />
    </div>
  );
}
